# dsh-growth-studio Context

> **Metadata**
> - **Source**: `docs/product_requirements.md`, `docs/development_plan.md`, `docs/technical_architecture.md`
> - **Generated At**: `2026-10-15 13:17`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## 这是什么

`.context/` 是 AI 代理在本项目中的"长期记忆"：把需求（PRD）、架构与工程约束结构化沉淀，供提案、实施与检查环节反复读取。

**约束的权威来源是 [`criterion.md`](./criterion.md)**，其余文件是它的输入与派生。

---

## 阅读顺序

| 顺序 | 文件 | 用途 |
|:----:|------|------|
| 1 | [`criterion.md`](./criterion.md) | 项目准则：MUST / MUST NOT、技术栈约束、SSoT 工具链 |
| 2 | [`AGENTS.md`](./AGENTS.md) | Context 目录说明与资产索引 |
| 3 | [`context-manifest.json`](./context-manifest.json) | 源文档 hash 与已生成资产清单 |

按需阅读：

- [`domain/source/`](./domain/source/) — 原始 PRD 与开发计划（**只读**，细节以此为准）
- [`architecture/source/`](./architecture/source/) — 原始技术架构设计说明书（**只读**）
- `domain/`、`architecture/` 下的总结文件 — 由 `/context-openspec` 生成，未生成时不存在

---

## 目录结构

```text
.context/
├── README.md                    # 本文件
├── AGENTS.md                    # 资产索引与目录树
├── criterion.md                 # 项目准则（约束权威来源）
├── context-manifest.json        # 源文档 hash / 生成状态
├── architecture/
│   ├── README.md
│   └── source/
│       └── technical_architecture.md
├── domain/
│   ├── README.md
│   └── source/
│       ├── product_requirements.md
│       └── development_plan.md
└── openspec/
    └── README.md
```

---

## 本项目要点（速览）

| 项 | 值 |
|----|-----|
| 项目 | `dsh-growth-studio`（Growth Studio / 原 Ops Manager） |
| 形态 | DeepSeek Harness (DSH) 桌面端 **Cordis 全插件**（宿主侧 `src/` + 浏览器侧 `plugin-src/client/`） |
| 运行环境 | Node `^22.19.0 \|\| >=24.0.0`；TypeScript strict / NodeNext；React 18 + esbuild |
| 外部引擎 | Injoys MCP（JSON-RPC 2.0 / HTTP）、BrowserOS MCP（本地 `127.0.0.1:9002`，会话与抓取统一实例） |
| 持久化 | 本地 JSON 文件（`$DSH_HOME/ops-manager/config.json`、`$DSH_HOME/growth-studio/drafts/`）；**无关系型数据库** |
| 铁律 | **始终仅预填草稿，严禁自动确认发布**；指标无法获取必须是 `null`，不得伪造 |

---

## 维护方式

| 场景 | 命令 |
|------|------|
| 源文档变更后增量同步 | `.agent/workflows/context-update.md` |
| 检查环境 / Manifest / 提案一致性 | `.agent/workflows/context-check.md` |
| 生成 Context 总结 + OpenSpec 集成 | `.agent/workflows/context-openspec.md` |
| 全量重建 | 删除 `context-manifest.json` 后重新运行 `.agent/workflows/context-init.md` |

> 💡 仅当源文档（PRD / 架构 / 计划）变化时才需更新 `.context/`；业务代码变更不触发重生成。
