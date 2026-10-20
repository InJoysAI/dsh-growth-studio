# 交互状态规范 (Interaction States)

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 00:15`
> - **Generator**: `Context-Agent v1.0`

---

## 状态列表

源文档覆盖：Default / Hover / Loading / Error / Empty / `null` 数据 / 会话四态 / 内容五态 / Toast。  
**未给出** Pressed / Focused 的视觉规格 → 标记 TODO，不编造。

---

## 组件状态矩阵

| 组件 | Default | Hover | Pressed | Focused | Disabled | Loading | Error | Empty / null |
|------|---------|-------|---------|---------|----------|---------|-------|--------------|
| Card | ✅ | ✅ 上浮 + 品牌边框 + 阴影 | TODO | TODO | N/A | N/A | 故障态走状态灯 | 空状态卡片 |
| Button（主/次/危险/图标） | ✅ | TODO | TODO | TODO | TODO | ✅ 预填中 | N/A | N/A |
| Input / URL 回填 | ✅ | TODO | TODO | TODO | TODO | N/A | ✅ URL 校验失败 | N/A |
| Badge / 状态灯 | ✅ 四态 | N/A | N/A | N/A | N/A | 呼吸灯（active） | 故障红 | 中性「暂无数据」 |
| MetricBox | ✅ 数值 + 环比 | N/A | N/A | N/A | N/A | 卡片级探活 | 探活失败 | `null` → 暂无数据 |
| EmptyState | N/A | N/A | N/A | N/A | N/A | N/A | N/A | ✅ 图标+文案+CTA |
| SegmentedTabs | ✅ | TODO | TODO | TODO | N/A | N/A | N/A | N/A |
| Drawer | ✅ 展开表单+JSON | N/A | N/A | Esc 关闭 | N/A | 执行中耗时 | 表单校验 | N/A |
| Toast | N/A | N/A | N/A | N/A | N/A | N/A | 可用于失败反馈 | 顶部滑入，5s 淡出 |
| 看板卡片 | 五态之一 | 源文档允许拖拽（Phase 1 深度） | TODO | TODO | N/A | N/A | 草稿异常 | 列空 TODO |

---

## 状态实现建议

### Card

- Hover: `translateY(-2px)`；`border-color` 品牌蓝；`box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.08)`；过渡 `180ms ease`。类名 `.dim-ops-card:hover`。
- Pressed / Focused: TODO（源文档未写）。

### Button

- Loading: 一键预填执行中展示按钮 Loading，禁止重复提交（源文档 §4.5、§5.2）。
- `Cmd/Ctrl+Enter` 执行前弹层二次防呆。
- Disabled: TODO（源文档未写视觉，但预填进行中应不可再点）。

### Badge / 状态灯（渠道四态）

| `data-status` / 文案 | 语义色 | 动效 |
|---------------------|--------|------|
| 已就绪 | 成功绿 | `dimStatusPulse` 2.4s（`[data-status="active"]`） |
| 待扫码 | 警告橙 | 源文档未写额外动效 |
| 未连接 | 中性 / 弱化 | 提供 `去登录 ↗` |
| 故障 | 危险红 | 源文档未写额外动效 |

### MetricBox / null 数据

- 接口字段为 `null`：中性灰徽章「暂无数据」+ 悬浮原因（例：「尚未探活或平台未发布」）。
- **禁止**把 `null` 显示为 `0`（criterion §3.3、DEC-UI-010）。

### EmptyState

- 结构：微图标 + 解释文案 + 行动按钮。
- 未登录：`去登录 ↗` 外链，零阻碍，不泄露 Cookie。

### Input（URL 回填）

- Error: URL 解析器校验失败 → 危险色与错误提示，状态不得跃迁为 `published`。
- Success: 校验通过 → 草稿 `published`（DEC-UI-009）。

### Toast / 通知条

- 预填成功：常驻通知条「去平台后台确认发布 ↗」。
- 草稿保存：轻量 Toast「草稿已保存」。
- 全局 Toast：`dimOpsSlideDown 200ms ease` 顶部滑入，停留 5 秒后淡出。

### 内容五态（排期看板）

`planned` → `writing` → `drafted` → `prefilled` → `published`。源文档允许卡片拖拽与阶段跃迁；Phase 0 为基础看板，深度交互 Phase 1。

### 工作台数据域

客户端状态域统一 `loading` / `error` / `data`（criterion §3.3）。刷新由用户触发，卡片原地更新，禁止整页重载（BR-082）。
