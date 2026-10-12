/**
 * Session Guard for detecting platform login states and guiding authentication.
 * @module @deepseek-ai/dsh-ops-manager/browser/session-guard
 */

import type { PlatformId } from '../types.js'

export interface PlatformLoginCheckConfig {
  readonly checkUrl: string
  readonly loginUrlPattern: RegExp
  readonly loggedInIndicator: RegExp
  readonly friendlyName: string
}

export const PLATFORM_LOGIN_CONFIGS: Record<PlatformId, PlatformLoginCheckConfig> = {
  wechat_mp: {
    checkUrl: 'https://mp.weixin.qq.com',
    loginUrlPattern: /(login|scan|qrcode)/i,
    loggedInIndicator: /(cgi-bin\/home|mp\.weixin\.qq\.com\/cgi-bin\/appmsg)/i,
    friendlyName: '微信公众号后台',
  },
  wechat_channels: {
    checkUrl: 'https://channels.weixin.qq.com/platform',
    loginUrlPattern: /(login|auth)/i,
    loggedInIndicator: /(channels\.weixin\.qq\.com\/platform\/post|dashboard)/i,
    friendlyName: '微信视频号助手',
  },
  bilibili: {
    checkUrl: 'https://member.bilibili.com/platform/home',
    loginUrlPattern: /(passport\.bilibili\.com|login)/i,
    loggedInIndicator: /(member\.bilibili\.com\/platform|upload)/i,
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

export interface SessionStatus {
  platform: PlatformId
  loggedIn: boolean
  currentUrl?: string
  guidanceMessage?: string
  scanRequired?: boolean
}

/**
 * Validates login status of platforms and produces actionable recovery instructions.
 */
export class SessionGuard {
  /**
   * Evaluate whether a URL and title indicates an active logged-in session.
   */
  evaluateState(platform: PlatformId, currentUrl: string): SessionStatus {
    const config = PLATFORM_LOGIN_CONFIGS[platform]
    if (!config) {
      return { platform, loggedIn: false, guidanceMessage: `未配置的平台: ${platform}` }
    }

    const isLoginGate = config.loginUrlPattern.test(currentUrl)
    const isLoggedIn = config.loggedInIndicator.test(currentUrl) && !isLoginGate

    if (!isLoggedIn) {
      return {
        platform,
        loggedIn: false,
        currentUrl,
        scanRequired: true,
        guidanceMessage: `检测到 ${config.friendlyName} 尚未登录或会话已过期。请在打开的浏览器窗口中使用手机扫码登录。`,
      }
    }

    return {
      platform,
      loggedIn: true,
      currentUrl,
      guidanceMessage: `${config.friendlyName} 会话有效。`,
    }
  }
}
