## ADDED Requirements

### Requirement: 指标历史快照按日追加写入且不覆盖既有记录

指标历史快照 MUST 落盘于 `$DSH_HOME/growth-studio/metrics/{YYYY-MM-DD}.json`（`YYYY-MM-DD` 为采集当日日期），文件内容为 `PlatformMetrics[]`。每次指标采集成功后 MUST 按 `(platform, capturedAt)` 追加一条记录；同日再次追加 MUST 只新增记录，MUST NOT 覆盖、修改或删除既有记录（`.context/criterion.md` §4「环比基准」；`.context/architecture/data_architecture.md` 物理数据模型；`.context/architecture/source/technical_architecture.md` §5.3 本地数据布局）。本要求对应验收项「快照落盘」。

#### Scenario: 采集成功后按 (platform, capturedAt) 追加快照

- **GIVEN** 本次指标采集已成功得到平台指标结果
- **WHEN** 采集完成并写入指标历史快照
- **THEN** 当日 `metrics/{YYYY-MM-DD}.json` MUST 追加一条含 `platform` 与 `capturedAt` 的记录
- **AND** 文件内容 MUST 为 `PlatformMetrics[]`，既有记录 MUST 保持不变

#### Scenario: 同日重复采集不覆盖既有记录

- **GIVEN** 当日文件已存在若干条快照记录
- **WHEN** 同一天再次采集成功并追加写入
- **THEN** 既有记录 MUST 全部保留，新记录 MUST 追加到末尾
- **AND** MUST NOT 以整文件重写方式丢弃既有记录

### Requirement: 快照写入经统一落盘封装并复用存储错误口径

指标历史快照的写入 MUST 经统一落盘封装：目录不存在则创建、临时文件 + `rename` 原子替换、按绝对文件路径的串行写锁；新建目录 MUST 为 `0o700`、新建文件 MUST 为 `0o600`（`.context/criterion.md` §3.5「系统文件权限仅限当前操作系统用户」）。写盘失败 MUST 如实抛出并由统一 RPC 错误边界映射为 `drafts/storage-unavailable`，MUST NOT 吞掉异常后宣称已落盘（`.context/criterion.md` §3.2、§3.5）。本要求对应验收项「快照落盘」的失败分支。

#### Scenario: 快照写入失败如实报错

- **GIVEN** 指标历史目录不可写（例如目录只读）
- **WHEN** 采集成功后的快照写入执行
- **THEN** 该写入 MUST 失败并抛出可映射为 `drafts/storage-unavailable` 的存储错误
- **AND** MUST NOT 静默吞掉异常并把本次采集当作「已落盘」返回

#### Scenario: 快照文件与目录权限仅限当前用户

- **GIVEN** 指标历史目录尚未创建
- **WHEN** 快照写入创建目录与文件
- **THEN** 目录权限 MUST 为 `0o700`，新建快照文件权限 MUST 为 `0o600`
- **AND** MUST NOT 让同机其他操作系统用户可读该快照文件

### Requirement: 环比基准取自上一个等长窗口的历史快照

`workbench.overview` 的 `comparison` MUST 以本地指标历史快照中**上一个等长窗口**的记录作为对比基准：请求 `metricsWindow = '7d'` 时对比上一个 7 天窗口，`'30d'` 时对比上一个 30 天窗口，`comparison.period` MUST 置为对应的 `'7d'` / `'30d'`。基准读取 MUST 覆盖该对比窗口的完整历史；历史不足以覆盖完整对比窗口时，四个 delta MUST 全部为 `null` 且 `comparison.period` MUST 为 `null`，MUST NOT 用不完整历史算近似百分比、MUST NOT 以 `0` 冒充「无变化」（`.context/criterion.md` §4「环比基准」；`.context/architecture/api_strategy.md` §3.1「环比基准来源」；RISK-007）。本要求对应验收项「历史不足为 null」。

#### Scenario: 历史不足时环比为空

- **GIVEN** 本地历史指标快照不足以覆盖完整对比窗口
- **WHEN** 用户查看指标卡的环比走势
- **THEN** `comparison.period` MUST 为 `null`
- **AND** `impressionsDeltaPercent` / `playsDeltaPercent` / `engagementsDeltaPercent` / `followersDeltaPercent` MUST 均为 `null`（显示语义为「暂无环比」）
- **AND** 不得编造环比结论（不得输出近似百分比或 0%）

#### Scenario: 首次使用无历史时环比为空

- **GIVEN** 本地尚未积累任何指标历史快照
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `comparison` 的 `period` 与四个 delta MUST 全部为 `null`
- **AND** 该结果 MUST 被视为预期行为，MUST NOT 被当作缺陷或以 `0` 代替

### Requirement: 历史充足时环比 delta 按等长窗口基准计算

当且仅当历史快照足以覆盖完整上一个等长窗口时，`comparison` MUST 以该窗口的基准值与当前窗口值计算 `impressionsDeltaPercent` / `playsDeltaPercent` / `engagementsDeltaPercent` / `followersDeltaPercent`（`period` 为 `'7d'` / `'30d'`）；`impressions` / `plays` 与互动、净增关注口径 MUST 与汇总口径一致（缺失项为 `null`，不按 `0` 计算）。本要求对应验收项「历史充足 → delta 计算正确」。

#### Scenario: 历史充足时 delta 计算正确

- **GIVEN** 本地历史快照足以覆盖完整上一个等长窗口
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `comparison.period` MUST 为对应的 `'7d'` 或 `'30d'`
- **AND** 各 delta MUST 按「上一个等长窗口基准」计算得出正确数值
- **AND** MUST NOT 以缺失值按 `0` 参与计算

### Requirement: 快照读写在单次操作内目录固定

指标历史快照的每次读取 / 追加写入 MUST 在操作开始时捕获目标目录并贯穿整个操作（含跨 `await` 的复合调用），MUST NOT 在单次操作中途重新解析目录；配置热切换（`draftsDir` 变更）MUST 只对新发起的操作生效，在途操作继续使用原目录（`.context/criterion.md` §3.5「目录在单次操作内固定」）。本要求对应验收项「目录固定语义」。

#### Scenario: 目录在单次操作内固定

- **GIVEN** 一次快照追加写入已在操作开始时解析出目标目录
- **WHEN** 操作执行期间配置切换了 `draftsDir`
- **THEN** 本次写入 MUST 仍写入操作开始时解析的原目录
- **AND** 新目录 MUST 只对后续新发起的操作生效
