# 栅格与响应式布局 (Layout Grid & Responsive)

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 00:15`
> - **Generator**: `Context-Agent v1.0`

---

本工作台是 DSH Desktop 宽屏主视图，不是移动 App。断点服务 13/14 寸笔记本全屏、外接显示器与桌面分屏（DEC-UI-013 / 源文档 §4.4）。源文档**未定义**传统 12 列栅格的列数 / Margin / Gutter，下表不编造。

---

## 断点 (Breakpoints)

| 名称 | 范围 | 用途 |
|------|------|------|
| 宽屏 | `≥ 1280px` | 宽松宽屏模式 |
| 标准 | `960px ~ 1279px` | 紧凑工作台模式 |
| 窄屏 / 分屏 | `< 960px` | 垂直单列流模式 |

折叠主断点：**960px**（DEC-UI-013）。

---

## 栅格配置 (Grid)

| 断点 | 列数 | Margin | Gutter | 创作室 | KPI Ribbon |
|------|------|--------|--------|--------|------------|
| ≥ 1280px | TODO（源文档未给全局列数） | TODO | TODO | 左右 **50% / 50%** 并排，完整拟真机型边框 | **4 列等宽单行** |
| 960–1279px | TODO | TODO | TODO | 左右 **55% / 45%** 并排，紧凑拟真卡片 | **4 列等宽单行紧凑** |
| < 960px | 单列流 | TODO | TODO | **上下堆叠**：上编辑、下模拟器 | **2×2 网格** |

---

## 8pt 间距体系

源文档未给出 spacing token。

| Token | 值 |
|-------|----|
| spacing-* | TODO |

已明确的位移：卡片 Hover `translateY(-2px)`（源文档 §4.3），不属于间距刻度。

---

## CSS 变量示例

只映射源文档写明的布局行为，不发明 `--grid-columns-desktop: 12`。

```css
:root {
  --ops-bp-compact: 960px;
  --ops-bp-wide: 1280px;
  --ops-studio-wide-left: 50%;
  --ops-studio-wide-right: 50%;
  --ops-studio-standard-left: 55%;
  --ops-studio-standard-right: 45%;
}

.dim-ops-kpi-ribbon {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.dim-ops-studio {
  display: grid;
  grid-template-columns: 50% 50%;
}

@media (max-width: 1279px) {
  .dim-ops-studio {
    grid-template-columns: 55% 45%;
  }
}

@media (max-width: 959px) {
  .dim-ops-kpi-ribbon {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dim-ops-studio {
    grid-template-columns: 1fr;
  }
}
```

---

## 壳层垂直结构（非横向栅格）

源文档 §4.1 自上而下固定：

1. `HeaderCockpit`（产品 / 引擎状态 / 全局行动）
2. Sticky KPI Ribbon
3. Segmented Tabs
4. Active Workspace Canvas

KPI Ribbon 在滚动时保持 sticky，保证关键指标即时可见（DEC-UI-003）。
