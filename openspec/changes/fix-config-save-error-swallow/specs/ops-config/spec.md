## ADDED Requirements

### Requirement: 配置文件写盘失败如实上报
系统必须（MUST）在 `ConfigStore.save()` 的 `mkdirSync` / `writeFileSync` / `renameSync` 任一步失败时如实上报失败，不得（MUST NOT）以 `catch` 吞没后让 `config.save` 返回 `ok:true`。依据 `.context/criterion.md` §3.2 MUST「错误不得吞没」与 MUST NOT「不虚报成功」，以及 `.context/architecture/risks_and_debt.md` RISK-005 缓解措施 ③「不得吞异常后谎报保存成功」。本需求补齐 `testing_strategy.md` 模块 6 场景 4 中「配置文件写失败」此前「部分覆盖」的分支。

#### Scenario: 配置目录不可写
- **WHEN** `$DSH_HOME/ops-manager/` 目录不可写（`mkdirSync` / `writeFileSync` / `renameSync` 失败）
- **THEN** `config.save` 返回 `ok:false`
- **AND** `error.code` 为 `drafts/storage-unavailable`，不得为 `ok:true` 或 `ops/internal-error`

#### Scenario: 配置文件只读
- **WHEN** `ops-manager/config.json` 存在但只读，落盘（tmp 写入 / rename）失败
- **THEN** `config.save` 返回 `ok:false`
- **AND** `error.code` 为 `drafts/storage-unavailable`

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
系统必须（MUST）把配置文件写盘失败复用既有统一存储错误码 `drafts/storage-unavailable`（覆盖所有写入口，criterion §3.5），不得（MUST NOT）新增语义相近的新错误码；`.context/architecture/api_strategy.md` §2.3 错误码清单不因此变更。

#### Scenario: 配置文件失败复用统一码
- **WHEN** 配置文件自身写盘失败（区别于 `draftsDir` 预检的 `config/invalid-drafts-dir`）
- **THEN** `config.save` 经统一 RPC 错误边界映射为 `drafts/storage-unavailable`
- **AND** `api_strategy.md` §2.3 错误码清单未新增任何错误码
