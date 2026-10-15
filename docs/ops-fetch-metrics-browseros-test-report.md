# `ops_fetch_metrics` BrowserOS MCP 链路测试报告（修正版）

- **测试时间**: 2026-10-13 23:22 → 23:50 (Asia/Shanghai)
- **被测插件**: `dsh-growth-studio` (workspace: `/home/dust/Desktop/dsh-growth-studio`)
- **被测工具**: `ops_fetch_metrics`
- **最终结论**: ❌ **BrowserOS MCP 本身完全正常、且已登录全部目标平台；但 DSH 侧没有注册这个 MCP server，所以插件拿不到 client，`ops_fetch_metrics` 走了「诚实空值」分支。**

> ⚠️ 本文件为修正版。第一版报告中「BrowserOS 未运行」「asar 内 0 命中」等结论**有误**，已在下文勘误。

---

## 1. 工具返回的原始数据（第一轮）

| 平台渠道 | 阅读/播放量 | 点赞 | 评论 | 转发/分享 | 粉丝增长 |
|---|---|---|---|---|---|
| wechat_mp | 0 | - | - | - | +0 |
| wechat_channels | 0 | - | - | - | +0 |
| bilibili | 0 | - | - | - | +0 |
| douyin | 0 | - | - | - | +0 |

---

## 2. 事实核查：BrowserOS MCP 是好的

用户反馈「我的 BrowserOS MCP 是正常的」——**经核实，用户是对的**。

### 2.1 BrowserOS 进程与服务

```
$ ls /usr/lib/browseros/          → browseros 可执行 + chromium + chromedriver
$ cat ~/.browseros/server.json
{
  "server_port": 9200,
  "cdp_port": 9107,
  "url": "http://127.0.0.1:9200",
  "server_version": "0.0.167",
  "browseros_version": "0.50.5.0",
  "browseros_id": "7876901e-c4ef-454a-96ca-df000e3b5e98"
}
```

9200（server）与 9107（CDP）均在监听。我第一轮只探测了 9222/9223/17688 等少数端口，**漏掉了实际端口**，误判为「未运行」。

### 2.2 MCP 注册清单

`~/.browseros/mcp-manager/manifest.json`：

```json
{
  "servers": {
    "browseros": {
      "spec": { "transport": "http", "url": "http://127.0.0.1:9002/mcp" }
    }
  }
}
```

已在 Codex / Cursor / Claude Code / opencode / antigravity 注册。**MCP endpoint = `http://127.0.0.1:9002/mcp`**，server name = `browseros`（serverInfo.name 实为 `browseros_mcp`）。

### 2.3 MCP 握手与工具列表（实测通过）

```
initialize → {"serverInfo":{"name":"browseros_mcp","version":"0.0.167"}}
tools/list  → 29 个工具:
act, connector_mcp_servers, diff, discover_server_categories_or_actions,
download, evaluate, execute_action, get_action_details, get_category_actions,
grep, handle_auth_failure, history, navigate, pdf, read, run,
screenshot, search_documentation, snapshot, tab_groups, tabs, upload, wait, windows
```

### 2.4 所有目标平台均已登录（实测）

```
$ tabs action=list
[1] https://channels.weixin.qq.com/platform/post/list      (视频号助手)
[2] https://creator.xiaohongshu.com/new/note-manager       (小红书创作平台)
[3] https://creator.douyin.com/creator-micro/content/manage(抖音创作者中心)
[4] https://member.bilibili.com/platform/upload-manager/article (B站创作中心)
[5] https://mp.weixin.qq.com/cgi-bin/home?...&token=995808872 (公众号)
```

### 2.5 真实数据已实测抓取成功

**哔哩哔哩**（`member.bilibili.com/platform/home`）：
```
视频数据（截至 2026-10-12，每日12点更新）
播放量 296 | 评论 2 | 弹幕 0 | 点赞 27 | 分享 1 | 收藏 13 | 投币 2
粉丝概览：粉丝总数 1 | 今日粉丝数变化 +0
成为UP主第 301 天
```

**抖音**（`creator.douyin.com/creator-micro/content/manage`）：

| 作品 | 发布日期 | 播放 | 点赞 | 评论 | 分享 | 收藏 | 吸粉 |
|---|---|---|---|---|---|---|---|
| 第一次认识 InJoys Studio（00:30） | 2026-10-10 13:18 | 165 | 0 | 0 | 1 | 1 | 0 |
| 换个AI助手，表格还要重做吗？（00:40） | 2026-10-09 13:56 | 126 | 1 | 0 | 0 | 0 | 1 |
| 20条订单消息，AI直接整理进表格（00:29） | 2026-10-06 01:28 | 238 | 2 | 0 | 0 | 0 | 0 |
| 客户催报价？AI根据旧资料起草新报价单（00:15） | 2026-10-02 23:30 | 106 | 0 | 0 | 0 | 0 | 0 |
| 客户催报价？AI 翻旧数据直接出单（00:38） | — | — | — | — | — | — | — |

**视频号**（`channels.weixin.qq.com/platform`）：
```
账号 injoys.ai | 视频号ID sphTL4bjVl4YTv0
视频 13 | 关注者 12 | 视频已获推荐 10
昨日数据：净增关注 0 | 新增播放 8 | 新增评论 0
```

**小红书**（`creator.xiaohongshu.com/new/note-manager`）：

| 笔记 | 日期 | 阅读 |
|---|---|---|
| 你的AI还在陪你聊天？我的会直接干活 | 2026-10-01 | 50000 |
| 留下邮箱，我邀请你们，1000积分。#gpt | 2026-09-22 | 19300 |
| PageIQ Agent：终极三合一网页超级智能 | 2026-08-31 | 8150 |
| 浏览器侧边栏 AI 助手 | 2026-07-19 | 14420 |
| （第 5 篇） | 2026-07-09 | 18000 |

合计 5 篇已发布。

> **结论：数据链路在 BrowserOS 侧完全通畅，抓取无技术障碍。**

---

## 3. 真正的根因：DSH 未注册 `browseros` MCP server

### 3.1 DSH 的 MCP 接入机制

`dsh-mcp-client` 以 Cordis 插件形式把外部 MCP server 的工具注册为 agent 原生工具，命名规则 `mcp__<serverName>__<tool>`（`publicToolName()` in `dsh-mcp-client`）。注册方式是在 profile 的 `cordis.patch.yml` 里加一条：

```yaml
- id: mcp-browseros
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: browseros
    transport: streamable-http
    url: http://127.0.0.1:9002/mcp
```

### 3.2 当前 profile 没有这条

`/home/dust/.dsh/profiles/desktop/cordis.patch.yml` 实际内容只有 6 条（agent-default-model / ui-settings-account / ui-chat / ui-settings / locale / 等），**无任何 `dsh-mcp-client` 条目**。`desktop/cordis.yml` 是空数组 `[]`。

asar 内置默认 profile 中只出现文档示例 `mcp-github` / `mcp-web`，没有 `browseros`。

### 3.3 因此插件侧 `browserOsClient` 恒为 undefined

`src/index.ts:56-71` 尝试从 Cordis context 取：

```ts
const rawBrowserOs = ctx.get("browserOsClient", false) ?? ctx.get("browseros", false)
const rawMcp = ctx.get("mcp", false) ?? ctx.get("mcpHub", false) ?? ctx.get("mcpClient", false)
const browserOsClient = rawBrowserOs ?? (rawMcp?.callTool
  ? { callTool: (t, a) => rawMcp.callTool("browseros", t, a) }
  : undefined)
```

`dsh-mcp-client` 不向 Cordis context 提供上述任何一个 key，它只把工具注册到 `ctx.tools`。所以三条路全落空，`browserOsClient === undefined`。

### 3.4 二级断链：工具路径压根没接 client

`src/index.ts:72`：
```ts
const tools = createOpsTools(injoys, adapters, ctx, draftStore)   // 第5参 metricsCollector 未传
```

`src/tools/index.ts:35`：
```ts
const actualMetricsCollector = metricsCollector ?? new MetricsCollector({ mockOffline: isMockMetrics })
```

→ 工具内部自己 new 的 collector **只带 mockOffline，从未获得 browserOsClient**。
（对比：`src/ops-rpc.ts:53` 的 `new MetricsCollector({ browserOsClient })` 是对的，供桌面工作台用。两条路径不共享实例。）

### 3.5 落到「诚实空值」分支

`src/analytics/metrics-collector.ts:47-60` 不做假数据，全部返回 `null` / `views: 0`，于是渲染成全 0 表格。

---

## 4. 三级问题：即使接上 client，live 采集也是空壳

`src/analytics/metrics-collector.ts:66-136` `collectLivePlatformMetrics`：

```ts
await client.callTool('navigate', { url: 'https://mp.weixin.qq.com/misc/appmsganalysis?action=all' })
const snap = await client.callTool('snapshot', {})   // 拿到了
results.push({ platform, capturedAt, impressions: null, ..., views: 0 })  // 但全写死 null
```

- 注释说「含数字就提取」，**无任何解析代码**，`snap` 被丢弃。
- `bilibili` 有 navigate，但 `wechat_channels` / `douyin` 在 live 分支里连 navigate 都没有，直接走 catch 兜底。
- 该方法返回值**恒等于**空值分支。

另外调用形态也不对：BrowserOS 的 `navigate` 必填 `page`（页码），插件代码没传，实测报：
```
Input validation error: Invalid arguments for tool navigate: page: expected number, received undefined
```

---

## 5. 修复方案

### P0-1 在 DSH profile 注册 MCP server（不改代码，先打通）

编辑 `/home/dust/.dsh/profiles/desktop/cordis.patch.yml`，追加：

```yaml
- id: mcp-browseros
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: browseros
    transport: streamable-http
    url: http://127.0.0.1:9002/mcp
    failOnStartupError: false
```

重启 DSH 后，模型侧应出现 `mcp__browseros__tabs`、`mcp__browseros__navigate`、`mcp__browseros__read`、`mcp__browseros__snapshot` 等工具。

### P0-2 让插件通过 `ctx.tools` 反查 MCP 工具（替代猜 service key）

`dsh-mcp-client` 只注册工具、不提供 service。插件应改为从工具表按 `mcp__browseros__*` 前缀查找并转发，而不是 `ctx.get("mcp")`：

```ts
function resolveBrowserOsClient(ctx: Context): BrowserOsMcpClient | undefined {
  const registry: any = (ctx as any)?.tools
  const names: string[] = registry?.list ? registry.list() : Object.keys(registry ?? {})
  const matched = names.filter(n => n.startsWith('mcp__browseros__'))
  if (matched.length === 0) return undefined
  return {
    callTool: async (tool, args = {}) => {
      const full = `mcp__browseros__${tool}`
      if (!matched.includes(full)) throw new Error(`BrowserOS 无工具 ${tool}（可用: ${matched.map(m=>m.replace('mcp__browseros__','')).join(', ')}）`)
      return registry.callTool ? registry.callTool(full, args) : registry[full](args)
    }
  }
}
```
（需按 Cordis `tools` 实际 API 调整；`ctx.get('tools')` 拿 registry。）

### P0-3 把 client 传进工具路径

`src/index.ts:72` 改为：
```ts
const tools = createOpsTools(injoys, adapters, ctx, draftStore, new MetricsCollector({ browserOsClient }))
```
并给 `createOpsTools` 增加 `browserOsClient` 形参兜底，与 `ops-rpc.ts:53` 共用同一 client。

### P1 实现真实解析

- 用 `read` / `snapshot` / `grep` 的文本做正则提取，而不是丢弃。
- 每平台返回 `source: 'live' | 'unmeasured'`，区分「真的 0」与「没测到」。
- 各平台数据源 URL（已验证可达）：

| 平台 | URL | 备注 |
|---|---|---|
| bilibili | `member.bilibili.com/platform/home` | 首页即含播放/点赞/粉丝概览，最稳 |
| douyin | `creator.douyin.com/creator-micro/content/manage` | 逐作品数据齐全 |
| wechat_channels | `channels.weixin.qq.com/platform` | 首页含昨日数据 |
| xiaohongshu | `creator.xiaohongshu.com/new/note-manager` | 笔记列表含阅读数 |
| wechat_mp | `mp.weixin.qq.com/misc/appmsganalysis?action=all` | ⚠️ 实测该页要求重新登录，需人工处理 |

### P2 BrowserOS 调用细节

- `navigate` 必须带 `page`（tab 序号）；优先复用已登录 tab，避免新 tab 丢登录态（实测新 tab 打开微信分析页直接跳登录）。
- session handle：从任一结果的 `_meta["com.browseros/session"]` 取出并回传，可保持同一浏览器会话与 tab 归属。
- 页面返回文本带 `[UNTRUSTED_PAGE_CONTENT nonce=...]` 包裹，解析时应剥离该层。

---

## 6. 第一版报告勘误

| 第一版结论 | 修正 |
|---|---|
| BrowserOS 未运行、无监听端口 | ❌ 错误。server 9200 / cdp 9107 均在监听，我只探测了 9222/9223/17688 |
| asar 内 `BrowserOS` 0 命中，宿主无此服务 | ❌ 错误结论。`browseros` 不是 DSH 内置服务，而是**用户侧 MCP server**，本就不该在 asar 内 |
| MCP hub 桥接 key 猜错 | ✅ 结论仍成立，但根因是「DSH 根本没注册该 server」，不是 key 拼写问题 |
| 工具未接 browserOsClient | ✅ 成立（`src/index.ts:72` 漏传 + `tools/index.ts:35` 自建 collector） |
| live 采集是空壳 | ✅ 成立 |

---

## 7. 自测建议

按 P0-1 注册并重启 DSH 后，可直接在会话里让模型调用 `mcp__browseros__tabs` 验证。确认工具可见后，再跑 `ops_fetch_metrics`；若仍为 0，则是 P0-2/P0-3 未生效。`tests/ops-manager.spec.ts` 已有 mock BrowserOS client 的成功/失败用例，可作为接真实 client 的回归基线。
