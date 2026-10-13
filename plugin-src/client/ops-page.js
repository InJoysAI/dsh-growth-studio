import * as React from 'react'

export function OpsPage({ close, rpcCall }) {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [notice, setNotice] = React.useState(null)

  // Injoys Test State
  const [testingInjoys, setTestingInjoys] = React.useState(false)
  const [injoysTestResult, setInjoysTestResult] = React.useState(null)

  // Show/Hide Token
  const [showToken, setShowToken] = React.useState(false)

  // Form State
  const [form, setForm] = React.useState({
    defaultProduct: 'DeepSeek Harness',
    endpoint: 'http://127.0.0.1:17688/mcp',
    token: 'SP4YowBGMpPJKiW1bUu2gfprMjL_BjqsX18JvV_9v9Y',
    reuseHostBrowserProfile: true,
    autoSyncToInjoys: true,
  })

  // Platform sessions state
  const [platformSessions, setPlatformSessions] = React.useState([])
  const [refreshingSessions, setRefreshingSessions] = React.useState(false)

  // Initial load
  React.useEffect(() => {
    let active = true

    async function load() {
      try {
        const configData = await rpcCall('config.get', {})
        if (active && configData) {
          setForm({
            defaultProduct: configData.defaultProduct || 'DeepSeek Harness',
            endpoint: configData.injoys?.endpoint || 'http://127.0.0.1:17688/mcp',
            token: configData.injoys?.token || '',
            reuseHostBrowserProfile: configData.reuseHostBrowserProfile ?? true,
            autoSyncToInjoys: configData.autoSyncToInjoys ?? true,
          })
        }
      } catch (err) {
        console.warn('[ops] load config failed:', err)
      }

      try {
        const sessionsData = await rpcCall('browser.sessions', {})
        if (active && sessionsData?.statuses) {
          setPlatformSessions(sessionsData.statuses)
        }
      } catch (err) {
        console.warn('[ops] load sessions failed:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [rpcCall])

  const handleSave = async () => {
    setSaving(true)
    setNotice(null)
    try {
      await rpcCall('config.save', {
        defaultProduct: form.defaultProduct.trim(),
        reuseHostBrowserProfile: form.reuseHostBrowserProfile,
        autoSyncToInjoys: form.autoSyncToInjoys,
        injoys: {
          endpoint: form.endpoint.trim(),
          token: form.token.trim(),
        },
      })
      setNotice({
        kind: 'success',
        text: '✓ Ops 配置已成功保存，并在运行时即时生效！',
      })
      setTimeout(() => setNotice(null), 5000)
    } catch (err) {
      setNotice({
        kind: 'error',
        text: `保存失败: ${err?.message || String(err)}`,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestInjoys = async () => {
    setTestingInjoys(true)
    setInjoysTestResult(null)
    try {
      const res = await rpcCall('injoys.test', {
        endpoint: form.endpoint.trim(),
        token: form.token.trim(),
      })
      setInjoysTestResult(res)
    } catch (err) {
      setInjoysTestResult({
        connected: false,
        message: err?.message || '连接请求失败',
      })
    } finally {
      setTestingInjoys(false)
    }
  }

  const handleRefreshSessions = async () => {
    setRefreshingSessions(true)
    try {
      const res = await rpcCall('browser.sessions', {})
      if (res?.statuses) {
        setPlatformSessions(res.statuses)
      }
    } catch (err) {
      console.warn('[ops] refresh sessions failed:', err)
    } finally {
      setRefreshingSessions(false)
    }
  }

  return React.createElement(
    'div',
    { className: 'dim-ops-page', 'aria-label': 'Growth Studio Settings' },
    // Header
    React.createElement(
      'div',
      { className: 'dim-ops-header' },
      React.createElement(
        'div',
        { className: 'dim-ops-title-group' },
        React.createElement(
          'h2',
          { className: 'dim-ops-title' },
          'Growth Studio 增长工坊配置',
          React.createElement('span', { className: 'dim-ops-title-badge' }, 'Growth Studio'),
        ),
        React.createElement(
          'p',
          { className: 'dim-ops-desc' },
          '配置 Injoys 资产中枢与 BrowserOS 浏览器执行引擎的 MCP 接入参数及增长运营规则',
        ),
      ),
      React.createElement(
        'div',
        { className: 'dim-ops-header-actions' },
        React.createElement(
          'button',
          {
            className: 'dim-ops-btn',
            type: 'button',
            onClick: handleTestInjoys,
            disabled: testingInjoys || loading,
          },
          testingInjoys ? '正在测试...' : '测试 Injoys 连通性',
        ),
        React.createElement(
          'button',
          {
            className: 'dim-ops-btn',
            'data-variant': 'primary',
            type: 'button',
            onClick: handleSave,
            disabled: saving || loading,
          },
          saving ? '正在保存...' : '保存配置',
        ),
      ),
    ),

    // Notice banner
    notice &&
      React.createElement(
        'div',
        { style: { padding: '10px 24px 0 24px' } },
        React.createElement(
          'div',
          { className: 'dim-ops-notice', 'data-kind': notice.kind },
          React.createElement('span', null, notice.text),
          React.createElement(
            'button',
            {
              className: 'dim-ops-input-btn',
              style: { position: 'static' },
              onClick: () => setNotice(null),
            },
            '关闭',
          ),
        ),
      ),

    // Body
    React.createElement(
      'div',
      { className: 'dim-ops-body' },

      // Card 1: Injoys MCP
      React.createElement(
        'div',
        { className: 'dim-ops-card' },
        React.createElement(
          'div',
          { className: 'dim-ops-card-header' },
          React.createElement(
            'div',
            { className: 'dim-ops-card-title' },
            React.createElement('span', { className: 'dim-ops-card-icon' }, '📦'),
            'Injoys MCP 服务端配置（资产与知识库中枢）',
          ),
          injoysTestResult &&
            React.createElement(
              'span',
              {
                className: 'dim-ops-platform-status',
                'data-status': injoysTestResult.connected ? 'ok' : 'scan',
              },
              injoysTestResult.connected ? '✓ ' : '✕ ',
              injoysTestResult.message,
            ),
        ),
        React.createElement(
          'div',
          { className: 'dim-ops-form-grid' },
          // Endpoint row
          React.createElement(
            'div',
            { className: 'dim-ops-form-row' },
            React.createElement('div', { className: 'dim-ops-form-label' }, '服务地址 (Endpoint)'),
            React.createElement(
              'div',
              { className: 'dim-ops-form-field' },
              React.createElement('input', {
                className: 'dim-ops-input',
                type: 'text',
                value: form.endpoint,
                placeholder: 'http://127.0.0.1:17688/mcp',
                onChange: (e) => setForm({ ...form, endpoint: e.target.value }),
              }),
              React.createElement(
                'div',
                { className: 'dim-ops-form-hint' },
                'Injoys 本地或局域网 MCP 服务端 HTTP 接口地址。支持环境变量 INJOYS_MCP_ENDPOINT。',
              ),
            ),
          ),
          // Token row
          React.createElement(
            'div',
            { className: 'dim-ops-form-row' },
            React.createElement('div', { className: 'dim-ops-form-label' }, '访问令牌 (Token)'),
            React.createElement(
              'div',
              { className: 'dim-ops-form-field' },
              React.createElement(
                'div',
                { className: 'dim-ops-input-wrap' },
                React.createElement('input', {
                  className: 'dim-ops-input',
                  type: showToken ? 'text' : 'password',
                  value: form.token,
                  placeholder: '输入 Bearer Token',
                  onChange: (e) => setForm({ ...form, token: e.target.value }),
                }),
                React.createElement(
                  'button',
                  {
                    className: 'dim-ops-input-btn',
                    type: 'button',
                    onClick: () => setShowToken(!showToken),
                  },
                  showToken ? '隐藏' : '显示',
                ),
              ),
              React.createElement(
                'div',
                { className: 'dim-ops-form-hint' },
                '调用 Injoys MCP 接口所需的 Bearer 鉴权凭证。支持环境变量 INJOYS_MCP_TOKEN。',
              ),
            ),
          ),
          // Capabilities row
          React.createElement(
            'div',
            { className: 'dim-ops-form-row' },
            React.createElement('div', { className: 'dim-ops-form-label' }, '激活的 MCP 能力'),
            React.createElement(
              'div',
              { className: 'dim-ops-form-field' },
              React.createElement(
                'div',
                { className: 'dim-ops-tag-list' },
                React.createElement('span', { className: 'dim-ops-tag' }, '知识库问答 knowledge.list / ingest'),
                React.createElement('span', { className: 'dim-ops-tag' }, '发布日历表格 spreadsheet.applyOperations'),
                React.createElement('span', { className: 'dim-ops-tag' }, '图文文档创建 document.create'),
              ),
            ),
          ),
        ),
      ),

      // Card 2: BrowserOS MCP
      React.createElement(
        'div',
        { className: 'dim-ops-card' },
        React.createElement(
          'div',
          { className: 'dim-ops-card-header' },
          React.createElement(
            'div',
            { className: 'dim-ops-card-title' },
            React.createElement('span', { className: 'dim-ops-card-icon' }, '🌐'),
            'BrowserOS MCP 浏览器执行引擎',
          ),
          React.createElement(
            'button',
            {
              className: 'dim-ops-btn',
              style: { height: '26px', fontSize: '11px', padding: '0 8px' },
              type: 'button',
              onClick: handleRefreshSessions,
              disabled: refreshingSessions,
            },
            refreshingSessions ? '刷新中...' : '刷新平台登录状态',
          ),
        ),
        React.createElement(
          'div',
          { className: 'dim-ops-form-grid' },
          // Switch row
          React.createElement(
            'div',
            { className: 'dim-ops-switch-row' },
            React.createElement(
              'div',
              { className: 'dim-ops-switch-info' },
              React.createElement(
                'span',
                { className: 'dim-ops-switch-title' },
                '复用宿主日常浏览器登录态 (Reuse Host Browser Profile)',
              ),
              React.createElement(
                'span',
                { className: 'dim-ops-switch-desc' },
                '开启后自动发帖与草稿箱预填将直接复用宿主机器人的默认浏览器 Cookie，免去无头浏览器重复扫码登录',
              ),
            ),
            React.createElement(
              'label',
              { className: 'dim-ops-toggle' },
              React.createElement('input', {
                type: 'checkbox',
                checked: form.reuseHostBrowserProfile,
                onChange: (e) =>
                  setForm({ ...form, reuseHostBrowserProfile: e.target.checked }),
              }),
              React.createElement('span', { className: 'dim-ops-toggle-slider' }),
            ),
          ),
          // Platform session cards grid
          React.createElement(
            'div',
            { className: 'dim-ops-platforms-grid' },
            platformSessions.map((p) =>
              React.createElement(
                'div',
                { key: p.id, className: 'dim-ops-platform-item' },
                React.createElement(
                  'div',
                  { className: 'dim-ops-platform-name' },
                  React.createElement('span', null, p.kind === 'video' ? '🎬' : p.kind === 'post' ? '💬' : '📝'),
                  p.name,
                ),
                React.createElement(
                  'div',
                  { className: 'dim-ops-platform-actions' },
                  !p.loggedIn &&
                    React.createElement(
                      'a',
                      {
                        className: 'dim-ops-login-link',
                        href: p.draftEditorUrl,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        title: '在浏览器中打开此平台登录页面',
                      },
                      '去登录 ↗',
                    ),
                  React.createElement(
                    'span',
                    {
                      className: 'dim-ops-platform-status',
                      'data-status': p.loggedIn ? 'ok' : 'scan',
                      title: p.message || '',
                    },
                    p.loggedIn ? '✓ 就绪' : '⚠ 需登录',
                  ),
                ),
              ),
            ),
          ),
        ),
      ),

      // Card 3: Operations Strategy
      React.createElement(
        'div',
        { className: 'dim-ops-card' },
        React.createElement(
          'div',
          { className: 'dim-ops-card-header' },
          React.createElement(
            'div',
            { className: 'dim-ops-card-title' },
            React.createElement('span', { className: 'dim-ops-card-icon' }, '🎯'),
            '运营推广全局策略与自动化',
          ),
        ),
        React.createElement(
          'div',
          { className: 'dim-ops-form-grid' },
          // Default Product row
          React.createElement(
            'div',
            { className: 'dim-ops-form-row' },
            React.createElement('div', { className: 'dim-ops-form-label' }, '默认产品标识 (Product)'),
            React.createElement(
              'div',
              { className: 'dim-ops-form-field' },
              React.createElement('input', {
                className: 'dim-ops-input',
                type: 'text',
                value: form.defaultProduct,
                placeholder: 'DeepSeek Harness',
                onChange: (e) => setForm({ ...form, defaultProduct: e.target.value }),
              }),
              React.createElement(
                'div',
                { className: 'dim-ops-form-hint' },
                'Agent 在生成排期规划、文案撰写与海外推广物料时匹配的 Injoys 产品主体。',
              ),
            ),
          ),
          // Auto sync switch row
          React.createElement(
            'div',
            { className: 'dim-ops-switch-row' },
            React.createElement(
              'div',
              { className: 'dim-ops-switch-info' },
              React.createElement(
                'span',
                { className: 'dim-ops-switch-title' },
                '自动排期与复盘数据回写 Injoys',
              ),
              React.createElement(
                'span',
                { className: 'dim-ops-switch-desc' },
                '自动将生成的发布日历、公众号底稿以及周度运营复盘总结同步保存至 Injoys 表格与文档中',
              ),
            ),
            React.createElement(
              'label',
              { className: 'dim-ops-toggle' },
              React.createElement('input', {
                type: 'checkbox',
                checked: form.autoSyncToInjoys,
                onChange: (e) =>
                  setForm({ ...form, autoSyncToInjoys: e.target.checked }),
              }),
              React.createElement('span', { className: 'dim-ops-toggle-slider' }),
            ),
          ),
        ),
      ),
    ),
  )
}
