# ui/ — UI 设计规范上下文

> **Metadata**
> - **Source**: `docs/product_requirements.md`, `docs/technical_architecture.md`
> - **Generated At**: `2026-10-15 12:19`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## ⏩ 未提供独立 UI 设计规范文档

UI 规范内嵌于 PRD 与架构文档中，因此 `source/` 目录为空，无 UI 源文档需要归档。

---

## UI 规范事实（替代说明）

### 设计语言（PRD §六）

- 深度对齐 DeepSeek Harness 原生设计令牌（Light / Dark 自适应）
- 现代卡片设计：细腻边框、毛玻璃背景
- 主题色：科技蓝 `#1677ff`、就绪绿 `#10b981`、告警橙 `#f59e0b`、活力紫 `#8b5cf6`

### 视觉令牌（架构文档 §5.4）

| 层级 | 令牌 |
|------|------|
| 背景 | `var(--dsw-alias-bg-layer-1)`（页面）、`-2`（卡片）、`-3`（输入框） |
| 边框 | `var(--dsw-alias-border-l1)`、`var(--dsw-alias-border-l2)` |
| 文字 | `var(--dsw-alias-label-primary)`、`-secondary`、`-tertiary` |
| 交互点缀 | 主操作蓝 `#1677ff`、安全绿 `#15803d`、告警橙 `#b45309`、活力紫 `#7c3aed` |

> ⚠️ 禁止硬编码色值，必须使用 DSH 主题令牌以适配 Light/Dark。

### 布局结构（PRD §四）

```text
顶部驾驶舱 (Top Cockpit)
  └─ 产品标识 / Injoys & BrowserOS 引擎连接态 / 快速 AI 运营指令组
核心数据看板 (KPI Ribbon)
  └─ 全网曝光量 / 互动转化数 / 排期履约流水 / 活跃分发渠道就绪度
多维工作区切换 Tabs
  ├─ 🌟 运营驾驶舱     ├─ 📅 排期日历流水   ├─ ✍ 内容创作室
  ├─ 🛠 AI工具中枢      ├─ 📊 舆情需求大盘   └─ ⚙ 引擎策略配置
```

### 交互规范

- **图标**：设置菜单主入口采用 Ops 专属「大喇叭 (Megaphone)」矢量图标
- **状态语义**：绿色 = 就绪/已预填；琥珀色 = 待登录/待审核；灰色 = 规划中；红色 = 无权限
- **零阻碍操作原则**：凡检测到未登录平台，一律提供「去登录 ↗」快捷外链；数据卡片支持即时刷新

### 参考章节

- PRD §四（功能架构全景布局）
- PRD §六（界面设计与交互规范）
- 架构文档 §5.4（响应式设计系统与 DSH 视觉令牌对齐）

---

## 待生成资产

`design_system.md` 将由 `.agent/workflows/context-openspec.md` 生成。
