## ADDED Requirements

### Requirement: 生成路径不得写入 Injoys 文档

生成类方法（`workbench.generateArticleDraft`、`ops_draft_article`、`ops_draft_video_meta`、`ops_draft_launch_kit`）MUST 只保存本地草稿，MUST NOT 经 `InjoysClient` 的 `saveArticleDocument` / `saveVideoDocument` / `saveLaunchKitDocument` 调用 `document.create` 写入 Injoys；知识库读取不受此限制（`.context/criterion.md` §4「内容写入边界」；`.context/architecture/api_strategy.md` §3.1 `workbench.generateArticleDraft` 的「MVP 写入边界」）。本要求对应验收项「生成不写远端」与「海外 Launch 不写远端」。

#### Scenario: 生成图文后不产生远端写入

- **GIVEN** 用户仅触发物料生成，未点击「沉淀至 Injoys 知识文档」也未提出写入要求
- **WHEN** 调用 `workbench.generateArticleDraft` 或 `ops_draft_article`
- **THEN** MUST NOT 向 Injoys 发出 `document.create` 请求
- **AND** 物料 MUST 仍保存至本地草稿库，响应中的 `id` / `title` / `wordCount` / `draftSaved` 语义不变
- **AND** 响应的 `injoysDocId` / `docId` MUST 为空（未沉淀），MUST NOT 为任何文档编号

#### Scenario: 生成视频元数据后不产生远端写入

- **GIVEN** 用户仅触发视频元数据生成
- **WHEN** 调用 `ops_draft_video_meta` 或 `workbench.generateVideoMeta`
- **THEN** MUST NOT 向 Injoys 发出 `document.create` 请求
- **AND** 响应 MUST 仍返回 `videoPath`、三套标题变体与标签，且草稿已落盘

#### Scenario: 海外 Launch 物料生成不得无条件写入 Injoys

- **GIVEN** 海外 Launch 物料生成路径已存在（`ops_draft_launch_kit`）
- **WHEN** 用户仅触发物料生成
- **THEN** MUST NOT 经 `InjoysClient.saveLaunchKitDocument` 发出 `document.create` 请求
- **AND** MUST NOT 返回任何形式的文档编号（在该字段可空化契约落地前，以空值表示未沉淀）

### Requirement: 复盘路径不得写入 Injoys 文档

`ReviewReporter.generateReview` 与 `ops_generate_review` MUST 只生成本地复盘结果，MUST NOT 调用 `InjoysClient.saveReviewDocument` 写入 Injoys，也 MUST NOT 因此回写 `WeeklyReviewReport.injoysDocId`（`.context/criterion.md` §4「内容写入边界」；`.context/architecture/api_strategy.md` §3.1 `workbench.sinkToInjoysDoc` 的「唯一授权入口 / 该动作独立于自动存盘」口径）。本要求对应验收项「复盘不写远端」。

#### Scenario: 复盘生成不发出无条件的远端写入

- **GIVEN** 用户触发周度复盘
- **WHEN** `ReviewReporter.generateReview` 执行完成
- **THEN** MUST NOT 向 Injoys 发出无条件的 `saveReviewDocument` 请求
- **AND** 复盘结果 MUST 照常返回（`totalViews` / `overallEngagementRate` / `viralRate` / `topPerformers` / `keyLearnings` / `nextActions`）
- **AND** `report.injoysDocId` MUST 为未设置状态（生成阶段不填充该字段）

### Requirement: 工具描述必须与「生成只保存本地」一致

`ops_*` 工具的 `description` MUST 如实描述写入边界，MUST NOT 把「沉淀至 Injoys 文档」描述为生成的副作用（`.context/criterion.md` §4「内容写入边界」；`.context/domain/business_rules.md` BR-030 / BR-033）。本要求对应验收项「文案一致」。

#### Scenario: 描述文案不再暗示生成即沉淀

- **GIVEN** 工具目录中列出 `ops_draft_article` 与 `ops_generate_review`
- **WHEN** 读取两者的 `description`
- **THEN** MUST 明确说明产物只保存到本地草稿库
- **AND** MUST NOT 出现「保存为 Injoys 文档」「沉淀至 Injoys 文档」这类把远端写入描述为生成副作用的措辞

### Requirement: Injoys 文档写入能力必须保留

`InjoysClient` 的 `saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` / `saveLaunchKitDocument` MUST 保留，供用户显式触发的沉淀入口（`workbench.sinkToInjoysDoc`）复用；本变更移除的是生成 / 复盘路径的**调用**，不是能力本身（`.context/architecture/api_strategy.md` §3.1 `workbench.sinkToInjoysDoc`；`.context/architecture/risks_and_debt.md` TD-008「解决方案」①）。本要求对应验收项「能力保留」。

#### Scenario: 显式调用时写入能力仍可用

- **GIVEN** 调用方显式调用 `InjoysClient.saveArticleDocument`
- **WHEN** 知识库已连通
- **THEN** 该方法 MUST 仍经 `document.create` 发起远端写入并返回文档编号
- **AND** 生成 / 复盘路径 MUST NOT 因移除调用而使该能力不可用或被删除
