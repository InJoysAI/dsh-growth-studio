## ADDED Requirements

### Requirement: 配置文件写盘失败如实上报
系统必须（MUST）在 `ConfigStore.save()` 的 `mkdirSync` / `writeFileSync` / `renameSync` 任一步失败时如实上报失败，不得（MUST NOT）以 `catch` 吞没后让 `config.save` 返回 `ok:true`。依据 `.context/criterion.md` §3.2 MUST「错误不得吞没」与 MUST NOT「不虚报成功」，以及 `.context/architecture/risks_and_debt.md` RISK-005 缓解措施 ③「不得吞异常后谎报保存成功」。本需求补齐 `testing_strategy.md` 模块 6 场景 4 中「配置文件写失败」此前「部分覆盖」的分支。

#### Scenario: 配置目录不可写
- **WHEN** `$DSH_HOME/ops-manager/` 目录只读（`writeFileSync` tmp 抛 `EACCES`；POSIX 下 `rename` 可覆盖只读**文件**，故触发条件取目录级不可写而非 `config.json` 只读）
- **THEN** `config.save` 返回 `ok:false`
- **AND** `error.code` 为 `drafts/storage-unavailable`，不得为 `ok:true` 或 `ops/internal-error`

#### Scenario: 配置目录路径被文件占用
- **WHEN** `$DSH_HOME/ops-manager/` 路径被普通文件占用（`mkdirSync` 抛 `EEXIST`，与权限无关、跨平台可复现）
- **THEN** `config.save` 返回 `ok:false`
- **AND** `error.code` 为 `drafts/storage-unavailable`

#### Scenario: 失败信封技术细节口径
- **WHEN** `config.save` 返回 `drafts/storage-unavailable` 失败信封
- **THEN** `error.message` 为面向用户的中文说明（客户端 `ops-page.js` 直接展示 `err.message`）
- **AND** `message` 不拼接 `errno` / 调用栈等技术细节；`details.dir` 指向 `ops-manager` 配置目录

#### Scenario: 失败路径下热更新与内存态一致
- **WHEN** `config.save` 落盘失败返回 `ok:false`
- **THEN** `InjoysClient` 已先经 `injoys.updateConfig` 热更新为提交的新配置（`updateConfig` 在 `save()` 之前执行，只更新内存态、不抛错）
- **AND** `inMemory`/`InjoysClient` 保持与用户刚提交的表单一致，避免「界面显示新配置但真实调用仍走旧令牌」的分裂态（`criterion.md:104` MUST「配置热更新须实时生效并传给 `InjoysClient`（`updateConfig`）」）
- **AND** 本断言对**非空字段**成立——`ops-page.js:77-78` 允许清空提交（`trim()` 后为 `''`）：`config-store.ts:171` 只在 `length>0` 时合并（`inMemory` 保留旧值）而 `client.ts:80` 只在 `!== undefined` 时赋值（`InjoysClient` 采纳 `''`），空串提交的既有语义分裂不在本提案范围内

#### Scenario: 失败不回滚内存配置
- **WHEN** `config.save` 落盘失败返回 `ok:false`
- **THEN** 进程内 `inMemory` 保持已合并的新配置（不回滚）
- **AND** 失败如实上报、不谎报成功；下次重启按 `config.json` 的实际内容回退

#### Scenario: `draftsDir` 预检语义不受影响
- **WHEN** `draftsDir` 不可写 / 不存在且不可创建（前置预检失败）
- **THEN** `config.save` 仍返回 `config/invalid-drafts-dir`
- **AND** 该预检在配置文件写盘检查之前，语义与返回码不变（roadmap 约束：不得改动 `draftsDir` 预检语义）

### Requirement: 成功路径与客户端契约不变
系统必须（MUST）保持 `config.save` 的可写路径语义与响应形状不变：成功仍 `{ ok:true, value:{ success:true, config: OpsConfig } }`（`config` 含明文令牌字段，见 criterion §3.4 令牌返回边界）；客户端在 `ok:false` 时经 `unwrapRpcResult` 抛错进入 `handleSave` 失败提示分支——本提案不新增客户端改动。依据 `.context/architecture/api_strategy.md` §3.6 `config.save` 契约。

#### Scenario: 可写路径仍成功并落盘
- **WHEN** `ops-manager/` 可写，`config.save` 收到合法配置
- **THEN** 返回 `ok:true` 且 `value.success === true`
- **AND** `config.json` 已写入 `$DSH_HOME/ops-manager/` 且内容含令牌字段（`value.config` 为完整 `OpsConfig`）

#### Scenario: 客户端失败分支可达
- **WHEN** `config.save` 返回 `ok:false`
- **THEN** 客户端 `management-rpc.mjs` `unwrapRpcResult` 抛错
- **AND** `ops-page.js` `handleSave` catch 进入「保存失败」提示分支（既有代码路径，不新增改动）

### Requirement: 统一错误码口径不新增
系统必须（MUST）把配置文件写盘失败复用既有统一存储错误码 `drafts/storage-unavailable`（覆盖所有写入口，criterion §3.5），不得（MUST NOT）新增语义相近的新错误码；`.context/architecture/api_strategy.md` §2.3 错误码清单**不新增错误码**、仅把 `drafts/storage-unavailable` 的触发条件扩容为「目录不可写 / 创建失败 / 配置文件写盘失败」。

#### Scenario: 配置文件失败复用统一码
- **WHEN** 配置文件自身写盘失败（区别于 `draftsDir` 预检的 `config/invalid-drafts-dir`）
- **THEN** `config.save` 经统一 RPC 错误边界映射为 `drafts/storage-unavailable`
- **AND** `api_strategy.md` §2.3 错误码清单未新增任何错误码
