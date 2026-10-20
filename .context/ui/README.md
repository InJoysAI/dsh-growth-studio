# .context/ui/ — 界面设计上下文

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 00:55`
> - **Generator**: `Context-Agent v1.0`

---

## 目录用途

存储**可实施的 UI 约束**。工程硬约束以 `../criterion.md` 为准；业务枚举/阶段以 PRD / BR / `src/types.ts` 为准。

**读取优先级**：日常总结 → 提案时核对源文档 → 细节回 `source/`。

> ⚠️ 总结与源文档冲突，以 `source/` 为准。  
> ⚠️ 源文档与 criterion 冲突，**实现服从 criterion**。  
> ⚠️ 本文「UI 批次 1/2」≠ 路线图项目 Phase 0/1；客户端交付在项目 **Phase 3**。业务渠道范围仍按项目 Phase 0 = 公众号 + B 站。

---

## 源文档（只读）

| 文件 | 类型 | 内容概要 |
|------|------|---------|
| `source/ui-design-direction.md` | UI 规格（定稿 2026-10-20；MUST 对齐修订 2026-10-21） | DEC-UI-001~015、令牌、断点、六 Tab、快捷键、i18n、实施门禁 |

无 `docs/UX_UI_Design_Guidelines.md`，无 Figma 交付。

---

## 已生成总结

| 文件 | 用途 |
|------|------|
| [`design_system.md`](./design_system.md) | 视觉定位、令牌、槽位门禁、KPI/Tab 口径 |
| [`atomic_components.md`](./atomic_components.md) | 原子→页面；Megaphone、导出/导入、复制/沉淀 |
| [`layout_grid.md`](./layout_grid.md) | 1280 / 960 断点 |
| [`design_tokens.json`](./design_tokens.json) | Alias + 四个授权点缀色 |
| [`interaction_states.md`](./interaction_states.md) | SessionState / ItemStatus / 宿主回填 |
| [`motion_tokens.md`](./motion_tokens.md) | 150–200ms、呼吸灯、Toast |
| [`accessibility_checklist.md`](./accessibility_checklist.md) | 快捷键、四态文案、发布守卫 |

跳过：`handoff_checklist.md`（无 Figma）、`platform_guidelines.md`（非 iOS/Android）。

---

## 编号索引

| 编号 | 主题 |
|------|------|
| DEC-UI-001 | 目标主视图；**当前** `settings.section`；Megaphone 在宿主导航 chrome |
| DEC-UI-002 | Linear/Raycast；不采纳毛玻璃 |
| DEC-UI-003 | Sticky Ribbon + PRD 顺序 Tab |
| DEC-UI-004 | JSX 分目录为**目标**，须提案 |
| DEC-UI-005 | 创作室分屏 + 模拟器 |
| DEC-UI-006 | 五态看板 / 周日历 |
| DEC-UI-007 | SessionState 四态、两渠道、热点采用 |
| DEC-UI-008 | AI 卡片 + 抽屉 |
| DEC-UI-009 | 仅预填；`drafts.updatePublishUrl` |
| DEC-UI-010 | 空状态；null →「暂无数据」 |
| DEC-UI-011 | 150–200ms 微动效 |
| DEC-UI-012 | UI 批次 1：驾驶舱 + 创作室 + 配置 |
| DEC-UI-013 | 960px 折叠 |
| DEC-UI-014 | Cmd/Ctrl+S / Enter / R，Esc |
| DEC-UI-015 | `locale/*.json` + `ops.<area>.<name>` |

---

## AI 引用指南

1. 颜色：表面/文字走 `var(--dsw-alias-*)`；点缀色只用四个授权 HEX。
2. 枚举：`SessionState` 与 `ItemStatus` 以 `src/types.ts` 为准。
3. `published` 只经宿主 `drafts.updatePublishUrl`。
4. 未授权前不要注册主侧边栏槽位，也不要拆 `ops-styles.js`。
