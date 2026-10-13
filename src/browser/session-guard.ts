/**
 * Session Guard for detecting platform login states and guiding authentication.
 * Evaluates BrowserOS session states and host cookies with four-state lifecycle.
 * @module @deepseek-ai/dsh-ops-manager/browser/session-guard
 */

import { copyFileSync, unlinkSync, existsSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import type { PlatformId, ContentKind, SessionState, PlatformSessionStatus } from '../types.js'

export interface PlatformLoginCheckConfig {
  readonly checkUrl: string
  readonly loginUrlPattern: RegExp
  readonly loggedInIndicator: RegExp
  readonly noPermissionPattern?: RegExp
  readonly friendlyName: string
}

export const PLATFORM_LOGIN_CONFIGS: Record<PlatformId, PlatformLoginCheckConfig> = {
  wechat_mp: {
    checkUrl: 'https://mp.weixin.qq.com',
    loginUrlPattern: /(login|scan|qrcode)/i,
    loggedInIndicator: /(cgi-bin\/home|mp\.weixin\.qq\.com\/cgi-bin\/appmsg)/i,
    noPermissionPattern: /(no_permission|forbidden|unauthorized)/i,
    friendlyName: '微信公众号后台',
  },
  wechat_channels: {
    checkUrl: 'https://channels.weixin.qq.com/platform',
    loginUrlPattern: /(login|auth)/i,
    loggedInIndicator: /(channels\.weixin\.qq\.com\/platform\/post|dashboard)/i,
    noPermissionPattern: /(no_permission|unauthorized)/i,
    friendlyName: '微信视频号助手',
  },
  bilibili: {
    checkUrl: 'https://member.bilibili.com/platform/home',
    loginUrlPattern: /(passport\.bilibili\.com|login)/i,
    loggedInIndicator: /(member\.bilibili\.com\/platform|upload)/i,
    noPermissionPattern: /(account\/appeal|banned)/i,
    friendlyName: '哔哩哔哩创作中心',
  },
  douyin: {
    checkUrl: 'https://creator.douyin.com/creator-micro/content/manage',
    loginUrlPattern: /(login|passport)/i,
    loggedInIndicator: /(creator\.douyin\.com\/creator-micro|upload)/i,
    friendlyName: '抖音创作者服务平台',
  },
  youtube: {
    checkUrl: 'https://studio.youtube.com',
    loginUrlPattern: /(accounts\.google\.com)/i,
    loggedInIndicator: /(studio\.youtube\.com\/channel)/i,
    friendlyName: 'YouTube Studio',
  },
  twitter_x: {
    checkUrl: 'https://x.com/home',
    loginUrlPattern: /(x\.com\/login|i\/flow\/login)/i,
    loggedInIndicator: /(x\.com\/home)/i,
    friendlyName: 'X (Twitter)',
  },
  product_hunt: {
    checkUrl: 'https://www.producthunt.com',
    loginUrlPattern: /(producthunt\.com\/login)/i,
    loggedInIndicator: /(producthunt\.com\/my\/profile)/i,
    friendlyName: 'Product Hunt',
  },
  tiktok: {
    checkUrl: 'https://www.tiktok.com/creator-center/upload',
    loginUrlPattern: /(tiktok\.com\/login)/i,
    loggedInIndicator: /(tiktok\.com\/creator-center)/i,
    friendlyName: 'TikTok 创作者中心',
  },
}

export interface PlatformCookieRule {
  readonly domain: string
  readonly cookieNames: readonly string[]
  readonly friendlyName: string
}

export const PLATFORM_COOKIE_RULES: Record<PlatformId, PlatformCookieRule> = {
  wechat_mp: {
    domain: 'mp.weixin.qq.com',
    cookieNames: ['data_ticket', 'slave_sid', 'bizuin', 'data_bizuin'],
    friendlyName: '微信公众号后台',
  },
  wechat_channels: {
    domain: 'channels.weixin.qq.com',
    cookieNames: ['sessionid', 'wxuin'],
    friendlyName: '微信视频号助手',
  },
  bilibili: {
    domain: 'bilibili.com',
    cookieNames: ['SESSDATA'],
    friendlyName: '哔哩哔哩创作中心',
  },
  douyin: {
    domain: 'douyin.com',
    cookieNames: ['sessionid', 'sessionid_ss', 'passport_assist_user'],
    friendlyName: '抖音创作者服务平台',
  },
  youtube: {
    domain: 'youtube.com',
    cookieNames: ['LOGIN_INFO', 'SAPISID', 'SID'],
    friendlyName: 'YouTube Studio',
  },
  twitter_x: {
    domain: 'x.com',
    cookieNames: ['auth_token'],
    friendlyName: 'X (Twitter)',
  },
  product_hunt: {
    domain: 'producthunt.com',
    cookieNames: ['_producthunt_session', 'remember_token'],
    friendlyName: 'Product Hunt',
  },
  tiktok: {
    domain: 'tiktok.com',
    cookieNames: ['sessionid', 'sessionid_ss'],
    friendlyName: 'TikTok 创作者中心',
  },
}

export interface SessionStatus {
  platform: PlatformId
  loggedIn: boolean
  state?: SessionState
  isReady?: boolean
  currentUrl?: string
  guidanceMessage?: string
  scanRequired?: boolean
}

/**
 * Validates login status of platforms and produces actionable recovery instructions.
 */
export class SessionGuard {
  /**
   * Find candidate host browser cookies SQLite path.
   */
  findHostBrowserCookiesPath(): string | null {
    const candidates: string[] = []
    const home = homedir()

    // Linux Chrome & Chromium variants
    candidates.push(
      join(home, '.config/google-chrome/Default/Cookies'),
      join(home, '.config/google-chrome/Profile 1/Cookies'),
      join(home, '.config/chromium/Default/Cookies'),
      join(home, '.config/browseros/Default/Cookies'),
      join(home, '.config/microsoft-edge/Default/Cookies'),
      join(home, '.config/BraveSoftware/Brave-Browser/Default/Cookies'),
    )

    // macOS
    candidates.push(
      join(home, 'Library/Application Support/Google/Chrome/Default/Cookies'),
      join(home, 'Library/Application Support/Chromium/Default/Cookies'),
      join(home, 'Library/Application Support/BrowserOS/Default/Cookies'),
    )

    // Windows
    if (process.env.LOCALAPPDATA) {
      candidates.push(
        join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data/Default/Network/Cookies'),
        join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data/Default/Cookies'),
        join(process.env.LOCALAPPDATA, 'Microsoft/Edge/User Data/Default/Network/Cookies'),
      )
    }

    return candidates.find(p => existsSync(p)) ?? null
  }

  /**
   * Check real host browser session for all platforms by reading host browser cookies.
   */
  async checkAllRealSessions(
    platforms: Array<{ id: PlatformId; name: string; kind: ContentKind; draftEditorUrl: string }>,
  ): Promise<PlatformSessionStatus[]> {
    const cookiePath = this.findHostBrowserCookiesPath()
    const detectedLoginMap = new Map<PlatformId, boolean>()
    const now = new Date().toISOString()

    if (cookiePath) {
      const tmp = join(tmpdir(), `dsh-cookies-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
      try {
        copyFileSync(cookiePath, tmp)
        const { DatabaseSync } = (await import('node:sqlite')) as any
        const db = new DatabaseSync(tmp, { readOnly: true })
        const query = db.prepare('SELECT host_key, name FROM cookies WHERE host_key LIKE ?')

        for (const [id, rule] of Object.entries(PLATFORM_COOKIE_RULES) as Array<[PlatformId, PlatformCookieRule]>) {
          try {
            const domainPattern = id === "bilibili" ? "%bilibili%" : `%${rule.domain}%`
            const rows = query.all(domainPattern) as Array<{ host_key: string; name: string }>
            const cookieNames = new Set(rows.map(r => r.name))
            const isLoggedIn = rule.cookieNames.some(name => cookieNames.has(name))
            detectedLoginMap.set(id, isLoggedIn)
          } catch {
            detectedLoginMap.set(id, false)
          }
        }
        db.close()
      } catch {
        // Fallback if sqlite cannot be read
      } finally {
        try {
          unlinkSync(tmp)
        } catch {
          // ignore
        }
      }
    }

    return platforms.map(p => {
      const isKnown = detectedLoginMap.has(p.id)
      const loggedIn = detectedLoginMap.get(p.id) ?? false
      const state: SessionState = loggedIn ? 'authenticated' : isKnown ? 'needs_login' : 'unknown'
      const message = loggedIn
        ? '已在浏览器会话中完成认证 (就绪)'
        : isKnown
          ? '未检测到有效登录凭证，请完成登录授权'
          : '尚未建立浏览器会话'

      return {
        id: p.id,
        platform: p.id,
        name: p.name,
        kind: p.kind,
        draftEditorUrl: p.draftEditorUrl,
        loggedIn,
        state,
        isReady: loggedIn,
        scanRequired: !loggedIn,
        message,
        lastCheckedAt: now,
      }
    })
  }

  /**
   * Evaluate whether a runtime URL indicates an active logged-in session, returning four-state SessionStatus.
   */
  evaluateState(platform: PlatformId, currentUrl: string): SessionStatus {
    const config = PLATFORM_LOGIN_CONFIGS[platform]
    if (!config) {
      return {
        platform,
        loggedIn: false,
        state: 'unknown',
        isReady: false,
        guidanceMessage: `未配置的平台: ${platform}`,
      }
    }

    const isLoginGate = config.loginUrlPattern.test(currentUrl)
    const isNoPermission = config.noPermissionPattern?.test(currentUrl) ?? false
    const isLoggedIn = config.loggedInIndicator.test(currentUrl) && !isLoginGate && !isNoPermission

    if (isNoPermission) {
      return {
        platform,
        loggedIn: false,
        state: 'no_publish_permission',
        isReady: false,
        currentUrl,
        scanRequired: false,
        guidanceMessage: `当前账号已登录 ${config.friendlyName}，但缺乏发帖或创作者权限。`,
      }
    }

    if (!isLoggedIn) {
      return {
        platform,
        loggedIn: false,
        state: isLoginGate ? 'needs_login' : 'unknown',
        isReady: false,
        currentUrl,
        scanRequired: true,
        guidanceMessage: `检测到 ${config.friendlyName} 尚未登录或会话已过期。请在打开的浏览器窗口中使用手机扫码登录。`,
      }
    }

    return {
      platform,
      loggedIn: true,
      state: 'authenticated',
      isReady: true,
      currentUrl,
      guidanceMessage: `${config.friendlyName} 会话有效。`,
    }
  }

  /**
   * Check sessions using BrowserOS active tab URLs and return PlatformSessionStatus list.
   */
  checkBrowserSessions(
    platforms: Array<{ id: PlatformId; name: string; kind: ContentKind; draftEditorUrl: string }>,
    activeTabs: Array<{ url: string }> = [],
  ): PlatformSessionStatus[] {
    const now = new Date().toISOString()

    return platforms.map(p => {
      const config = PLATFORM_LOGIN_CONFIGS[p.id]
      const matchingTab = activeTabs.find(tab => {
        if (!config) return false
        return tab.url.includes(new URL(config.checkUrl).hostname)
      })

      if (matchingTab) {
        const evalResult = this.evaluateState(p.id, matchingTab.url)
        const isReady = evalResult.loggedIn
        return {
          id: p.id,
          platform: p.id,
          name: p.name,
          kind: p.kind,
          state: evalResult.state ?? (isReady ? 'authenticated' : 'needs_login'),
          isReady,
          loggedIn: isReady,
          scanRequired: evalResult.scanRequired ?? !isReady,
          draftEditorUrl: p.draftEditorUrl,
          lastCheckedAt: now,
          message: evalResult.guidanceMessage ?? (isReady ? '就绪' : '需登录'),
        }
      }

      // Default to unknown if no matching tab exists yet
      return {
        id: p.id,
        platform: p.id,
        name: p.name,
        kind: p.kind,
        state: 'unknown',
        isReady: false,
        loggedIn: false,
        scanRequired: true,
        draftEditorUrl: p.draftEditorUrl,
        lastCheckedAt: now,
        message: '未检测到活动页面，点击“去登录”建立会话',
      }
    })
  }
}
