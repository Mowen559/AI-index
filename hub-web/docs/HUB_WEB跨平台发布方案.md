# Hub Web 跨平台发布方案

## 一、文档目的

这份文档的目标是回答一个实际问题：

`hub-web` 如何从当前的 monorepo 拼装态，演进成一个可以提供给 Windows、macOS、Linux 用户直接运行的程序。

这里的“直接运行”指的是：

- 用户不需要手动安装一堆开发依赖
- 用户不需要理解兄弟项目目录结构
- 用户不需要手动准备缓存数据库、知识图谱 JSON、shadow-git 目录
- 用户安装后可以启动一个统一程序
- 程序能够自检、自初始化、降级运行或提示缺失能力

## 二、当前为什么还不能直接打包发布

## 2.1 当前是源码拼装态，不是产品发布态

现在的 `hub-web` 依赖的是一个开发期 monorepo：

- `hub-web`
- `GitNexus/gitnexus`
- `Understand-Anything/understand-anything-plugin`
- `codebase-memory-mcp`
- `codegraph`
- `supermemory`

这意味着 `hub-web` 不是一个自包含产品，而是一个会去查找兄弟目录、缓存目录、生成产物的融合外壳。

## 2.2 关键运行资源不统一

当前运行依赖的关键资源包括：

- `codebase-memory-mcp` 生成的 SQLite 图数据库
- `codegraph` 数据库
- `Understand-Anything` 的 `knowledge-graph.json`
- `GitNexus` runtime 和其 server helper
- `.shadow-git`
- `.ai_history.db`
- 其他本地缓存与中间产物

这些资源目前散落在：

- 工作区根目录
- 兄弟项目目录
- 用户缓存目录
- 项目内隐藏目录

这不符合发布程序的资源组织方式。

## 2.3 一部分能力还没有完成真实接入

当前还有如下问题：

- `supermemory-chat` 仍是 mock
- `Understand-Anything` 有部分模拟状态
- `GitNexus` 历史和本地 `.ai_history.db` 存在职责重叠
- 图谱主干还没有统一真源

在这种状态下直接打包，只会得到“能启动的壳”，而不是稳定可交付的产品。

## 三、最终目标形态

建议的最终产品形态应该是：

### 用户视角

- 安装一个程序
- 打开后选择或导入本地项目
- 程序自动初始化索引、图谱、历史、聊天上下文
- UI 能展示系统状态
- 某些模块不可用时，能清晰降级提示

### 系统视角

- 有统一的 App Root
- 有统一的数据目录
- 有统一的配置目录
- 有统一的子系统启动编排
- 有统一的日志、健康检查、升级与版本管理

## 四、推荐的发布架构

## 4.1 产品总体结构

建议把最终产品拆成四层：

### 1. Desktop Shell

负责：

- 窗口
- 系统托盘
- 本地文件选择
- 安装包和升级
- 启动本地服务

可选技术：

- `Electron`
- `Tauri`

### 2. App Backend

负责：

- API 路由
- GraphProvider / GitProvider / ExplanationProvider / MemoryProvider
- 健康检查
- 初始化流程

当前基础：

- `hub-web` 的 Next.js API route

### 3. Engine Layer

负责：

- 图谱与索引引擎
- Git 分析能力
- metadata / summary / complexity
- memory/chat

对应当前系统：

- `codebase-memory-mcp`
- `GitNexus`
- `Understand-Anything`
- `supermemory`
- 未来可收敛 `codegraph`

### 4. Data Layer

负责：

- 本地图数据库
- AI 历史数据库
- metadata JSON
- cache
- logs
- shadow workspace

## 4.2 推荐桌面壳选择

### 方案 A：Electron

#### 优点

- 最成熟
- 跨平台能力强
- 对 Next.js / 本地 Node 服务集成最直接
- 容易管理多个本地进程
- 更适合当前这个“Node + 多子系统 + 本地文件系统 + 本地数据库”的项目

#### 缺点

- 安装包更大
- 内存占用更高

### 方案 B：Tauri

#### 优点

- 包体更小
- 性能更好
- 更接近原生桌面程序

#### 缺点

- 当前项目是明显的 Node 生态拼装
- 本地子进程编排、Node 运行时打包、多模块协同会更复杂
- 对现阶段不如 Electron 平滑

### 当前建议

短中期建议优先使用：

`Electron`

理由很简单：

- 当前依赖全部在 Node / JS 生态
- 存在多个本地引擎和本地数据目录
- 当前最重要的是先落地，不是先追求最小包体

## 五、发布版必须内置的内容

下面这些不应该再依赖“旁边刚好有源码目录”，而应该进入发布版能力包。

## 5.1 必须内置

### `hub-web` 自身

- Next.js 前端
- API route
- 配置管理
- 健康检查
- 降级策略

### 图谱能力主干

二选一或双支持，但发布版必须明确主方案：

- `codebase-memory-mcp`
- 或 `codegraph`

### Git 相关能力

- `GitNexus` 必需 runtime
- `git-history`
- `shadow-git`
- `diff / restore`

### Metadata 能力

- `Understand-Anything` 的必要 runtime
- 生成 summary / tags / complexity 所需逻辑

### 程序内置运行时

- Node runtime 或等价运行时
- 所需原生模块
- SQLite 相关依赖

## 5.2 不建议直接内置、而是首次启动生成

以下内容更适合在首次使用某个项目时生成：

- 项目索引数据库
- `knowledge-graph.json`
- `.shadow-git`
- `.ai_history.db`
- 每个项目自己的缓存

原因：

- 这些数据与用户项目绑定
- 不能在安装包里提前生成
- 体积会很大
- 需要随着项目变化更新

## 六、建议的目录结构

建议发布后统一采用下面的目录模型：

## 6.1 程序目录

只放应用本身，不放用户数据。

例如：

### Windows

`C:\Program Files\Hub Web\`

### macOS

`/Applications/Hub Web.app`

### Linux

`/opt/hub-web/` 或 AppImage 内部

## 6.2 用户配置目录

放程序设置、环境配置、引擎启用状态。

### Windows

`%APPDATA%\HubWeb\config`

### macOS

`~/Library/Application Support/HubWeb/config`

### Linux

`~/.config/hub-web`

## 6.3 用户数据目录

放数据库、索引、缓存、日志、历史。

### Windows

`%LOCALAPPDATA%\HubWeb\data`

### macOS

`~/Library/Application Support/HubWeb/data`

### Linux

`~/.local/share/hub-web`

## 6.4 建议的数据子目录

例如：

- `data/projects/<project-id>/graph/`
- `data/projects/<project-id>/git/`
- `data/projects/<project-id>/memory/`
- `data/projects/<project-id>/shadow/`
- `data/logs/`
- `data/cache/`

## 七、第一次启动应该做什么

发布版不能要求用户自己准备环境，所以第一次启动需要一个初始化流程。

## 7.1 程序级初始化

- 检查配置目录是否存在
- 检查数据目录是否存在
- 检查内置引擎是否可启动
- 生成默认配置文件

## 7.2 项目级初始化

当用户选择一个本地项目时：

- 建立项目 ID
- 创建项目数据目录
- 运行图谱索引
- 运行 metadata 生成
- 初始化 git/shadow 历史目录
- 初始化 memory 容器

## 7.3 可见化引导

首次初始化必须有可视化状态：

- 正在索引
- 正在生成知识图谱
- 正在准备 Git 历史
- 正在初始化聊天/记忆能力
- 哪一步失败了

## 八、推荐的能力装配策略

不建议发布版继续通过“直接读取兄弟目录”来融合。

建议改成：

## 8.1 Provider 模式

在 `hub-web` 中建立：

- `GraphProvider`
- `GitProvider`
- `ExplanationProvider`
- `MemoryProvider`

发布版中只允许 UI 通过 provider 访问能力，不允许直接引用兄弟源码目录结构。

## 8.2 Engine Registry

增加一个本地引擎注册中心，统一管理：

- 哪个引擎启用
- 哪个引擎版本
- 哪个引擎路径
- 哪个引擎是否健康

这样未来即使要替换：

- `codebase-memory-mcp`
- `codegraph`
- `GitNexus`
- `supermemory`

也不需要重写 UI 层。

## 九、推荐的打包方案

## 9.1 Windows

推荐：

- Electron Builder
- 输出：
  - `nsis` 安装包
  - 或 `portable exe`

建议：

- 普通用户使用安装版
- 内部测试可以给 portable 版

## 9.2 macOS

推荐输出：

- `.dmg`
- `.app`

注意点：

- 代码签名
- notarization
- 内置 runtime 权限
- 访问本地文件夹权限申请

## 9.3 Linux

推荐输出：

- `AppImage`
- `deb`
- `rpm`

建议优先：

- `AppImage`

原因：

- 分发简单
- 用户直接下载就能跑

## 十、发布前必须完成的技术改造

## 10.1 第一批：必须先做

- 去掉 API 中硬编码兄弟目录路径
- 去掉 mock `supermemory-chat`
- 建立统一数据目录
- 建立统一配置目录
- 建立健康检查与降级提示
- 统一项目初始化流程

## 10.2 第二批：发布前强烈建议完成

- 统一图谱真源
- 统一 Git 历史与 AI 历史
- 增加版本迁移逻辑
- 增加日志系统
- 增加崩溃恢复和失败重试

## 10.3 第三批：适合发布后迭代

- 自动更新
- 插件化能力切换
- 引擎替换
- 远程同步与多设备共享

## 十一、分阶段实施路线

## Stage 1：把源码拼装态变成“可启动的单机产品内核”

目标：

- 不再依赖兄弟目录结构
- 本地可以统一启动

任务：

- 统一配置
- 统一数据目录
- provider 抽象
- 健康检查
- 启动流程整理

产出：

- 一个“开发版单机运行壳”

## Stage 2：把单机产品内核变成“可打包桌面程序”

目标：

- 用 Electron 把 `hub-web` 包起来
- 内置后端与引擎

任务：

- 桌面壳接入
- 本地服务管理
- 安装包构建脚本
- 跨平台路径适配

产出：

- Windows / macOS / Linux 内部测试包

## Stage 3：把测试包变成“可交付发布版”

目标：

- 可对外或对团队正式分发

任务：

- 自动升级
- 日志与崩溃收集
- 数据迁移机制
- 完整 E2E 测试
- 签名与发布流程

产出：

- 正式发布版

## 十二、风险点

## 12.1 最大风险：图谱系统双轨

现在 `codebase-memory-mcp` 和 `codegraph` 都在局里。

如果在发布前不统一“谁是图谱真源”，会导致：

- 数据目录混乱
- 文件树与知识图谱来源不一致
- UI 行为不稳定

## 12.2 第二风险：GitNexus 与本地 AI 历史重叠

如果 `.ai_history.db` 和 `GitNexus shadow history` 同时存在且语义不统一：

- diff 结果可能不一致
- 恢复来源会混乱
- 发布后问题更难查

## 12.3 第三风险：supermemory 尚未真实接通

如果把 mock 带进发布版：

- 用户会误以为产品有真实记忆/聊天能力
- 体验会严重失真

## 十三、推荐的现实策略

如果目标是尽快做出可运行发布版，建议采用下面的现实策略：

### 短期

- 先不追求所有系统完全统一
- 先做一个稳定的 Electron 单机版
- 先固定主干为：
  - 图谱：`codebase-memory-mcp`
  - Git：`GitNexus`
  - 元数据：`Understand-Anything`
  - memory：先禁用 mock，后补真接入

### 中期

- 补 provider 抽象
- 收敛图谱真源
- 收敛 AI 历史真源

### 长期

- 再考虑是否切换 `codegraph` 为主图谱引擎
- 再考虑更轻量的桌面壳，例如 Tauri

## 十四、最终建议

如果从“工程投入 / 落地速度 / 跨平台可行性”综合考虑，我的建议是：

### 推荐路线

1. 先把 `hub-web` 从源码拼装态改成单机产品内核
2. 使用 `Electron` 作为第一代桌面壳
3. 先固定一套主干引擎组合，不要继续多图谱并行混用
4. 发布前必须去掉 mock supermemory
5. 把所有用户数据迁移到统一应用数据目录

### 一句话结论

`hub-web` 完全可以整理成面向 Windows、macOS、Linux 的直接运行程序。`

但前提不是“现在直接打包”，而是：

`先把它从 monorepo 拼装态，整理成真正的产品运行态。`

## 十五、建议下一动作

建议立刻开始做这三件事：

1. 先完成 `Phase 0` 运行时稳定化
2. 明确发布版的主引擎组合
3. 新建一套桌面发布目录结构和 Electron 壳 PoC

如果这三步完成，后面做 Windows / macOS / Linux 安装包就是工程问题，不再是架构混乱问题。
