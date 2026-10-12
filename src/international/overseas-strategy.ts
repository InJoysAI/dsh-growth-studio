/**
 * Overseas Timezone Strategy & English Launch Prompt Templates.
 * @module @deepseek-ai/dsh-ops-manager/international/overseas-strategy
 */

import type {
  PlatformId,
  ProductKnowledgeContext,
  ProductHuntLaunchKit,
  TwitterThreadDraft,
  OverseasTimezoneStrategy,
} from '../types.js'

export class OverseasStrategyManager {
  /**
   * Recommend optimal posting time and timezone schedule for overseas platforms.
   */
  getTimezoneStrategy(
    platform: PlatformId,
    region: 'na_us' | 'eu' | 'apac' | 'global' = 'global',
  ): OverseasTimezoneStrategy {
    switch (platform) {
      case 'product_hunt':
        return {
          region: 'na_us',
          targetPlatform: platform,
          recommendedUtcHour: 7, // 00:01 AM PT
          recommendedLocalTime: '00:01 AM PST / 07:01 UTC',
          timeZone: 'America/Los_Angeles',
          bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
          rationale:
            'Product Hunt daily leaderboard resets at 12:01 AM PT. Launching immediately at reset provides the full 24-hour voting and discovery window.',
        }
      case 'twitter_x':
        return {
          region: region === 'eu' ? 'eu' : 'na_us',
          targetPlatform: platform,
          recommendedUtcHour: 16, // 09:00 AM PT / 12:00 PM ET
          recommendedLocalTime: '09:00 AM PT / 12:00 PM ET',
          timeZone: 'America/New_York',
          bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
          rationale:
            'US East & West Coast developers and tech founders overlap active hours between 9:00 AM PT and 1:00 PM ET.',
        }
      case 'youtube':
        return {
          region: 'global',
          targetPlatform: platform,
          recommendedUtcHour: 19, // 12:00 PM PT / 03:00 PM ET
          recommendedLocalTime: '12:00 PM PT / 03:00 PM ET',
          timeZone: 'America/Los_Angeles',
          bestDays: ['Thursday', 'Friday', 'Saturday'],
          rationale:
            'Long-form tech tutorial videos index best when published before the weekend, allowing YouTube recommendation models to test impressions.',
        }
      case 'tiktok':
        return {
          region: 'global',
          targetPlatform: platform,
          recommendedUtcHour: 2, // 07:00 PM PT
          recommendedLocalTime: '07:00 PM Local Time',
          timeZone: 'America/Los_Angeles',
          bestDays: ['Wednesday', 'Thursday', 'Sunday'],
          rationale:
            'Short-form vertical video algorithms peak during evening leisure hours between 7:00 PM and 9:30 PM.',
        }
      default:
        return {
          region: 'apac',
          targetPlatform: platform,
          recommendedUtcHour: 12, // 20:00 Beijing
          recommendedLocalTime: '20:00 CST',
          timeZone: 'Asia/Shanghai',
          bestDays: ['Monday', 'Wednesday', 'Sunday'],
          rationale: 'Domestic evening commute and post-dinner reading prime time.',
        }
    }
  }

  /**
   * Generate an authentic Product Hunt launch kit with tagline, description, and maker story.
   */
  generateProductHuntKit(ctx: ProductKnowledgeContext): ProductHuntLaunchKit {
    const rawTagline = `${ctx.productName}: Plugin-native AI agent harness for indie makers`
    const tagline = rawTagline.length <= 60 ? rawTagline : `${ctx.productName}: Autonomous agent ops harness`

    const description = [
      `🚀 Introducing ${ctx.productName} — ${ctx.tagline}.`,
      '',
      'Key Highlights:',
      ...ctx.coreFeatures.map(f => `• ${f}`),
      '',
      'Why we built it:',
      'As independent builders and developers, we spent hours manually copying drafts, formatting spreadsheets, and checking dashboards. We wanted an autonomous, local-first agent pipeline that connects BrowserOS and Injoys MCP to handle multi-channel marketing while keeping humans in the loop.',
    ].join('\n')

    const makerComment = [
      `Hey Product Hunt community! 👋 I am the creator of ${ctx.productName}.`,
      '',
      'Like many solo founders and developers, I love writing code but dreaded marketing logistics. Crafting posts, updating release calendars across 6 platforms, and tracking engagement felt like a full-time job.',
      '',
      `That is why we built ${ctx.productName}:`,
      '1. 📅 Automated Calendar & Backlog synced to Injoys sheets.',
      '2. ✍️ Multi-platform drafting (Articles, X Threads, Video metadata).',
      '3. 🚀 Direct pre-filling to platform draft boxes with one-click review cards.',
      '4. ⏰ Scheduled background inspection tasks via native Cordis plugins.',
      '',
      'We are 100% open-source and local-first — your cookies and credentials stay safely on your machine.',
      '',
      'We would love your candid feedback and thoughts! What channels do you find hardest to manage?',
    ].join('\n')

    return {
      name: ctx.productName,
      tagline,
      description,
      topics: ['Developer Tools', 'Artificial Intelligence', 'Productivity', 'Open Source'],
      makerComment,
      pricingType: 'free',
    }
  }

  /**
   * Generate a high-converting 5-part Twitter/X launch thread.
   */
  generateTwitterThread(ctx: ProductKnowledgeContext): TwitterThreadDraft {
    const hookTweet = `I spent months building ${ctx.productName} because I was tired of spending 80% of my time doing manual distribution instead of coding.\n\nHere is how I automated my entire marketing pipeline with an open-source agent 🧵👇`

    const bodyTweets = [
      '1/ The Problem:\n\nBuilding a product is hard, but distributing it is harder.\n\nEvery release meant:\n- Writing release notes\n- Formatting for 4+ platforms\n- Uploading videos & tags\n- Logging metrics in spreadsheets\n\nIt took 4-6 hours every single week.',
      `2/ The Solution: ${ctx.productName}\n\nA plugin-native Cordis agent harness that connects:\n• Injoys MCP (Knowledge base & Sheets)\n• BrowserOS MCP (Secure browser automation)\n• Host Schedule (Recurring weekly audits)\n\nZero manual copy-pasting.`,
      '3/ Human-in-the-loop by design:\n\nThe agent generates the copies, plans the release calendar, and pre-fills the draft boxes in YouTube, X, and WeChat.\n\nIt NEVER auto-publishes without review. You get a direct link to check the draft and click submit when satisfied.',
      '4/ The Results:\n\n• Publishing time cut from 4 hours to 10 minutes\n• Weekly review reports generated automatically\n• Community bug reports auto-clustered into our issue backlog',
    ]

    const callToActionTweet = `5/ ${ctx.productName} is fully open-source and privacy-preserving.\n\nTry it out, read the docs, and star the repo here: github.com/deepseek-ai/deepseek-harness\n\nFeedback and RTs are hugely appreciated! ❤️`

    return {
      hookTweet,
      bodyTweets,
      callToActionTweet,
      hashtags: ['#buildinpublic', '#indiedev', '#AI', '#opensource', '#productivity'],
    }
  }
}
