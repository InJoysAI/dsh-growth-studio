# legacy/ — 遗留系统上下文

> **Metadata**
> - **Source**: `docs/development_plan.md`
> - **Generated At**: `2026-10-15 12:19`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## ⏩ 无遗留代码库

本项目为**全新插件实现**（产品代号 `dsh-growth-studio`），不存在需要迁移或对接的外部遗留系统代码库。

因此：

- `source/` 目录为空，未创建 `_codebase_ref.md` 引用文件
- 未执行 `@design/context-dev/legacy/AGENTS.md` 分析流程
- **本项目不属于棕地 (brownfield) 项目**，SSoT 与 OpenSpec 均按新项目标准初始化

---

## 关于"现状基线"的说明

需要区分两个概念：

| 概念 | 说明 |
|------|------|
| **遗留系统 (legacy)** | 外部既有代码库，需要棕地改造。**本项目不存在。** |
| **实现基线** | 本项目自身 `src/` 的当前实现状态。存在部分「🟡 契约就绪待验收」「🔴 待实现」缺口，见 `docs/development_plan.md` §二 |

后者是本项目的**内部进度状态**，不是遗留系统分析。相关基线信息已归档于：

- [`../domain/source/development_plan.md`](../domain/source/development_plan.md) §二 — 实现基线状态矩阵

---

## 待生成资产

`legacy_system_analysis.md` **不会生成**（无遗留系统）。
