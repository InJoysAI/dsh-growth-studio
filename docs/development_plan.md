# 个人产品增长推广工坊（Growth Studio / dsh-growth-studio）开发与落地计划

> **2026-10-16 MVP 范围裁决**：内容生成只保存本地；生成物料写入 Injoys 须由用户明确触发。草稿只保留当前内容，不提供历史查看、恢复或版本快照；保留版本自增与乐观锁。此项为文档决策，不表示现有实现已完成对齐。

## 一、 项目背景与架构定位

本项目旨在为独立开发者与个人产品打造一套**闭环运营增长引擎**，作为 **DeepSeek Harness (DSH)** 的原生 Cordis 插件运行在 `packages/experimental/ops-manager`（产品代号：`dsh-growth-studio` / Growth Studio）。

该插件充当**运营控制中枢（Orchestrator）**：
1. **输入端（Injoys MCP & 本地持久化）**：检索产品知识库（卖点/调性/Changelog），管理全局发布排期表与多渠道内容草稿；
2. **执行端（BrowserOS MCP）**：通过统一的 BrowserOS 浏览器实例，自动将图文与视频预填至各平台后台草稿箱；
3. **审核端（DSH Client UI）**：通过富文本卡片呈现各渠道草稿直达链接，坚守 Human-in-the-loop 人机协同安全底线；
4. **调度端（DSH Schedule）**：无缝挂载系统「自动化任务」，到点定时唤醒会话执行巡检；
5. **数据与反馈端（Analytics & Feedback）**：采集平台数据大屏、提取评论区用户建议，反哺产品迭代。

```mermaid
graph TD
    subgraph DSH [DeepSeek Harness 运行时]
        Schedule[系统自动化任务 Schedule] -->|定时唤醒| OpsEngine[Growth Studio 核心引擎]
        Chat[用户会话交互 / 指令] --> OpsEngine
        OpsEngine --> UICard[DSH 客户端审核卡片 / 工作台 UI]
    end

    subgraph Storage [本地持久化 + Injoys 资产]
        OpsEngine <--> LocalDrafts["本地草稿库 ($DSH_HOME/growth-studio/drafts/)"]
        OpsEngine <--> KB[产品知识库: 卖点/调性/FAQ]
        OpsEngine <--> Sheet[发布排期与指标监控表 (单向导出/导入)]
        OpsEngine <--> Doc[公众号图文 / 视频分镜文档]
    end

    subgraph BrowserOS [BrowserOS MCP - 浏览器执行引擎]
        OpsEngine --> BOSSession[BrowserOS 统一会话哨兵]
        OpsEngine --> Adapter[平台适配器接口层 Adapter Pattern]
        Adapter --> WxArticle[微信公众号后台草稿]
        Adapter --> Bili[B站创作者中心草稿]
        Adapter -.-> Phase1[Phase 1: 视频号 / 抖音]
        Adapter -.-> Phase2[Phase 2: X / YouTube / Product Hunt]
    end
```

---

## 二、 现状与实现基线状态矩阵 (Implementation Baseline Matrix)

> 基于 2026-10-13 静态评审核实，全面盘点当前源码实现基线，明确阶段归属与重构方向。

| 模块 / 组件 | 源码路径 | 文档规格描述 | 当前代码实际实现 | 状态评级 | 交付阶段 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BrowserDriver** 预填编排 | `src/browser/browser-driver.ts` | 编排 BrowserOS 执行真实多字段/附件预填 | 严格导航错误立即终止；逐项校验必要字段（标题/正文/描述缺失直接报错，阻断假成功保存）；仅采纳远端草稿 ID，移除本地假 ID | 🟡 契约就绪，待 Live 验收 | **Phase 0**（公号+B站） |
| **SessionGuard** 会话探测 | `src/browser/session-guard.ts` | 探测 BrowserOS 实例登录态，支持四态流转 | 四态枚举与 Tab 探活逻辑已就绪，待绑定活动 BrowserOS 实例 | 🟡 契约就绪，待 Live 验收 | **Phase 0**（统一BrowserOS） |
| **MetricsCollector** 指标采集 | `src/analytics/metrics-collector.ts` | 从各平台大屏采集真实指标，区分曝光/播放 | 已重构为严格可空语义（离线返回 null，mock 显式隔离）；各平台大屏真实 DOM 解析器待接入 | 🟡 待实现 | **Phase 0**（公号+B站） |
| **InjoysClient.listCalendarItems** | `src/injoys/client.ts` | 读取 Injoys 排期表格行 | 已接入 `spreadsheet.read` 远端调用，错误不吞，如实抛出 | 🟢 已实现 | **Phase 0**（表格读取） |
| **InjoysClient.syncCalendarItem** | `src/injoys/client.ts` | 排期行幂等写入与错误抛出 | 串行写锁 + 目标隔离已知 ID 缓存 + 任务期连接配置锁定（防中途热更新割裂读写） + updateRow 命中行数校验兜底 | 🟢 已实现 | **Phase 0**（单向导出） |
| **InjoysClient.testConnection** | `src/injoys/client.ts` | 连通性测试 | 真实发起 HTTP 请求并校验状态码 | 🟢 已实现 | 基线已就绪 |
| **InjoysClient.invokeTool** | `src/injoys/client.ts` | 通用 MCP JSON-RPC 调用 | 真实向 MCP 发起请求，严格校验 HTTP 状态与 `result.isError` | 🟢 已实现 | 基线已就绪 |
| **ContentDraft** 本地持久化 | `src/storage/draft-store.ts` | 草稿实体、平台变体、乐观锁、本地存盘 | 原子写入、串行写锁保护内部回写、`expectedVersion` 并发控制 | 🟢 已实现 | **Phase 0** |
| **AI 内容生成管线** | `src/tools/index.ts` | 结合 Injoys 知识库与 LLM Prompt 深度生成图文 | 基础契约接入 DraftStore；真实 LLM Prompt 动态生成待接入 | 🟡 待实现 | **Phase 0** |
| **客户端草稿工作台 UI** | `plugin-src/client/` | 可视化草稿箱管理、多变体编辑与预填操作入口 | 当前仅具备配置页与基础概览，草稿管理工作台 UI 待接入 | 🔴 待实现 | **Phase 0** |
| **AdapterRegistry** 适配器注册 | `src/adapters/registry.ts` | 8 平台基础配置信息与驱动注入 | 完整元数据定义，支持注入与热更新 BrowserOS 驱动 | 🟢 已实现 | 基线已就绪 |
| **WeChatArticleAdapter** 适配器 | `src/adapters/registry.ts` | 微信公众号图文草稿箱预填 | 逻辑框架与 BrowserDriver 注入已就绪，待在 Live BrowserOS 环境联调 | 🟡 契约就绪，待 Live 验收 | **Phase 0** |
| **BilibiliVideoAdapter** 适配器 | `src/adapters/registry.ts` | B站视频元数据预填 | 逻辑框架与 BrowserDriver 注入已就绪，待在 Live BrowserOS 环境联调 | 🟡 契约就绪，待 Live 验收 | **Phase 0** |
| **CommentsCrawler** 评论抓取 | `src/feedback/comments-crawler.ts` | 真实抓取多平台评论数据 | 生成固定 mock 评论数组 | 🔴 占位待实现 | **Phase 1** |
| **IssueExtractor** 需求提炼 | `src/feedback/issue-extractor.ts` | 真实聚类 Bug / Feature | 简单的静态正则匹配与假数据聚类 | 🔴 占位待实现 | **Phase 1** |
| **ReviewReporter** 复盘报告 | `src/analytics/review-reporter.ts` | 基于真实指标计算爆款率与总结 | 算法可用，依赖 live MetricsCollector 数据流 | 🟡 待连通真实数据 | **Phase 1** |
| **BrowserOS 独立认证窗/Profile** | `docs/technical_architecture.md` | CDP 截取二维码与指定独立 profile 启动小窗 | 未进行任何实际 BrowserOS 环境 PoC 验证 | 🔬 需 PoC 验证 | **Phase 2** |
| **Injoys 双向冲突仲裁** | `docs/technical_architecture.md` | 复杂分布式双向同步 | 未实现，存在数据覆盖风险 | 🔨 规划中 | **Phase 3** |

---

## 三、 四阶段分步实施里程碑

> [!IMPORTANT]
> **当前交付结论**：部分整改已落实，仍有代码缺陷与实现缺口；修复后再进入真实环境验收。

### Phase 0：双平台最小完整闭环 (M0: WeChat MP + Bilibili Minimal Closed Loop)
* **核心目标**：打通 **"微信公众号 + 哔哩哔哩"** 两个高价值平台的端到端闭环：**排期读取/导出 ➔ AI 文案生成 ➔ 本地持久化与多渠道微调 ➔ BrowserOS 真实草稿箱预填 ➔ 人工确认发布后回填 URL ➔ 真实基础指标采集**。
* **开发任务**：
  1. **安全契约统一**：
     * 彻底从 PRD、架构文档与工具注册中心移除 `ops_publish_now`；
     * 确立“工作台始终仅预填草稿，发布操作必须由人工在平台后台完成”铁律；发布后通过回填 URL 驱动状态流转为 `published`。
  2. **会话体系重构（绑定 BrowserOS 统一实例）**：
     * 停止在 Phase 0 使用日用 Chrome SQLite 探测；
     * 重构 `SessionGuard`：通过 BrowserOS MCP 的 `tabs` 与页面探测，统一检测当前 BrowserOS 实例对微信公众号（`mp.weixin.qq.com`）与 B站（`member.bilibili.com`）的登录态；
     * 规范四态生命周期：`unknown` (未知) ➔ `needs_login` (需登录) ➔ `authenticated` (已认证) ➔ `no_publish_permission` (无权限)。
  3. **内容持久化引擎 (`ContentDraftStore`)**：
     * 新增 `src/storage/draft-store.ts`，管理本地 JSON 文件存储路径 `$DSH_HOME/growth-studio/drafts/`；
     * 实现草稿增删改查、版本自增、乐观锁并发控制、多平台变体统一持久化；MVP 每个草稿只写 `{id}.json`，不写版本快照、不提供历史查看和恢复。生成只保存本地；用户明确要求沉淀时才调用 Injoys 并回写关联。
  4. **BrowserDriver 真实对接 BrowserOS**：
     * 实现真实的 BrowserOS MCP 驱动：`tabs` ➔ `navigate` ➔ `snapshot` ➔ `act`；
     * 对微信公众号实现创建新图文并预填标题、作者、正文；
     * 对 B站创作者平台实现预填视频标题、简介、标签与分区；
     * 严禁无客户端或执行失败时虚报成功。
  5. **InjoysClient 排期表格真实读写**：
     * 实现 `listCalendarItems`：调用 Injoys MCP 的 `spreadsheet.read` 读取排期；
     * 实现 `syncCalendarItem`：调用 Injoys MCP 的 `spreadsheet.applyOperations`，支持幂等去重与错误透传。
  6. **指标采集真实改造**：
     * 修正指标定义：将 `views` 拆分为可空的 `impressions`（曝光/阅读）与 `plays`（播放量）；
     * 首版通过 BrowserOS 访问创作者后台真实采集公众号与 B站数据；无法获取的字段设为 `null` 而非硬编码伪造数据。
* **验收条件（待 Live 实测）**：
  * [ ] 在 BrowserOS 中登录公众号与 B站后，工作台状态准确呈现 `authenticated`；
  * [ ] AI 生成的公众号文章在本地生成持久化 JSON 草稿，并支持二次编辑存盘；
  * [ ] 点击“预填草稿”，BrowserOS 真实将内容注入微信公众号后台，后台草稿列表可见该草稿；
  * [ ] 点击“预填草稿”，BrowserOS 真实将 B站视频标题和简介填入创作者页面；
  * [ ] 人工发布后填入平台 URL，排期与草稿状态变为 `published`；
  * [ ] 排期行能真实写入 Injoys Spreadsheet 并读取回显。

---

### Phase 1：国内全平台与舆情反哺 (M1: Domestic Channels & Feedback Loop)
* **核心目标**：扩展至国内四大平台（新增视频号与抖音），接入真实评论区抓取与需求池自动沉淀。
* **开发任务**：
  1. **国内平台补齐**：
     * 实现 `ChannelsVideoAdapter`（微信视频号助手视频上传与文案预填）；
     * 实现 `DouyinVideoAdapter`（抖音创作者服务平台视频上传与文案预填）；
  2. **舆情与评论真实采集**：
     * 改造 `CommentsCrawler`：调用 BrowserOS 抓取公众号留言与 B站评论区真实文本；
     * 改造 `IssueExtractor`：结合模型 prompt 对抓取到的真实评论进行 Bug 聚类与 Feature 需求提炼；
  3. **复盘报告连通真实数据**：
     * `ReviewReporter` 使用真实的 `MetricsCollector` 数据计算多渠道表现，输出格式化复盘周报并写入 Injoys 文档。
* **验收条件**：
  * 国内四大平台草稿预填均能真实成功；
  * 能从已发布的公号文章或 B站视频中抓取不少于 10 条真实用户评论，提炼出至少 1 条需求并输出为表格。

---

### Phase 2：出海平台扩展与技能预设 (M2: Global Expansion & Preset Skills)
* **核心目标**：覆盖海外 4 大分发矩阵（YouTube, Twitter/X, Product Hunt, TikTok），支持内置场景技能包编排，并完成 BrowserOS 高级能力 PoC。
* **开发任务**：
  1. **出海平台适配器**：
     * `YouTubeAdapter`（YouTube Studio 视频上传与多语言元数据）；
     * `TwitterXAdapter`（推文串 Thread 预填）；
     * `ProductHuntAdapter`（Launch 物料包生成与表单辅助）；
     * `TikTokAdapter`（海外版短视频创作者中心）；
  2. **BrowserOS 高级特性验证与 PoC**：
     * 开展 PoC 验证：通过 CDP 截取登录二维码 Base64 反推给客户端；
     * 开展 PoC 验证：拉起独立 headful 前台窗口完成滑块/2FA 交互；
     * 输出 BrowserOS PoC 可行性报告与边界定义。
  3. **技能工坊预设**：
     * 提供内置 5 大场景技能包（新版本发布、日常干货长图文、短视频矩阵引流、出海 Product Hunt Launch、每周舆情复盘）；
     * 实现基于工具白名单的上下文裁剪。

---

### Phase 3：高级治理与双向同步 (M3: Advanced Governance & Two-Way Sync)
* **核心目标**：实现复杂企业级协同能力，包括 Injoys 复杂双向同步、批量任务调度治理与自定义 Skill 编辑器。
* **开发任务**：
  1. **Injoys 完整双向同步**：
     * 引入本地与云端行映射（Mapping Table）与版本时间戳；
     * 制定基于“最后修改者优先 (LWW)”与冲突标记的完整同步规则；
  2. **批量长任务调度引擎**：
     * 为批量预填提供 Task ID、进度条、取消操作与断点续传能力；
  3. **自定义技能包编辑器与 MCP 动态挂载**：
     * 提供可视化 Skill Studio 创建自定义技能；
     * 支持动态监听与热插拔第三方 MCP 服务器。

---

## 四、 核心数据模型更新 (Phase 0 基础)

### 4.1 会话状态四态流转 (SessionState)
```typescript
export type SessionState = 
  | 'unknown'                 // 未探测或探测中
  | 'needs_login'             // 明确未登录或会话已过期
  | 'authenticated'           // 会话有效，具备操作权限
  | 'no_publish_permission'   // 已登录但账号无发布/创作者权限

export interface PlatformSessionStatus {
  platform: PlatformId
  state: SessionState
  isReady: boolean            // 辅助计算属性: state === 'authenticated'
  accountName?: string
  lastCheckedAt: string
  message: string
}
```

### 4.2 本地草稿实体 (ContentDraft)
```typescript
export interface ContentDraft {
  id: string                  // 唯一草稿标识，如 "draft_20261013_abc123"
  title: string
  topic: string
  targetAudience?: string
  channelVariants: Array<{
    platform: PlatformId
    kind: 'article' | 'video' | 'post'
    title: string
    body: string
    tags: string[]
    mediaPaths?: string[]
    coverPath?: string
  }>
  status: 'draft' | 'ready_for_review' | 'prefilled' | 'published'
  version: number
  injoysDocId?: string
  prefillResults?: Record<PlatformId, { draftId?: string; draftUrl?: string; prefilledAt: string }>
  publishedUrls?: Record<PlatformId, string>
  createdAt: string
  updatedAt: string
}
```

### 4.3 KPI 指标语义修正 (PlatformMetrics)
```typescript
export interface PlatformMetrics {
  platform: PlatformId
  capturedAt: string
  impressions: number | null   // 曝光/阅读人次（图文/推文主要指标）
  plays: number | null         // 视频播放次数（视频平台主要指标）
  likes: number | null
  comments: number | null
  shares: number | null
  favorites?: number | null
  followerDelta?: number | null
  topPostTitle?: string
  views: number                // 兼容老代码: impressions ?? plays ?? 0
}
```

---

## 五、 关键风险与工程防线

1. **平台登录态与统一实例防线**：
   * 严禁混合使用“宿主外部 Chrome”与“后台 BrowserOS”两个不同浏览器实例；
   * 首版由工作台引导用户直接在 BrowserOS 环境中完成扫码登录，确保预填时 Session 100% 生效。
2. **安全防线（永远不自动确认发布）**：
   * 严格禁止在 BrowserOS 中自动触发各平台的“正式群发 / 发布”按键；
   * 预填完成后统一提示用户“草稿已填好，请人工检查预览后点击发布”。
3. **DOM 变动与页面防护**：
   * 采用语义定位结合 Snapshot 观察，各平台 Adapter 彻底解耦；
   * 针对富文本注入采用模拟粘贴与标准 input 事件分发，杜绝框架脏检查未触发导致的草稿空白问题。
