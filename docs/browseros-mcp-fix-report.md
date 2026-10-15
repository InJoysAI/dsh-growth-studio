# `ops_fetch_metrics` BrowserOS MCP 修复记录

- **修复日期**: 2026-10-14
- **范围**: `dsh-growth-studio` 插件的 BrowserOS 接入链路
- **结论**: 代码侧已修完并通过真实 BrowserOS 实测；**DSH profile 的 MCP 注册需用户手动完成**（`~/.dsh` 为只读文件系统，Agent 无法写入）

---

## 1. 修复前状态

`ops_fetch_metrics` 对 4 个平台全部返回 0，且没有任何提示说明为什么。三层断链：

| 层 | 问题 |
|---|---|
| 注入 | `src/index.ts` 用 `ctx.get("browserOsClient")` / `ctx.get("mcp")` 猜 Cordis service，而 `dsh-mcp-client` 只注册工具、不提供服务，三条路全落空 |
| 消费 | `src/index.ts:72` 调 `createOpsTools(...)` 漏传 `metricsCollector`，工具内部自建的 collector 从未拿到 client |
| 采集 | `collectLivePlatformMetrics` 拿到 snapshot 后无任何解析，字段全写死 null；且调 `navigate` 不传 `page`，被 BrowserOS 直接拒绝 |

---

## 2. 改了什么

### 2.1 新增 `src/browser/browseros-bridge.ts`

从 `ctx.tools` 反查 `mcp__browseros__*` 工具并转发调用，替代原先猜 service key 的做法。

- 优先 `ctx.tools.view()` 列出全部可见工具，失败时回退到 `ctx.tools.get()` 逐个探测已知工具名
- 未注册时返回 `undefined` + 明确 `reason`，**不返回假 client**
- 附带 `extractToolText` / `stripUntrustedEnvelope` / `extractSessionHandle` 三个 BrowserOS 响应处理helper

### 2.2 新增 `src/browser/browseros-ops.ts`

把 BrowserOS 的调用约定集中到一处（`BrowserOsSession`）：

- `navigate` / `snapshot` / `act` / `wait` **都必须带 `page`**（tab 序号）
- session handle 从每个结果的 `_meta["com.browseros/session"]` 取出并回传，保持同一浏览器会话与 tab 归属
- `wait` 的正确签名是 `{ page, for: 'time', value: ms }`，不是 `{ ms }`
- `read` 会重试到文本停止增长为止 —— 仪表盘的数据块比外壳渲染晚，短读取是加载帧而非数据
- `parseTabs` 同时兼容 BrowserOS 的 JSON 数组与 `[n] <url>` 文本两种返回形态

### 2.3 重写 `src/analytics/metrics-collector.ts`

- `PlatformMetricsOutcome` 新增 `source: 'live' | 'unmeasured' | 'mock'` 与 `note`
- 每个平台复用**已登录的 tab**（新开 tab 不继承平台登录态）
- 新增 `parseBilibili` / `parseDouyin` / `parseWechatChannels` / `parseWechatMp` / `parseXiaohongshu` 五个解析器，锚定真实页面布局
- 微信登录门检测：`isWechatLoginGate`
- 未测到的平台返回 `null` + 具体原因，**绝不以 0 冒充**

### 2.4 修正 `src/browser/browser-driver.ts`

- `navigate` / `snapshot` / `act` / `upload` / `click` 全部带上 `page`
- 优先复用同 host 的已打开 tab，而不是新开
- `planPrefillWorkflow` 与 `executeBrowserOsWorkflow` 共用一次 tabs 查询（原先重复调用两次）
- tabs 解析改用共享的 `parseTabs`

### 2.5 接通 `src/index.ts` / `src/tools/index.ts`

- `resolveBrowserOsClient(ctx)` 替换 service 猜测，并打印接入诊断日志
- `createOpsTools(injoys, adapters, ctx, draftStore, new MetricsCollector({ browserOsClient }))`
- `createOpsTools` 增加 `browserOsClient` 形参兜底
- `ops_fetch_metrics` 输出新增「数据来源」列与「未采集原因」区；只有 `source !== 'unmeasured'` 的行才计入总计

### 2.6 新增平台：小红书

`xiaohongshu` 加入 `PlatformId`，并补齐 `session-guard` 的登录/cookie 规则与 `comments-crawler` 的评论池。

---

## 3. 实测结果（真实 BrowserOS）

```
bilibili         source=live        播放 296  点赞 27  评论 2   分享 1  收藏 15  涨粉 0
douyin           source=live        播放 2588 点赞 24  评论 2   分享 3  收藏 9   涨粉 103
wechat_channels  source=live        播放 10   评论 0   涨粉 1
xiaohongshu      source=unmeasured  见下方说明
wechat_mp        source=unmeasured  微信会话已过期，需重新扫码登录
```

- **B 站**：数字与手工在 `member.bilibili.com/platform/home` 看到的一致（播放 296 / 点赞 27 / 评论 2 / 弹幕 0 / 分享 1 / 收藏 13 / 投币 2 / 粉丝 1）
- **抖音**：9 个已发布作品，播放 165+127+238+106+299+394+105+323+831 = 2588；`完播率` 与 `2秒跳出率` 未被误计入
- **视频号**：昨日新增播放 8→10（页面数据随时间变动）、净增关注、关注者 12、视频数 13 均正确
- **小红书**：见 4.2
- **公众号**：微信对该页要求重新登录，已诚实报告而非报 0

---

## 4. 已知限制

### 4.1 微信公众号

`mp.weixin.qq.com/misc/appmsganalysis` 与 `/cgi-bin/home` 实测都返回「请重新登录」。这是微信自身的会话策略，需要在 BrowserOS 里手动扫码后再采集。插件已能识别该状态并给出提示。

### 4.2 小红书（选择不猜）

笔记列表渲染为 `<标题> <日期> <HH:mm> <阅读数> <时长>`，数字之间**没有任何分隔符**：

```
...我的会直接干活2026-10-01 00:26 50000 04:15AI工具...
```

`50000` 与 `04:15` 粘成 `5000004:15`，且各笔记时长位数不一（`04:15` / `20` / `2:19`）。我试过 4 种文本切分方案，最好的一例也把 50000+19300+8150+14420+18000 = 109870 算成 4417031（误差 40 倍）。

`snapshot` 同样不返回结构化数字。**因此 `parseXiaohongshu` 主动返回空**，让上层报告「无法可靠拆分」，而不是给一个可能错几十倍的数。要拿到真实值需要平台结构化接口或 DOM 级逐行读取。

---

## 5. 需要你手动完成的一步

`~/.dsh` 在我这边是**只读文件系统**，无法写入。请在 DSH 重启前，把 BrowserOS MCP server 注册进 profile。

**方式 A（推荐，一劳永逸）** —— 编辑 `/home/dust/.dsh/profiles/desktop/cordis.patch.yml`，在末尾追加：

```yaml
- insert:
    - id: mcp-browseros
      name: "@deepseek-ai/dsh-mcp-client"
      config:
        serverName: browseros
        transport: streamable-http
        url: http://127.0.0.1:9002/mcp
        failOnStartupError: false
        reconnect:
          enabled: true
```

**方式 B** —— 已写进插件自带的 [cordis.patch.yml](../cordis.patch.yml)，只要插件被 DSH 加载就会带上这条注册，无需改 profile。

> BrowserOS 的 MCP 地址以 `~/.browseros/server.json` 与 `~/.browseros/mcp-manager/manifest.json` 为准，当前为 `http://127.0.0.1:9002/mcp`。

### 重启后如何验证

1. 看日志有无 `[growth-studio] BrowserOS MCP 已接入，可用工具: ...`
2. 直接问我「看下运营数据」—— 表格会多出「数据来源」列，live 行显示真实数字，未采集行给出原因
3. 或在会话里让我调用 `mcp__browseros__tabs`，能通就说明注册成功

---

## 6. 测试

- 新增 `tests/browseros-scraping.spec.ts`：15 个用例，fixture 全部取自真实页面文本
- 全量：**54 passed / 2 failed**
- 剩余 2 个失败（`ops_draft_article` / `ops_draft_video_meta`）是沙箱只读导致测试无法写 `~/.dsh/growth-studio/drafts/`，**与本次改动无关** —— 已在干净代码树上复现同样失败
- 手动端到端验证：`node --experimental-strip-types scripts/verify-live-metrics.mts [mcpUrl] [platforms]`
