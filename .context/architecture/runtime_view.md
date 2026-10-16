# 运行时视图 (Runtime View)

> **Metadata**
> - **Source**: `.context/architecture/source/technical_architecture.md`（TAD v1.2.0 §3、§4.2、§5）
> - **Generated At**: `2026-10-16 09:44`
> - **Generator**: `Context-Agent v1.0`

---

## 🎯 场景选择原则

仅记录具有**架构显著性**的运行时场景：

- 核心业务链路（排期 → 创作 → 预填 → 发布 → 复盘）
- 复杂交互逻辑（跨进程 / 跨 `await` 的复合 RPC）
- 异常与恢复流程（采集失败、存储不可用）
- **契约守卫的关键路径**（发布 URL 回填闭环）

---

## 📊 场景 1: 排期生成与单向导出

**对应接口**：`workbench.generateCalendar` / `workbench.exportCalendar`

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户（驾驶舱）
    participant WB as Workbench UI
    participant RPC as 宿主 RPC 网关
    participant CE as CalendarEngine
    participant Local as $DSH_HOME/growth-studio/calendar/
    participant IC as InjoysClient
    participant Sheet as Injoys Spreadsheet

    U->>WB: 生成 7 天排期日历
    WB->>RPC: workbench.generateCalendar { period:'week', exportToSheet? }
    RPC->>CE: 路由
    CE->>CE: 结合知识库与 focusVersion 规划
    CE->>Local: 落盘 {itemId}.json（黄金主数据源）
    CE-->>RPC: { items, sheetExported:false }
    RPC-->>WB: 返回排期（exportToSheet 默认 false）

    opt 用户显式确认导出
        U->>WB: 导出至 Injoys 表格
        WB->>RPC: workbench.exportCalendar { period }
        RPC->>IC: spreadsheet.applyOperations
        IC->>Sheet: 按 externalRowId 更新或插入
        alt 已导出过（有 externalRowId）
            Sheet-->>IC: 更新既有行（幂等，不重复插入）
        else 首次导出
            Sheet-->>IC: 插入行 → 返回行标识
            IC->>Local: 回写 externalRowId
        end
        IC-->>RPC: { exportedCount, skippedCount, sheetExported }
        RPC-->>WB: 导出结果
    end
```

### 关键决策点

| 步骤 | 决策 | 失败处理 |
|------|------|---------|
| 4 | 本地落盘为**黄金主数据源** | 落盘失败 → 如实抛错，不谎报成功 |
| 7 | `exportToSheet` **默认 false** | 导出应为用户**显式确认**的动作（PRD §5.1.2 快速行动为「生成 7 天排期日历」） |
| 11 | 幂等判定依据 `externalRowId` | 存在则更新而非重复插入 |
| — | Injoys 未配置 / 网络错误 | 返回 `exportError` 与 `sheetExported: false`，**不谎报** |

---

## 📊 场景 2: 内容创作落盘（跨 await，**两次写入须绑定同一目录**）

**对应接口**：`workbench.generateArticleDraft` / `workbench.generateVideoMeta`

```mermaid
sequenceDiagram
    autonumber
    participant WB as 创作室 UI
    participant RPC as 宿主 RPC 网关
    participant CS as ContentStudioEngine
    participant Dir as 捕获的存储目录（请求开始时固定）
    participant KB as Injoys 知识库
    participant Doc as Injoys Document

    WB->>RPC: workbench.generateArticleDraft { topic, targetPlatform }
    Note over RPC,Dir: ⚠️ 请求开始时捕获 draftsDir 并贯穿全程
    RPC->>CS: 路由（携带已捕获目录）
    CS->>Dir: ① 绑定目录
    CS->>KB: knowledge.list 检索产品知识
    KB-->>CS: 知识内容
    CS->>CS: 生成标题 / 摘要 / 正文 Markdown
    CS->>Dir: ② 首次写草稿 {id}.json（同一目录）
    CS->>Doc: document.create 沉淀物料
    alt 沉淀成功
        Doc-->>CS: injoysDocId
        CS->>Dir: ③ 回写 injoysDocId（仍是同一目录）
        CS-->>RPC: { id, draftSaved:true, injoysDocId }
    else 沉淀失败
        Doc-->>CS: 错误
        CS->>Dir: ③ 仍写回草稿（无 injoysDocId）
        CS-->>RPC: { id, draftSaved:true, injoysDocId:undefined }
    end
    RPC-->>WB: 生成结果
```

### 关键决策点

| 步骤 | 决策 | 失败处理 |
|------|------|---------|
| Note | **目录在请求开始时捕获** | 中途配置切换**不影响**本次请求（否则一次请求会在两个库各留一份同 ID 副本，且实际看到的那份还缺少远端文档关联） |
| ② / ③ | **请求内每一次落盘**都必须绑定同一目录 | 违反则产生跨库副本 |
| 6-7 | 自动存盘只写**本地草稿库** | 与「沉淀至 Injoys」是**两个独立动作** |
| 9 | 沉淀失败不阻断存盘 | `draftSaved:true` 与 `injoysDocId:undefined` 并存，**不谎报** |

> **视频元数据一致行为**：`workbench.generateVideoMeta` 同样返回 `id` 与 `draftSaved`；
> 未成功落盘时 `draftSaved: false` 且 `id` **仍返回**（便于前端重试保存）。
> `titleCandidates` **数量恒为 3**。

---

## 📊 场景 3: 草稿预填（跨 await 复合 RPC + Human-in-the-Loop 边界）

**对应接口**：`workbench.prefillDraft`（客户端工具封装 `ops_push_drafts`）

```mermaid
sequenceDiagram
    autonumber
    participant WB as 创作室 UI
    participant RPC as 宿主 RPC 网关
    participant DM as DraftManager
    participant Dir as 捕获的存储目录
    participant BD as BrowserDriver
    participant BOS as BrowserOS MCP
    participant Plat as 平台后台（公众号 / B站）
    participant User as 用户（人工）

    WB->>RPC: workbench.prefillDraft { draftId, platform }
    Note over RPC,Dir: ⚠️ 请求开始时捕获目录，贯穿读取与回写
    RPC->>DM: 读取草稿（经捕获目录）
    DM-->>RPC: ContentDraft + channelVariants
    RPC->>BD: 执行预填编排
    BD->>BOS: navigate → 平台草稿编辑器
    BD->>BOS: act → 填标题 / 作者 / 正文（或标题/简介/标签/分区）
    Note over BD,Plat: ⛔ 止步于此：仅触发平台原生「保存为草稿」
    BD->>BOS: act → 平台原生「保存为草稿」按键
    BOS->>Plat: 保存为草稿
    Plat-->>BOS: 草稿已保存
    BOS-->>BD: 草稿直达链接
    BD-->>RPC: { draftUrl }
    RPC->>DM: 回写 prefillResults（仍是同一捕获目录）
    RPC-->>WB: { success, draftUrl, message:'已成功预填至草稿箱，请核对预览' }

    Note over User,Plat: === 以下为人工动作，系统不参与 ===
    WB-->>User: 提供草稿直达链接
    User->>Plat: 人工核验并点击平台原生「发布」
```

### 关键决策点

| 步骤 | 决策 | 失败处理 |
|------|------|---------|
| Note | **目录在请求开始时捕获**（本 RPC 会等待 Adapter 很久） | 中间配置切换**不得**把结果写进另一个库的同 ID 草稿 |
| 8 | 分区字段映射：`partition` → 平台控件 | **平台不支持分区时跳过该项而不报错** |
| 11 | **止步于平台原生「保存为草稿」** | ⛔ 不得触发或越过正式发布步骤 |
| 16 | 回写预填结果 | 写盘失败 → `drafts/storage-unavailable`（统一错误边界） |
| Note | 人工发布**完全在系统之外** | 系统唯一可观测信号是随后的 URL 回填 |

---

## 📊 场景 4: 发布 URL 回填闭环（**契约守卫的核心路径**）

**对应接口**：`drafts.updatePublishUrl`

```mermaid
sequenceDiagram
    autonumber
    participant User as 用户
    participant WB as Workbench UI
    participant RPC as 宿主 RPC 网关
    participant DM as DraftManager
    participant Store as 草稿库

    User->>WB: 在平台发布完成后回填真实 URL
    WB->>RPC: drafts.updatePublishUrl { draftId, platform, publishedUrl }
    RPC->>DM: 路由
    DM->>DM: ① URL 解析器校验 http(s) 合法性
    alt URL 非法
        DM-->>RPC: error: drafts/invalid-published-url
        RPC-->>WB: 拒绝（不写盘、不递增版本）
    else URL 合法
        DM->>DM: ② 校验 platform ∈ channelVariants
        alt 渠道不属于该草稿
            DM-->>RPC: error: drafts/unknown-channel
            RPC-->>WB: 拒绝（不写盘、不递增版本）
        else 校验通过
            DM->>Store: ③ 写锁内累加 publishedUrls[platform]
            DM->>DM: ④ 重算整体状态（全渠道不变量）
            alt 全部渠道均已回填
                DM->>Store: status = published
            else 仅部分渠道
                DM->>Store: status 保持 prefilled
            end
            DM-->>RPC: { draft, publishedChannels, totalChannels, allPublished }
            RPC-->>WB: 回填成功
        end
    end
```

### 关键决策点

| 步骤 | 决策 | 失败处理 |
|------|------|---------|
| ① | **须用 URL 解析器校验**，禁止宽松正则 | `drafts/invalid-published-url` |
| ② | 渠道成员校验 | `drafts/unknown-channel`，**不写盘、不递增版本** |
| ③ | 回填是**按渠道**累加写入 | 写盘失败 → `drafts/storage-unavailable` |
| ④ | `ContentDraft.status` 是**整体**状态 | 判定依据恒为「`publishedUrls` 覆盖全部渠道」，**不依赖**调用顺序或次数 |
| — | **不引入** `partially_published` | UI 用 `publishedChannels` / `totalChannels` 派生文案 |

### 全渠道不变量（须在同一写锁内维持）

```mermaid
stateDiagram-v2
    [*] --> Prefilled: 至少一个渠道预填成功
    Prefilled --> Prefilled: 部分渠道回填 URL
    Prefilled --> Prefilled: 新增未回填渠道（已发布 → 回退）
    Prefilled --> Published: 全部渠道均回填有效 URL
    Published --> Prefilled: 渠道集合变化（新增未回填渠道）
    Published --> [*]
```

**孤儿清理**：删除或替换渠道后，不再对应任何当前渠道的 URL 会被**剪除**，
因此移除渠道**不会**让草稿凭残留 URL 继续维持「已发布」假象。

**为什么阻挡 `drafts.save` 写 `published`**

> `published` 代表「已在平台真实发布」，其**唯一可信证据**是用户回填的真实 URL。
> 若允许通用保存入口直接写 `published`，则发布闭环可被绕过，**状态会失去真实性**。
> 该守卫是**服务端**职责，**不得**仅依赖客户端不传该值。

---

## 📊 场景 5: 指标采集与环比计算（**可空语义**）

**对应接口**：`workbench.overview` / `ops_fetch_metrics`

```mermaid
sequenceDiagram
    autonumber
    participant WB as 驾驶舱 UI
    participant RPC as 宿主 RPC 网关
    participant MA as MetricsAggregator
    participant BD as BrowserDriver
    participant BOS as BrowserOS MCP
    participant Hist as metrics/{YYYY-MM-DD}.json

    WB->>RPC: workbench.overview { metricsWindow:'7d' }
    RPC->>MA: 路由
    loop 每个应采平台 P
        MA->>BD: 采集该平台指标
        BD->>BOS: 导航至平台数据页并抓取
        alt 采集成功（含真实 0）
            BOS-->>BD: { impressions, plays, likes, ... }
            BD-->>MA: 有效值（0 也是有效值）
        else 采集失败 / 平台不支持
            BOS-->>BD: 失败 / 不支持
            BD-->>MA: null
        end
    end
    MA->>Hist: 按 (platform, capturedAt) 追加快照
    MA->>MA: 汇总判定
    alt measuredPlatforms == P（全部成功）
        MA->>MA: 汇总值 = 各平台之和
    else measuredPlatforms ⊂ P（部分缺失）
        MA->>MA: 汇总值 = null + 填充 unmeasuredPlatforms
    end
    MA->>Hist: 读取上一个等长窗口快照
    alt 历史覆盖完整对比窗口
        MA->>MA: 计算 delta 百分比
    else 历史不足
        MA->>MA: delta = null（UI 显示「暂无环比」）
    end
    MA-->>RPC: { overviewMetrics, statuses, ... }
    RPC-->>WB: 局部替换（不整页重载）
```

### 关键决策点

| 步骤 | 决策 | 失败处理 |
|------|------|---------|
| 5 | 真实返回 `0` 是**有效值** | 参与求和；`0` 与 `null` 语义**严格区分** |
| 8 | 采集失败 / 不支持 → `null` | **不得**按 0 或估算值伪造填充 |
| 11 | 部分缺失 → 汇总 **`null`** | **不得**只汇总已成功平台冒充全网总量；须填充 `measuredPlatforms` / `unmeasuredPlatforms` |
| 13 | 互动汇总 | `totalEngagements` 在点赞/评论/转发/收藏**任一为 null 时为 null** |
| 16 | 历史不足 → delta `null` | **不得**用不完整历史算近似百分比 |
| 18 | UI 局部替换 | 同一卡片并发刷新须做 **in-flight 去重** |

> **首次使用时全部 delta 为 `null` 属预期行为，不是缺陷。**

---

## 📊 场景 6: 草稿版本恢复（**非破坏性回滚**）

**对应接口**：`drafts.save` / `drafts.listVersions` / `drafts.getVersion` / `drafts.restoreVersion`

```mermaid
sequenceDiagram
    autonumber
    participant WB as 创作室 UI
    participant RPC as 宿主 RPC 网关
    participant DM as DraftManager
    participant Store as 草稿库

    WB->>RPC: drafts.save { draft }
    RPC->>DM: 路由
    DM->>Store: 写锁内：临时文件 + rename 当前版本
    DM->>Store: 同时写 {id}.versions/v{n}.json
    Note over DM,Store: 同一串行写锁内完成<br/>避免「版本号已增但快照缺失」
    DM-->>RPC: { draft }

    WB->>RPC: drafts.listVersions { id }
    RPC->>Store: 扫描 {id}.versions/
    alt 当前版本号 > 最大快照号（旧代码写入的历史数据）
        Store-->>RPC: 如实返回已有快照 + 可用版本列表
    else 一致
        Store-->>RPC: 版本号集合
    end
    RPC-->>WB: { versions }（含 wordCount，无需读全文）

    WB->>RPC: drafts.restoreVersion { id, version }
    RPC->>DM: 路由
    DM->>Store: 读取目标版本全文
    DM->>Store: 以该内容为基础**追加为新版本**（version 继续自增）
    Note over DM,Store: ⛔ 不做破坏性回滚：历史版本一律保留<br/>因此恢复操作本身也可被再次恢复
    DM-->>RPC: { draft }
```

### 关键决策点

| 步骤 | 决策 | 失败处理 |
|------|------|---------|
| 5-6 | 当前版本与快照在**同一串行写锁内**完成 | 避免「版本号已增但快照缺失」 |
| 6 | 快照同样「临时文件 + rename」 | 与当前版本文件保持一致的原子保证 |
| 12 | 版本号与快照不一致时 | **如实返回已有快照**，**不得伪造缺失版本** |
| 17 | **不做破坏性回滚** | 恢复 = 追加新版本；历史一律保留，恢复本身可再恢复 |
| — | Phase 0 **保留全部版本** | **不自动淘汰**；若需上限须先在 PRD 定义 |
| — | `drafts.delete` **级联删除** | `{id}.json` 与整个 `{id}.versions/` 目录一并清除 |

---

## 📊 场景 7: `draftsDir` 切换与在途操作

**对应接口**：`config.save` / 所有写入口

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户（引擎配置页）
    participant WB as Workbench UI
    participant RPC as 宿主 RPC 网关
    participant CS as ConfigStore
    participant Op as 在途草稿操作（如 prefillDraft）
    participant Old as 原目录
    participant New as 新目录

    Note over Op,Old: 在途操作已捕获原目录并贯穿全程
    U->>WB: 修改 draftsDir
    WB->>RPC: config.save { draftsDir }
    RPC->>CS: 前置校验
    CS->>New: 创建目录 + 写探测文件并删除（验证可写）
    alt 目录不可用（含已存在但只读）
        CS-->>RPC: error: config/invalid-drafts-dir
        RPC-->>WB: ⛔ 拒绝保存（不先报成功）
    else 校验通过
        CS->>CS: 持久化配置
        CS-->>RPC: { success:true, config }
        RPC-->>WB: 保存成功
    end
    Note over Op,New: 在途操作继续写原目录（确定语义，非异常）
    Note over RPC,New: 仅新发起的操作使用新目录
```

### 关键决策点

| 步骤 | 决策 | 失败处理 |
|------|------|---------|
| 5 | **仅检查「目录存在」不够** | 已存在但只读的目录会让 `mkdir` 成功却在首次写入时失败 |
| 5 | 校验方式 | 在目标目录创建并删除一个**唯一命名**的探测文件 |
| 7 | 失败**拒绝保存** | 返回 `config/invalid-drafts-dir`；**不得**先返回成功、再让 `drafts.save` 以 `ENOENT` 失败 |
| 10 | 在途操作写原目录是**确定行为** | **不引入** `dirChangedDuringSave` 告警标记，不当作错误上报 |
| — | 配置页提示文案（须覆盖三件事实） | 「新目录对后续操作生效；正在进行的保存仍写入原目录。旧草稿不会自动迁移。」 |
| — | 旧目录草稿 | **不做自动迁移**（避免大目录复制与部分失败风险） |

### 目录固定范围（易错点）

```mermaid
graph LR
    A["请求开始<br/>捕获 draftsDir"] --> B["加锁"]
    B --> C["读取草稿"]
    C --> D["版本校验"]
    D --> E["写临时文件"]
    E --> F["rename"]
    F --> G["回写结果<br/>（如 prefillResults / injoysDocId）"]
    G --> H["请求结束"]

    style A fill:#7c3aed,color:#fff
    style G fill:#7c3aed,color:#fff
```

> **贯穿范围包括「请求内的每一次落盘」**。
> 反例：`workbench.generateArticleDraft` 在等待知识库后才首次写草稿、再等远端文档后写 `injoysDocId`；
> 若两次写入绑定不同目录，一次请求会在两个库里**各留一份同 ID 副本**（实际看到的那份还缺少远端文档关联）。

---

## 📊 场景 8: 统一 BrowserOS 实例的会话探测

**对应接口**：`browser.sessions`

```mermaid
sequenceDiagram
    autonumber
    participant WB as 驾驶舱 UI
    participant RPC as 宿主 RPC 网关
    participant SG as SessionGuard
    participant BOS as BrowserOS MCP（统一实例）
    participant Plat as 平台验签 URL

    WB->>RPC: browser.sessions
    RPC->>SG: 路由
    loop 每个平台
        SG->>BOS: 查询当前活跃 Tab 或后台导航至验签 URL
        BOS->>Plat: 访问（微信公众号后台 / B站创作平台）
        alt 页面特征 / 网络响应显示已登录且有权限
            SG->>SG: authenticated（isReady=true）
        else 未登录或会话失效
            SG->>SG: needs_login
        else 已登录但无发布/创作者权限
            SG->>SG: no_publish_permission
        else 探测失败 / 不确定
            SG->>SG: unknown
        end
    end
    SG-->>RPC: { statuses: [{ platform, state, isReady, ... }] }
    RPC-->>WB: 四态如实返回
```

### 关键决策点

| 步骤 | 决策 | 失败处理 |
|------|------|---------|
| 4 | **统一实例绑定** | 登录态探测、草稿箱预填与大屏指标采集由**同一个** BrowserOS MCP 实例调度 |
| 5 | **轻量探测**（存在性 / 状态判定） | 不导出 Cookie 内容 |
| 6-9 | **四态流转** | 严格返回四态，**严禁退化为 boolean，杜绝假阳性** |
| — | UI 表现 | 未登录平台一律提供 `去登录 ↗` 快捷外链；`unknown` 时引导用户在当前 BrowserOS 实例中直接扫码登录 |

### 原方案缺陷（已被否决）

| # | 问题 | 后果 |
|---|------|------|
| 1 | **实例不一致** | 日用 Chrome 与 BrowserOS MCP 是完全不同的浏览器环境与用户目录；在 Chrome 探测到 Cookie **根本不能保证** BrowserOS 执行预填时已登录 → 工作台呈现「就绪」**假象** |
| 2 | **SQLite WAL 不完整** | 直接复制 `Cookies` 主文件未同步 `Cookies-wal` / `Cookies-shm`；Chrome 处于活跃写状态时容易**漏检最新 Cookie** |
| 3 | **隐私与安全** | 拷贝并挂载整个 SQLite 库会使**所有个人 Cookie 进入内存**，与「仅存在性探测」的隐私承诺存在落差 |

---

## ⚠️ 异常与恢复

| 异常场景 | 触发条件 | 恢复策略 |
|---------|---------|---------|
| **草稿目录不可写** | 目录只读 / 创建失败 | 统一错误边界返回 `drafts/storage-unavailable`（**所有写入口一致**）；**不吞异常、不谎报成功** |
| **`config.save` 目标目录不可用** | 已存在但只读 / 无法创建 | 前置探测文件校验失败 → **拒绝保存** `config/invalid-drafts-dir` |
| **配置在操作中途切换** | 用户在复合 RPC 期间改 `draftsDir` | 在途操作**继续写原目录**（确定语义）；新操作才用新目录 |
| **Injoys 未配置** | 无令牌 | `injoys.test` 返回「尚未配置令牌」提示，**不得**发出请求并谎报「认证失败」 |
| **Injoys 沉淀失败** | 网络 / 服务错误 | `sinkToInjoysDoc` 返回 `success:false` 与真实错误；**不得**谎报成功或写本地假 ID |
| **平台采集失败** | 页面结构变化 / 未登录 | 该平台指标为 `null`；汇总为 `null` 并填充 `unmeasuredPlatforms` |
| **排期导入部分失败** | 远端行冲突 / 网络错误 | **不回滚已成功项**，如实返回已导入计数与 `conflicts`，**不谎报全量成功** |
| **工具被禁用** | `enabled === false` | 宿主侧拒绝并返回 `tools/disabled`；**不得**依赖前端隐藏按钮 |
| **版本快照缺失** | 历史数据由旧版本代码写入 | `listVersions` **如实返回已有快照**与可用版本列表，**不得伪造缺失版本** |
| **会话状态不确定** | 探测失败 | 返回 `unknown`（**不猜测**），UI 引导用户手工登录 |
| **并发刷新** | 用户连点同一卡片 | in-flight 合并去重，避免会话探测与指标采集重复执行 |

---

## 🔗 相关文档

| 文档 | 关系 |
|------|------|
| `api_strategy.md` | 场景涉及的接口契约与错误码 |
| `data_architecture.md` | 状态机与持久化布局 |
| `security_policy.md` | 场景中的契约守卫语义 |
| `container_component_view.md` | 场景参与者的组件归属 |
| `risks_and_debt.md` | 异常场景对应的风险条目 |
| `source/technical_architecture.md` | **源文档（冲突时以此为准）** |

---

## AI 引用指南

当 AI 实现运行时逻辑时：
1. 涉及**跨 `await`** 的复合 RPC，必须在**请求开始时**捕获存储目录并贯穿**每一次落盘**
2. 预填流程**止步于平台原生「保存为草稿」**，绝不可越过发布步骤
3. `published` 状态只能经 `drafts.updatePublishUrl` 推进，且须在**同一写锁内**维护全渠道不变量
4. 指标缺失一律 `null`；真实 `0` 是有效值；历史不足时 delta 为 `null`
5. 写盘失败统一经**统一 RPC 错误边界**映射为 `drafts/storage-unavailable`
6. 会话状态必须四态返回，**严禁退化为 boolean**
7. 目录切换期间的在途操作写原目录是**预期语义**，不得作为错误上报
