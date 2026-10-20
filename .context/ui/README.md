# .context/ui/ — 界面设计上下文

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 00:15`
> - **Generator**: `Context-Agent v1.0`

---

## 目录用途

存储**可实施的 UI 约束**：令牌绑定、断点、原子组件分层、交互状态、动效与无障碍。  
工程硬约束（禁止硬编码色值、禁止自动发布、`callOpsRpc`）以 `../criterion.md` 为准。

**读取优先级**：

1. 日常任务 → 读取下列总结文件（快速）
2. 提案检查 → 读取总结 + 设计规范验证
3. 遇到不确定 / 细节问题 → **回溯 `source/` 目录验证**

> ⚠️ **若总结与源文档冲突，以 `source/` 目录中的源文档为准。**  
> ⚠️ **若 UI 源文档与 criterion 冲突，实现服从 criterion**（尤其是色值令牌与发布守卫）。

---

## 源文档（只读）

| 文件 | 类型 | 内容概要 |
|------|------|---------|
| `source/ui-design-direction.md` | UI 设计方向与交互规格（已定稿 2026-10-20） | DEC-UI-001~015、DSH token 绑定、断点、六 Tab 交互、微动效、快捷键、i18n、客户端目录 |

本仓库无 `docs/UX_UI_Design_Guidelines.md`。无 Figma 切图 / 标注交付文档。

---

## 已生成总结

| 文件 | 用途 | 主要来源 |
|------|------|---------|
| [`design_system.md`](./design_system.md) | 视觉定位、颜色令牌、组件样式约束、与 criterion 的口径差 | §1、§3、§4.1–4.2、§6 |
| [`atomic_components.md`](./atomic_components.md) | 原子 → 页面五层，对应 `plugin-src/client/` 规划目录 | DEC-UI-004、§5、§6 |
| [`layout_grid.md`](./layout_grid.md) | 1280 / 960 断点、创作室分栏、KPI 2×2 | DEC-UI-013、§4.4 |
| [`design_tokens.json`](./design_tokens.json) | Global 回退参考 → Alias CSS 变量 → Component 覆写 | §4.2、§4.3 |
| [`interaction_states.md`](./interaction_states.md) | 卡片 Hover、四态灯、null/空状态、预填 Loading、五态看板 | DEC-UI-007~011、§5 |
| [`motion_tokens.md`](./motion_tokens.md) | 150–200ms、180ms 卡片、2.4s 呼吸、Toast 5s | DEC-UI-011、§4.3 |
| [`accessibility_checklist.md`](./accessibility_checklist.md) | 快捷键、空状态、null 文案；WCAG 未声明项为 TODO | DEC-UI-014、§4.5 |

### 跳过（源文档未覆盖）

| 文件 | 原因 |
|------|------|
| `handoff_checklist.md` | 未出现 Figma / 切图 / 标注 / Handoff |
| `platform_guidelines.md` | 「多端」指公众号 / B 站内容模拟器，不是 iOS vs Android |

---

## 编号索引（源文档决策）

| 编号 | 主题 |
|------|------|
| DEC-UI-001 | 独立工作台主视图 |
| DEC-UI-002 | Modern Pro SaaS + DSH Token |
| DEC-UI-003 | Sticky KPI Ribbon + Segmented Tabs |
| DEC-UI-004 | JSX 原子组件分目录 |
| DEC-UI-005 | 创作室左右分屏 + 模拟器 |
| DEC-UI-006 | 五态看板 / 周日历双视图 |
| DEC-UI-007 | 四态灯、原地探活、去登录、热点一键采用 |
| DEC-UI-008 | AI 工具卡片 + 右侧调试抽屉 |
| DEC-UI-009 | 仅预填 + URL 回填，禁止自动发布 |
| DEC-UI-010 | 空状态三件套；null →「暂无数据」 |
| DEC-UI-011 | 150–200ms 微动效 |
| DEC-UI-012 | Phase 0：驾驶舱 + 创作室 + 配置优先 |
| DEC-UI-013 | 960px 折叠断点 |
| DEC-UI-014 | Cmd/Ctrl+S / Enter / R，Esc |
| DEC-UI-015 | 中文打底 + 文案字典化 |

---

## AI 引用指南

1. 先读 `design_system.md` 与 `design_tokens.json`，颜色只绑 `var(--dsw-alias-*)`。
2. 新 UI 必须能落到 `atomic_components.md` 的某一层，禁止把六 Tab 写回单文件。
3. `null` 与未登录交互以 `interaction_states.md` 为准。
4. 细节回源文档；发布与色值硬约束回 `criterion.md`。
