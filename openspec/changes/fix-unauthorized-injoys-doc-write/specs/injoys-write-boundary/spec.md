## ADDED Requirements

### Requirement: 生成路径不得写入 Injoys 文档

生成类方法（`workbench.generateArticleDraft`、`ops_draft_article`、`ops_draft_video_meta`、`ops_draft_launch_kit`）MUST NOT 经 `InjoysClient` 的 `saveArticleDocument` / `saveVideoDocument` / `saveLaunchKitDocument` 调用 `document.create` 写入 Injoys；知识库读取不受此限制。其中三个内容入口（`workbench.generateArticleDraft`、`ops_draft_article`、`ops_draft_video_meta`）MUST 继续把物料保存至本地草稿库；`ops_draft_launch_kit` 本轮 MUST 保留既有的生成结果返回，且 MUST NOT 新增草稿持久化（其持久化属 Phase 2 能力）。依据：`.context/criterion.md` §4「内容写入边界」（`:210`）与 §3.5（`:178`）；`.context/architecture/api_strategy.md` §3.1 `workbench.generateArticleDraft` 的「MVP 写入边界」（`:298`）与 `workbench.generateVideoMeta` 的「生成只保存本地」（`:326`）。本要求对应验收项「生成不写远端」与「海外 Launch 不写远端」。

#### Scenario: 生成图文后不产生远端写入

- **GIVEN** 用户仅触发物料生成，未点击「沉淀至 Injoys 知识文档」也未提出写入要求
- **WHEN** 调用 `workbench.generateArticleDraft` 或 `ops_draft_article`
- **THEN** MUST NOT 向 Injoys 发出 `document.create` 请求
- **AND** 物料 MUST 仍保存至本地草稿库，响应中的 `id` / `title` / `wordCount` / `draftSaved` 语义不变
- **AND** 响应的 `injoysDocId`（`workbench.generateArticleDraft`）与 `docId`（`ops_draft_article`）MUST 为**未设置状态（`undefined`）**，MUST NOT 为任何文档编号（二者在 `output.schema` 中均非 required）

#### Scenario: 生成视频元数据后不产生远端写入（工具入口）

- **GIVEN** 用户仅触发视频元数据生成
- **WHEN** 调用 `ops_draft_video_meta`
- **THEN** MUST NOT 向 Injoys 发出 `document.create` 请求
- **AND** 响应 MUST 仍返回 `videoPath`、`titleVariant1` / `titleVariant2` / `titleVariant3`、`tags` 与 `description`
- **AND** 物料 MUST 已落盘为本地草稿

#### Scenario: 生成视频元数据后不产生远端写入（RPC 入口）

- **GIVEN** 用户仅触发视频元数据生成
- **WHEN** 调用 `workbench.generateVideoMeta`
- **THEN** MUST NOT 向 Injoys 发出 `document.create` 请求
- **AND** 响应 MUST 仍返回 `id`、`draftSaved: true`、数量恒为 3 的 `titleCandidates`、`description`、`tags` 与可选 `partition`
- **AND** MUST NOT 把工具入口的 `videoPath` / `titleVariant1`–`titleVariant3` 形状套用到本入口（两个入口的响应契约各自独立）

#### Scenario: 海外 Launch 物料生成不得写入 Injoys，且本轮不新增持久化

- **GIVEN** 海外 Launch 物料生成路径已存在（`ops_draft_launch_kit`）
- **WHEN** 用户仅触发物料生成
- **THEN** MUST NOT 经 `InjoysClient.saveLaunchKitDocument` 发出 `document.create` 请求
- **AND** MUST NOT 返回真实文档编号，也 MUST NOT 返回时间戳伪造编号（如 `doc_launch_<时间戳>`）
- **AND** 响应 MUST 保留既有的生成结果（`tagline` / `makerComment` / `twitterThread` / `timezoneAdvice` / `summaryMarkdown`）
- **AND** MUST NOT 在本轮新增草稿持久化（Launch 物料持久化属其 Phase 2 能力）
- **AND** 在 `output.schema` 仍把 `injoysDocId` 声明为 `required` 字符串期间，该字段 MUST 为空串（`''`）以表示未沉淀；该字段的可空化与 `required` 取消属 `fix-doc-id-fabrication` 的收口范围

### Requirement: 复盘路径不得写入 Injoys 文档

`ReviewReporter.generateReview` 与 `ops_generate_review` MUST 只生成本地复盘结果（作为返回值，不落盘为草稿、不写远端），MUST NOT 调用 `InjoysClient.saveReviewDocument` 写入 Injoys，也 MUST NOT 因此回写 `WeeklyReviewReport.injoysDocId`。依据：`.context/criterion.md` §4「内容写入边界」（`:210`）；`.context/architecture/api_strategy.md` §3.1 `workbench.sinkToInjoysDoc` 的「唯一授权入口 / 该动作独立于自动存盘」口径。本要求对应验收项「复盘不写远端」。

#### Scenario: 复盘生成不发出无条件的远端写入

- **GIVEN** 用户触发周度复盘
- **WHEN** `ReviewReporter.generateReview` 执行完成
- **THEN** MUST NOT 向 Injoys 发出无条件的 `saveReviewDocument` 请求
- **AND** MUST NOT 产生新的本地草稿文件（本变更不为复盘新增落盘）
- **AND** 复盘结果 MUST 照常返回（`totalViews` / `overallEngagementRate` / `viralRate` / `topPerformers` / `keyLearnings` / `nextActions`）
- **AND** `report.injoysDocId` MUST 为未设置状态（生成阶段不填充该字段）

### Requirement: 工具描述与 README 功能说明必须与「生成只保存本地」一致

`ops_*` 工具的 `description` 与 `README.md` 的功能说明 MUST 如实描述写入边界，MUST NOT 把写入 Injoys 文档描述为生成的副作用。**落盘承诺按入口区分**：图文 / 视频类产物（`ops_draft_article`、`ops_draft_video_meta`）MUST 说明保存至本地草稿库；复盘产物（`ops_generate_review`）只生成并返回结果，MUST NOT 声称已保存本地草稿文件。文案 MAY 说明「写入 Injoys 文档须用户显式触发」——该表述描述的是授权边界，MUST NOT 被视为违反本条。依据：`.context/criterion.md` §4「内容写入边界」；`.context/domain/business_rules.md` BR-030 / BR-033 / BR-040。本要求对应验收项「文案一致」。

#### Scenario: 描述文案按入口如实说明落盘与写入边界

- **GIVEN** 工具目录中列出 `ops_draft_article`（图文）与 `ops_generate_review`（复盘）
- **WHEN** 读取两者的 `description`
- **THEN** `ops_draft_article` 的 `description` MUST 说明产物保存至本地草稿库
- **AND** `ops_generate_review` 的 `description` MUST 说明生成并返回复盘结果，MUST NOT 声称已保存本地草稿文件
- **AND** 两者 MUST NOT 再出现「保存为 Injoys 文档」「存入 Injoys 文档」「沉淀至 Injoys 文档」这类把远端写入描述为生成副作用的表述

#### Scenario: README 功能说明不再声称生成即沉淀

- **GIVEN** 本变更落地后生成与复盘路径均不再写入 Injoys 文档
- **WHEN** 检索 `README.md` 的核心功能与工具列表
- **THEN** `README.md` MUST NOT 再出现「保存为 Injoys 文档」「存入 Injoys 文档」「沉淀至 Injoys 文档」这类表述
- **AND** 图文 / 视频相关条目 MUST 说明产物保存至本地草稿库
- **AND** 复盘相关条目 MUST NOT 声称已保存本地草稿文件（MUST 说明生成并返回复盘报告）
- **AND** 若条目提及写入 Injoys 文档，MUST 说明须用户显式触发

### Requirement: Injoys 文档写入能力必须保留

`InjoysClient` 的 `saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` / `saveLaunchKitDocument` MUST 保留，供用户显式触发的沉淀入口（`workbench.sinkToInjoysDoc`）复用；本变更移除的是生成 / 复盘路径的**调用**，不是能力本身（`.context/architecture/api_strategy.md` §3.1 `workbench.sinkToInjoysDoc`；`.context/architecture/risks_and_debt.md` TD-008「解决方案」①）。本要求对应验收项「能力保留」。

#### Scenario: 显式调用时写入能力仍可用

- **GIVEN** 调用方显式调用 `InjoysClient.saveArticleDocument`
- **WHEN** 知识库已连通
- **THEN** 该方法 MUST 仍经 `document.create` 发起远端写入并返回文档编号
- **AND** 生成 / 复盘路径 MUST NOT 因移除调用而使该能力不可用或被删除
