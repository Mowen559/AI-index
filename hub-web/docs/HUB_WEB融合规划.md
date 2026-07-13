# Hub Web 融合现状与生产规划

## 一、结论摘要

`hub-web` 目前还不能定义为“已经全部融合正常的主程序”，更准确的判断是：

- 它已经是一个多系统融合外壳
- 其中一部分能力已经真实接通
- 一部分能力只是半接通
- 还有一部分仍然是占位、模拟或强依赖本地目录结构

当前最接近事实的描述是：

1. `codebase-memory-mcp` 是现在真正的图谱和索引主干
2. `GitNexus` 是现在真正的 Git / 历史 / diff / 影子历史能力主干
3. `Understand-Anything` 主要承担产品表达层、解释层、元数据增强层
4. `supermemory` 目前还是预留接入态，不是完整真实接通
5. `codegraph` 已经被引入依赖，但还没有成为 `hub-web` 的主运行核心

所以，`hub-web` 当前更像“融合中的主程序原型”，不是“已完成生产级融合”的成品。

## 二、当前融合结构判断

### 1. 当前真实主链

现在 `hub-web` 的主链路更接近下面这个结构：

`codebase-memory-mcp -> 图数据库 -> hub-web 图谱界面`

同时叠加：

`GitNexus -> Git历史 / diff / restore / shadow history -> hub-web 分析面板`

再叠加：

`Understand-Anything -> summary / tags / complexity / UI叙事 -> hub-web 右侧解释面板`

以及：

`supermemory -> chat / logs 预留接口 -> hub-web 聊天入口`

### 2. 当前不是完全平权融合

虽然项目名义上融合了多套系统，但实际上并不是五套系统完全平权协作，而是：

- `codebase-memory-mcp` 和 `GitNexus` 更偏真实底层引擎
- `Understand-Anything` 更偏体验层和解释层
- `supermemory` 更偏未来能力位
- `codegraph` 更偏已经引入、尚未成为主链

## 三、模块接入现状

## 3.1 `codebase-memory-mcp`

### 当前角色

- 项目初始化入口
- 图谱数据库来源
- 文件级结构和边关系来源

### 证据

- `src/app/api/analyze/route.ts`
  直接调用 `codebase-memory-mcp` 可执行程序进行索引
- `src/app/api/project-graph/route.ts`
  直接读取 `codebase-memory-mcp` 生成的 SQLite 数据库
- `src/app/api/analyze-file/route.ts`
  直接查询同一数据库中的 nodes / edges

### 判断

`真实接入，且是当前图谱主干`

## 3.2 `GitNexus`

### 当前角色

- 文件 Git 历史
- 本地历史与 shadow history
- diff / restore 能力
- 一部分文件分析辅助能力

### 证据

- `src/app/api/file-git-history/route.ts`
  动态导入：
  - `gitnexus/dist/server/shadow-git.js`
  - `gitnexus/dist/server/git-history.js`
- `src/app/api/ai-git/route.ts`
  实现 AI 历史存储与差异逻辑
- UI 中存在：
  - `FileHistoryMergeView`
  - `ShadowGitDiffViewer`
  - 文件历史、比较、恢复相关交互

### 判断

`真实接入，且是当前变更分析与 Git 能力主干`

## 3.3 `Understand-Anything`

### 当前角色

- 产品表达层
- 文件解释增强层
- summary / tags / complexity 元数据来源
- 仪表盘中的“理解代码”叙事外壳

### 证据

- 页面与组件命名明显沿用这条线：
  - `Understand-Anything Active`
  - `UnifiedKnowledgeGraph`
  - `CodebaseAnalysisPanel`
- `src/app/api/analyze-file/route.ts`
  尝试从多个 `knowledge-graph.json` 路径读取：
  - summary
  - tags
  - complexity
- `src/app/api/analyze/route.ts`
  有一段 “semantic mapping complete” 的模拟式状态流程

### 判断

`部分真实接入，但仍有明显占位和半成品痕迹`

## 3.4 `supermemory`

### 当前角色

- 聊天入口
- 日志入口
- 未来记忆能力位

### 证据

- `src/app/api/supermemory-chat/route.ts`
- `src/app/api/supermemory-logs/route.ts`

其中 `supermemory-chat` 当前代码里明确是模拟响应，不是真正接通后端。

### 判断

`接口位置已预留，但核心能力仍是 mock，不算真实完成融合`

## 3.5 `codegraph`

### 当前角色

- 已被纳入依赖
- 理论上是未来可接入的结构化代码图谱引擎

### 证据

- `hub-web/package.json` 直接依赖 `@colbymchenry/codegraph`

但是从现有 API 主链来看，`hub-web` 的实际运行流程目前并不是直接围绕 `codegraph` 建立的。

### 判断

`依赖已引入，但尚未成为主执行链核心`

## 四、接口级归属判断

| 接口 | 当前主要归属 | 现状判断 |
|---|---|---|
| `api/analyze` | `codebase-memory-mcp` | 真实接入 |
| `api/project-graph` | `codebase-memory-mcp` | 真实接入 |
| `api/analyze-file` | `codebase-memory-mcp` + `Understand-Anything` 元数据 | 部分真实接入 |
| `api/file-content` | 通用文件读取 | 真实接入 |
| `api/files` | 文件树基础能力 | 真实接入 |
| `api/file-git-history` | `GitNexus` | 真实接入 |
| `api/git` | Git辅助能力 | 大概率真实接入 |
| `api/git-diff` | `GitNexus` 相关能力 | 大概率真实接入 |
| `api/git-restore` | `GitNexus` 相关能力 | 大概率真实接入 |
| `api/shadow-git` | `GitNexus` 影子历史能力 | 大概率真实接入 |
| `api/ai-git` | 本地 AI 历史层 | 真实接入，但与 GitNexus 有重叠 |
| `api/layout` | 图布局/UI 层 | 真实接入 |
| `api/apply-patch` | 编辑辅助能力 | 真实接入 |
| `api/supermemory-chat` | `supermemory` | mock |
| `api/supermemory-logs` | `supermemory` | 待进一步验证 |

## 五、组件级归属判断

| 组件 | 表面归属 | 实际背后来源 |
|---|---|---|
| `project-select-form` | 主入口壳 | `codebase-memory-mcp` |
| `UnifiedKnowledgeGraph` | Understand-Anything 风格图谱层 | `codebase-memory-mcp` 图数据库 |
| `CodebaseAnalysisPanel` | Understand-Anything 风格解释面板 | 文件分析 + Git 历史 + metadata |
| `FileHistoryMergeView` | Git 视图层 | `GitNexus` 相关能力 |
| `ShadowGitDiffViewer` | Shadow Git 视图层 | `GitNexus` / 本地 AI 历史 |
| `ProjectOverviewPanel` | 项目总览层 | 融合壳本身 |

## 六、当前主要问题

## 6.1 运行时问题

- `hub-web` 启动依赖 monorepo 环境非常敏感
- 本地依赖状态一旦脏掉，就容易导致无法稳定启动
- 路径查找依赖兄弟目录结构，缺少统一配置

## 6.2 架构问题

- 图谱来源当前没有明确唯一真源
- Git 历史与 AI 历史存在职责重叠
- `Understand-Anything` 与 `GitNexus` 的职责边界没有正式抽象
- `supermemory` 仍然停留在接口预留阶段

## 6.3 产品问题

- UI 呈现的是“完整理解系统”的感觉
- 但底层其实有 mock、占位和降级逻辑
- 这会导致体验上像成品，实际却不是成品

## 七、总体生产策略

不建议继续“所有系统一起糊上去”。

建议改成：

`hub-web` 作为统一编排层，各能力通过正式 provider/adapter 接入。

也就是先定义“谁负责什么”，再做融合，而不是继续让页面直接依赖各个兄弟项目内部实现。

## 八、推荐的目标架构

建议把 `hub-web` 明确拆成四个能力提供者：

### 1. GraphProvider

负责：

- 项目图谱加载
- 文件关系扩展
- 图节点和图边过滤
- 图谱统计

候选后端：

- `codebase-memory-mcp`
- 或未来替换成 `codegraph`

### 2. GitProvider

负责：

- 本地历史
- shadow history
- diff
- restore
- AI 改动记录

候选后端：

- `GitNexus`

### 3. ExplanationProvider

负责：

- summary
- tags
- complexity
- onboarding explanation
- file insight

候选后端：

- `Understand-Anything`

### 4. MemoryProvider

负责：

- 项目上下文聊天
- 检索增强
- 记忆日志

候选后端：

- `supermemory`

## 九、分阶段生产规划

## Phase 0：先把运行时稳定下来

### 目标

让 `hub-web` 可以在干净环境中稳定启动。

### 任务

- 增加统一配置文件，管理兄弟项目路径
- 去掉 API 中硬编码的 `../GitNexus` 假设
- 统一图数据库发现逻辑
- 增加系统健康检查：
  - 图数据库是否可用
  - GitNexus runtime 是否可用
  - Understand-Anything metadata 是否可用
  - supermemory 是否已配置
- 在 UI 中显示降级状态，而不是静默失败

### 完成标准

- `hub-web` 可以从干净环境启动
- dashboard 能稳定打开
- 缺失子系统时，页面明确提示

## Phase 1：把“假融合”改成“诚实融合”

### 目标

去掉所有伪装成真实能力的 mock/占位行为。

### 任务

- 将 `supermemory-chat` 改成真实接入，或者显式标注为未启用
- 将 `analyze` 中模拟的 Understand-Anything 状态改成真实状态
- 给每个 API 标记状态：
  - 生产可用
  - 实验性
  - mock

### 完成标准

- UI 不再误导用户
- 所有能力的真实状态清晰可见

## Phase 2：建立正式适配层

### 目标

停止让 `hub-web` 直接耦合兄弟项目内部实现。

### 任务

- 建立：
  - `GraphProvider`
  - `GitProvider`
  - `ExplanationProvider`
  - `MemoryProvider`
- 所有 API route 改为调用 provider
- UI 层不再直接感知底层项目路径和内部模块

### 完成标准

- 更换底层引擎时不用重写 UI
- 每个系统的职责边界清楚

## Phase 3：统一图谱真源

### 目标

解决“到底谁是图谱主引擎”的问题。

### 可选方案

1. 保留 `codebase-memory-mcp` 作为图谱主干
2. 迁移到 `codegraph`
3. 两者都支持，但通过统一 `GraphProvider`

### 推荐

短期建议：

- 先保留 `codebase-memory-mcp` 为主干
- 让 `codegraph` 先通过适配层挂进来

原因：

- 当前真实运行链已经建立在 `codebase-memory-mcp` 上
- 现在直接替换图谱主核风险太高

### 完成标准

- 图谱来源只有一个主逻辑入口
- 不再由多个系统重复定义图数据语义

## Phase 4：统一 Git 与 AI 历史模型

### 目标

消除 `GitNexus` 历史和 `.ai_history.db` 本地历史的重叠。

### 任务

- 统一 AI 历史存储策略
- 统一 shadow history 的来源
- 统一 diff / restore 流程

### 完成标准

- 一套历史模型
- 一套恢复逻辑
- 一套差异比较逻辑

## Phase 5：接通真实 supermemory

### 目标

让聊天和记忆能力从演示态进入产品态。

### 任务

- 替换 mock `supermemory-chat`
- 明确 project / file 级记忆作用域
- 将图谱上下文、文件上下文接入聊天前置检索
- 支持流式输出

### 完成标准

- 聊天输出真实
- 检索记忆可验证
- 日志链路真实可追踪

## Phase 6：做整机融合测试

### 目标

验证的是 `hub-web` 主程序整体，而不是单个子系统能不能跑。

### 用例范围

- 项目初始化
- 图谱加载
- 文件点击
- 右侧分析面板
- Git 历史
- diff / restore
- 聊天能力
- 子系统缺失时的降级模式

### 完成标准

- 有一套稳定的端到端测试覆盖主流程

## 十、推荐优先级

如果目标是尽快把 `hub-web` 变成可用主程序，建议顺序如下：

1. `Phase 0`
2. `Phase 1`
3. `Phase 2`
4. `Phase 4`
5. `Phase 5`
6. `Phase 3`
7. `Phase 6`

### 原因

- 先能稳定启动，比先换内核更重要
- 先把 mock 和真实能力区分开，比继续堆新功能更重要
- `supermemory` 要在稳定外壳之后接通才更安全
- 图谱主核替换应该放在壳稳定之后

## 十一、建议的近期执行路线

## 路线 A：最小重写、先做成可用内部工具

### 策略

- 保留 `codebase-memory-mcp` 作为图谱主核
- 保留 `GitNexus` 作为 Git 主核
- 保留 `Understand-Anything` 作为解释层
- 尽快替换 `supermemory` mock
- 补 provider 层和启动配置

### 适合

- 想最快得到一个可运行的主程序

## 路线 B：先架构收敛，再做完整替换

### 策略

- 先稳定 `hub-web`
- 再做 provider 抽象
- 再考虑让 `codegraph` 成为正式主图谱后端

### 适合

- 更看重长期架构一致性
- 能接受更长的交付周期

## 十二、最终建议

对当前 `hub-web` 的建议定位应该是：

`融合编排层（orchestration shell）`

而不是：

`已经完成统一的主产品`

最正确的下一步不是继续盲目加功能，而是：

1. 先稳定运行时
2. 先去掉 mock 和路径硬编码
3. 先明确每个系统的职责真源
4. 再推进真正的统一融合

## 十三、推荐下一动作

建议立即开始执行：

### 第 1 步

完成 `Phase 0`

也就是：

- 配置化路径发现
- API 健康检查
- 启动前依赖检测
- UI 降级提示

这是把 `hub-web` 从“原型壳”推进成“可运行主程序”的最关键一步。
