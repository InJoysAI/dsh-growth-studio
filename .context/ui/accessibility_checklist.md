# 无障碍检查清单 (Accessibility Checklist)

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 00:40`
> - **Generator**: `Context-Agent v1.0`

---

源文档 DEC-UI-014 / §4.5 将「全局无障碍」落实为**高频快捷键 + 防呆**，未声明 WCAG 等级、对比度阈值、触控目标或 ARIA 规格。下列仅勾选源文档已写明的项；其余保持未完成，不假装已达标。

---

## POUR

### Perceivable（可感知）

- [ ] 文本与背景对比度满足 AA（**TODO**：源文档未给对比度数值；颜色走 DSH token，随宿主主题）
- [x] 指标 `null` 不只靠颜色：中性「暂无数据」徽章 + 悬浮原因文案（DEC-UI-010）
- [x] 渠道状态不只靠颜色：四态有文字（未知 / 需登录 / 已认证就绪 / 无权限）
- [ ] 图标/Emoji 的替代文本（**TODO**：源文档未给 aria-label 规范）

### Operable（可操作）

- [x] `Cmd/Ctrl+S`：创作室保存草稿（`drafts.save`），Toast「草稿已保存」
- [x] `Cmd/Ctrl+Enter`：一键预填；执行前二次防呆；执行中按钮 Loading
- [x] `Cmd/Ctrl+R`：刷新大盘（探活 + 拉数），**阻止浏览器默认硬刷新**
- [x] `Esc`：关闭 AI 工具调试抽屉或快捷表单弹层
- [x] 快捷键带防抖与操作保护（源文档 §4.5）
- [ ] 焦点可见且顺序合理（**TODO**：源文档未给 focus ring）
- [ ] 触控目标 ≥ 44×44px（**N/A / TODO**：目标为桌面工作台，源文档未要求移动触控尺寸）

### Understandable（可理解）

- [x] 空状态：微图标 + 解释文案 + CTA（DEC-UI-010）
- [x] 未登录提供 `去登录 ↗`，不阻断工作台
- [x] URL 回填失败有校验错误，不得静默标为已发布
- [x] 首版中文；键 `ops.<area>.<name>` 写入 `locale/*.json`；`ctx.i18n.text` → 当前 locale → `zh.json`
- [ ] 表单错误的焦点移动到出错字段（**TODO**：源文档未写）

### Robust（健壮）

- [ ] 语义化 HTML / ARIA（**TODO**：源文档未写）
- [ ] 屏幕阅读器可读关键内容（**TODO**：源文档未写）
- [x] 不泄露 Cookie；外链不夹带会话（criterion §4）

---

## 快捷键表（源文档权威）

| 快捷键 (Mac / Win) | 触发范围 | 行为与防呆 |
|-------------------|---------|-----------|
| `Cmd + S` / `Ctrl + S` | 创作室编辑区 | 本地草稿即时保存，Toast「草稿已保存」 |
| `Cmd + Enter` / `Ctrl + Enter` | 创作室编辑区 | 预填草稿箱；二次防呆；按钮 Loading |
| `Cmd + R` / `Ctrl + R` | 全局工作台 | 刷新大盘；阻止浏览器硬刷新 |
| `Esc` | 抽屉 / 模态层 | 关闭抽屉或快捷表单 |

---

## 发布与安全相关的可操作性

- 预填成功只引导人工到平台后台确认，**不得**提供自动正式发布控件。
- 回填只调用 `drafts.updatePublishUrl`；客户端不得把状态写成 `published`。
- `needs_login` 时仍可浏览工作台并给出 `去登录 ↗`，不得用登录墙挡住整个视图。
