# openspec/ — OpenSpec Context 资产

> **Metadata**
> - **Source**: `design/context-dev/openspec/AGENTS.md`
> - **Generated At**: `2026-10-15 13:17`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## 用途

承载 OpenSpec 集成所需的 **Context 侧**资产（业务/架构/数据/UI 总结），供 `openspec/config.yaml` 注入使用。

> ⚠️ 本目录位于 `.context/` 内，与项目根目录的 `openspec/`（提案与规范，由 `/context-openspec` 创建）**不是同一个目录**。

---

## 当前状态

**空目录（占位）** —— 尚未运行 `.agent/workflows/context-openspec.md`。

运行后将在此生成 domain / architecture / db / ui 各层总结文件，随后由 `/context-openspec` 汇总为项目根目录的：

| 产物 | 说明 |
|------|------|
| `openspec/config.yaml` | 从 `.context/` 派生的项目上下文快照（**不要手工修改**） |
| `openspec/proposal-roadmap.md` | 提案路线图 |
| `openspec/changes/` | 进行中的变更提案 |
| `openspec/specs/` | 当前规范 |

---

## 下一步

```text
.agent/workflows/context-openspec.md
```
