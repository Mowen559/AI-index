# 运行时配置设计 (Runtime Config)

在 `hub-web` 核心架构中，存在一个关键的挑战：**多项目上下文隔离**。

早期的系统默认从环境变量或者硬编码的路径（如 `process.cwd()` 或者通过 `getShadowGitRoot()` 获取的单一路径）读取配置文件、CodeGraph DB 以及 Codebase Memory，这意味着系统同时只能针对一个目标代码库进行分析和回答问题。这在本地 CLI 环境下是可以接受的，因为每个 CLI 实例都在对应的项目目录下运行。

但随着系统演变为 **Project-centric Intelligence Engine（以项目为中心的智能引擎）** 架构模式，它需要能够同时管理多个不同的目标项目。如果仍然使用全局的单例配置，当用户在不同项目之间切换时，就会出现严重的上下文污染问题（比如页面打开的是项目 A，但引擎因为环境变量尚未切换，读取了项目 B 的记忆图谱数据）。

因此，我们重构了 `runtime-config.ts` 以及上下游所有的依赖读取链路。

## 重构原则与实现机制

1. **全面取消基于全局变量/环境变量的单例数据源**
   不再直接使用不带参数的 `getCodebaseMemoryDbPath()` 来读取全局默认数据库。所有需要访问“项目级上下文”的方法，都**必须**传入 `projectPath` 参数。

2. **隔离的项目级配置存储目录：`.aindex-hub/`**
   我们在用户的项目根目录下（由 `projectPath` 指定）创建专属的 `.aindex-hub/` 目录，用于统一存储该项目在被引擎处理时产生的所有中间状态与数据库：
   - `.aindex-hub/CodeGraph.db`：代码图谱的 SQLite 缓存。
   - `.aindex-hub/CodebaseMemory.db`：代码库记忆（向量+图）缓存。
   - `.aindex-hub/supermemory_store.json`：该项目的专属超级记忆（Supermemory）存储文件。
   - `.aindex-hub/tasks/`：该项目的后台异步任务执行记录（任务流引擎的状态管理）。

3. **路由参数必须携带 Context ID**
   所有与上下文、分析、图谱相关的 API 接口（如 `/api/projects/analyze`, `/api/context/search`, `/api/reverse-engineering` 等），其请求 Payload 中都**必须**携带 `projectPath` 或 `projectId` 参数。
   服务端通过这个参数，在运行时动态生成其所需访问的隔离上下文路径。

4. **安全与降级策略**
   如果上游没有传入 `projectPath`，在开发环境或过渡阶段，部分 `runtime-config.ts` 中的函数仍允许 fallback 回退到环境变量（如 `process.env.TARGET_PROJECT_PATH`），但这已经被标记为反模式，并且应当在新 API 中严格校验，拒绝不带明确 project context 的请求。

## 典型 API 契约变化

新的标准化 API 统一输出带有 Trace 和 Project 属性的返回值：

```typescript
// 标准化 API 响应返回类型
export interface ApiResponse {
  trace_id: string;      // 请求追踪 ID
  project_id: string;    // 所属的项目路径
  // ... 具体业务数据
}
```

## 异步任务管理架构

对于诸如代码全量分析之类耗时很长（可能数分钟到小时级别）的操作，由于 Next.js 等 Web 框架存在请求超时或内存状态热重载丢失的问题，我们放弃了在一次 HTTP 请求中等待进程结束并通过 SSE 推送结果的模式。

目前的架构采用：
- **前端发起的提交（Submit）** -> `POST /api/projects/analyze` 立即返回 `taskId`
- **后台生成并跟踪进程（Task Manager）** -> 进程状态会被持久化写入到 `[projectPath]/.aindex-hub/tasks/[taskId].json`
- **前端持续轮询查询（Poll）** -> `GET /api/tasks/[taskId]` 读取上述 JSON 文件返回给前端。
- **取消机制（Cancel）** -> `POST /api/tasks/[taskId]/cancel` 接收到请求后向底层子进程发送 `SIGKILL`，并将任务标记为 CANCELED。

以上重构使引擎能够优雅地支持多项目并发、健壮的任务管理以及长期的状态持久化。
