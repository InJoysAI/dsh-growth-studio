## ADDED Requirements

### Requirement: 指标历史快照按日追加写入且不覆盖既有记录

指标历史快照 MUST 落盘于 `$DSH_HOME/growth-studio/metrics/{YYYY-MM-DD}.json`（`YYYY-MM-DD` 为采集当日日期），文件内容为 `PlatformMetrics[]`（与 `data_architecture.md` 物理数据模型一致，不新增快照行字段）。

**落盘范围（可证性门）**：仅 `source !== 'unmeasured'` 且 `windowScope === 'verified'` 的采集结果 MUST 落盘；`source: 'unmeasured'`（未测得）与 `windowScope: 'unverified'`（数值无法证实属于请求窗口）的记录 MUST NOT 写入快照。二者均为「未知贡献」，其原始抓取值不得成为未来环比基准的依据（`.context/criterion.md` §4「指标真实性 / 环比基准」；`.context/architecture/api_strategy.md` §3.1「指标口径」：`windowStart` / `windowEnd` 表达请求窗口，不构成「数值属于该窗口」的证明）。

每次指标采集成功且通过可证性门后 MUST 按 `(platform, capturedAt)` 追加一条记录；同日再次追加 MUST 只新增记录，MUST NOT 覆盖、修改或删除既有记录，MUST NOT 丢弃既有记录（`.context/criterion.md` §4「环比基准」；`.context/architecture/data_architecture.md` 物理数据模型；`.context/architecture/source/technical_architecture.md` §5.3 本地数据布局）。本要求对应验收项「快照落盘」。

#### Scenario: 采集成功后按 (platform, capturedAt) 追加快照

- **GIVEN** 本次指标采集已成功得到平台指标结果
- **AND** 该结果满足 `source !== 'unmeasured'` 且 `windowScope === 'verified'`
- **WHEN** 采集完成并写入指标历史快照
- **THEN** 当日 `metrics/{YYYY-MM-DD}.json` MUST 追加一条含 `platform` 与 `capturedAt` 的记录
- **AND** 文件内容 MUST 为 `PlatformMetrics[]`，既有记录 MUST 保持不变

#### Scenario: 同日重复采集不丢弃既有记录

- **GIVEN** 当日文件已存在若干条快照记录
- **WHEN** 同一天再次采集成功并追加写入
- **THEN** 既有记录 MUST 全部保留，新记录 MUST 追加到末尾
- **AND** MUST NOT 丢弃既有记录（无论以何种写入方式实现，如整文件原子替换后仍须包含全部既有记录）

#### Scenario: 不可证实的结果不落盘

- **GIVEN** 某平台采集结果的 `windowScope` 为 `'unverified'`（页面口径为累计 / 昨日数据，无法证实属于请求窗口）
- **WHEN** 采集完成并执行快照写入
- **THEN** 该结果 MUST NOT 被写入指标历史快照
- **AND** MUST NOT 把该原始抓取值当作窗口基准落盘，以免未来「历史充足」时由不可证数据算出环比

### Requirement: 快照写入经统一落盘封装并复用存储错误口径

指标历史快照的写入 MUST 经统一落盘封装：目录不存在则创建、临时文件 + `rename` 原子替换、按绝对文件路径的串行写锁；新建目录 MUST 为 `0o700`、新建文件 MUST 为 `0o600`（`.context/criterion.md` §3.5「系统文件权限仅限当前操作系统用户」）。写盘失败 MUST 如实抛出并由统一 RPC 错误边界映射为 `drafts/storage-unavailable`，即**整体调用以失败信封返回**（`{ ok: false, error: { code: 'drafts/storage-unavailable' } }`），MUST NOT 吞掉异常后宣称已落盘，MUST NOT 以成功信封附带落盘失败标注（`.context/criterion.md` §3.2、§3.5；`.context/architecture/api_strategy.md` §2.3 错误码清单「全部写入口」）。失败时不回滚已发生的采集副作用，但响应形态以本条为准。本要求对应验收项「快照落盘」的失败分支。

#### Scenario: 快照写入失败如实报错

- **GIVEN** 指标历史目录不可写（例如目录只读）
- **WHEN** 采集成功后的快照写入执行
- **THEN** 该写入 MUST 失败并抛出可映射为 `drafts/storage-unavailable` 的存储错误
- **AND** 调用 MUST 以失败信封返回（`error.code` 为 `drafts/storage-unavailable`），MUST NOT 返回成功信封
- **AND** MUST NOT 静默吞掉异常并把本次采集当作「已落盘」返回

#### Scenario: 快照文件与目录权限仅限当前用户

- **GIVEN** 指标历史目录尚未创建
- **WHEN** 快照写入创建目录与文件
- **THEN** 目录权限 MUST 为 `0o700`，新建快照文件权限 MUST 为 `0o600`
- **AND** MUST NOT 让同机其他操作系统用户可读该快照文件

### Requirement: 环比基准取自上一个等长窗口的历史快照

`workbench.overview` 的 `comparison` MUST 以本地指标历史快照中**上一个等长窗口**的记录作为对比基准：请求 `metricsWindow = '7d'` 时对比上一个 7 天窗口，`'30d'` 时对比上一个 30 天窗口，`comparison.period` MUST 置为对应的 `'7d'` / `'30d'`。

**「历史足以覆盖完整对比窗口」的判定（可测试）**：设应采平台集合为 `P`（与汇总覆盖门一致），对**每一个** `p ∈ P`，在上一个等长窗口的时间范围内**至少存在一条**已落盘的快照记录（该记录因可证性门而必然是 `source !== 'unmeasured'` 且 `windowScope === 'verified'`），且该记录的 `windowStart` / `windowEnd` **等于**上一个等长窗口（即与当前请求窗口同一长度；MUST NOT 用 30d 记录充当 7d 基准，反之亦然）。任一 `p ∈ P` 缺少这样的记录即判定为「历史不足」。同一 `p` 存在多条满足条件的记录时，取 `capturedAt` **最新**的一条（见下一条要求的基准选取规则）。

历史不足以覆盖完整对比窗口时，四个 delta MUST 全部为 `null` 且 `comparison.period` MUST 为 `null`，MUST NOT 用不完整历史算近似百分比、MUST NOT 以 `0` 冒充「无变化」、MUST NOT 以缺失平台按 `0` 参与基准计算（`.context/criterion.md` §4「环比基准」；`.context/architecture/api_strategy.md` §3.1「环比基准来源」；RISK-007）。本要求对应验收项「历史不足为 null」。

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

当且仅当「历史足以覆盖完整对比窗口」（见上一条要求的判定：每个 `p ∈ P` 在上一个等长窗口内至少有一条 `windowStart` / `windowEnd` **等于**该窗口且可证性达标的快照记录）时，`comparison` MUST 以该窗口的基准值与当前窗口值计算 `impressionsDeltaPercent` / `playsDeltaPercent` / `engagementsDeltaPercent` / `followersDeltaPercent`（`period` 为 `'7d'` / `'30d'`）。

**基准选取规则（唯一可判定）**：「完整覆盖」指记录的 `windowStart` / `windowEnd` **等于**上一个等长窗口（同一窗口长度；MUST NOT 用 30d 记录充当 7d 基准，反之亦然）。同一 `p` 存在多条满足条件的记录时，MUST 取 `capturedAt` **最新**的一条作为该平台基准值。`impressions` / `plays` 与互动、净增关注口径 MUST 与汇总口径一致（缺失项为 `null`，不按 `0` 计算）。本要求对应验收项「历史充足 → delta 计算正确」。

#### Scenario: 历史充足时 delta 计算正确

- **GIVEN** 本地历史快照足以覆盖完整上一个等长窗口
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `comparison.period` MUST 为对应的 `'7d'` 或 `'30d'`
- **AND** 各 delta MUST 按「上一个等长窗口基准」计算得出正确数值
- **AND** MUST NOT 以缺失值按 `0` 参与计算

### Requirement: 快照读写在单次操作内目录固定

指标历史快照的每次读取 / 追加写入 MUST 在操作开始时捕获**指标历史根目录**并贯穿整个操作（含跨 `await` 的复合调用），MUST NOT 在单次操作中途重新解析目录。指标历史根目录 MUST 由 `resolveDshHome()` 解析出的 `$DSH_HOME` 下 `growth-studio/metrics` 得到（`.context/criterion.md` §3.5「文件路径统一经 `resolveDshHome` 解析」），**MUST NOT 绑定到 `draftsDir`**——`draftsDir` 只改草稿库，变更它 MUST NOT 改变指标历史路径。若运行时 `profileContext.home` / `DSH_HOME` 可变，其变更 MUST 只对新发起的操作生效，在途操作继续使用原目录（`.context/criterion.md` §3.5「目录在单次操作内固定」）。本要求对应验收项「目录固定语义」。

#### Scenario: 目录在单次操作内固定

- **GIVEN** 一次快照追加写入已在操作开始时解析出指标历史根目录（`resolveDshHome()` 下 `growth-studio/metrics`）
- **WHEN** 操作执行期间 DSH home 配置（`profileContext.home` / `DSH_HOME`）切换
- **THEN** 本次写入 MUST 仍写入操作开始时解析的原指标历史根目录
- **AND** 新的 home MUST 只对后续新发起的操作生效

#### Scenario: draftsDir 变更不影响指标历史路径

- **GIVEN** 配置把 `draftsDir` 切换到另一个草稿库目录
- **WHEN** 执行指标历史快照追加写入
- **THEN** 快照 MUST 仍写入 `resolveDshHome()` 下的 `growth-studio/metrics`，MUST NOT 因 `draftsDir` 变更而改道到草稿库
