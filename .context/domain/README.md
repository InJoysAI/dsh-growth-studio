# domain/ — 业务领域域资产

> **Metadata**
> - **Source**: `docs/product_requirements.md`, `docs/development_plan.md`
> - **Generated At**: `2026-10-15 13:17`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## 用途

承载业务领域的**权威输入**（`source/`，只读）与派生的领域总结资产（业务规则、用户旅程、验收标准等）。

---

## 内容

| 路径 | 类型 | 说明 |
|------|------|------|
| [`source/product_requirements.md`](./source/product_requirements.md) | 源文档（**主 PRD**，权威输入，只读） | 产品愿景、用户画像与旅程、6 大功能模块规格、UI/UX 规范、4 阶段里程碑与验收标准 |
| [`source/development_plan.md`](./source/development_plan.md) | 源文档（配套计划，只读） | 实现基线状态矩阵、Phase 0–3 分步实施计划、核心数据模型更新、关键风险与工程防线 |
| `business_rules.md` 等派生资产 | 派生（**尚未生成**） | 由 `/context-openspec` 生成；未生成时不存在 |

> 主 PRD 由用户显式指定为 `docs/product_requirements.md`；`docs/development_plan.md` 作为同一领域的配套源文档一并归档。

---

## 关键结论（供快速定位）

| 主题 | PRD 位置 |
|------|---------|
| 现状痛点与产品愿景 | §2 |
| 用户画像与典型旅程 | §3 |
| 功能架构全景与分阶段交付 | §4 |
| 顶部驾驶舱与 KPI 看板 | §5.1 |
| 模块一：运营总览与矩阵大盘（渠道矩阵、四态、热点雷达） | §5.2 |
| 模块二：内容日历与发布流水线 | §5.3 |
| 模块三：跨平台内容创作室与模拟器 | §5.4 |
| 模块四：AI 运营工具中枢与技能工坊 | §5.5 |
| 模块五：舆情监控与需求提炼 | §5.6 |
| 模块六：引擎与平台配置 | §5.7 |
| 界面设计与交互规范 | §6 |
| 实施里程碑（M0–M3）与验收标准 | §7 |

### 里程碑锚点

| 阶段 | 代号 | 核心交付 |
|:----:|------|---------|
| Phase 0 | **M0 最小完整闭环** | 公众号 + B站：排期 → AI 生成 → 本地草稿 → 真实 BrowserOS 预填 → 人工回填 → 真实指标采集 |
| Phase 1 | **M1 国内全矩阵与舆情** | 视频号 + 抖音预填；真实评论抓取、Bug/Feature 提炼、周复盘报告 |
| Phase 2 | **M2 出海矩阵与技能预设** | YouTube / X / Product Hunt / TikTok；5 大场景技能包；认证窗 PoC |
| Phase 3 | **M3 高级治理与双向同步** | Injoys 双向同步与冲突解决；批量预填队列；自定义 Skill 编辑器 |
