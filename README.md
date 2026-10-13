---
description: "Growth Studio plugin for DeepSeek Harness: Orchestrates Injoys & BrowserOS MCP for knowledge retrieval, cross-platform calendar planning, copy generation, and draft prefilling."
kind: "package-reference"
---

# @deepseek-ai/dsh-growth-studio

## Overview

`dsh-growth-studio` (Growth Studio) is an all-in-one growth marketing and operations agent workbench plugin built for personal products and indie hackers. Running as a native Cordis plugin in DeepSeek Harness (DSH), it orchestrates Injoys MCP and BrowserOS MCP to provide full-cycle growth tooling and scenario skill studios for AI agents.

## 目录

- [核心功能](#core-features)
- [工具列表](#tool-list)
- [适配器矩阵](#adapter-matrix)
- [配置](#configuration)

-----

<a id="core-features"></a>
## 核心功能

1. **知识库与资产闭环**：基于 Injoys MCP 查询产品卖点、调性与 FAQ，自动将排期写入 Injoys 表格，将图文底稿存入 Injoys 文档。
2. **多平台草稿箱预填**：基于 BrowserOS MCP 复用本地宿主已登录的浏览器 Profile，自动将生成好的图文与本地成片预填至各平台草稿箱。
3. **人机协同审核**：在 DSH 会话中输出富文本审核卡片，提供直达草稿箱的链接，由用户快速核对后点击发布。
4. **数据复盘与爆款计算**：采集多平台播放量、互动率与涨粉指标，自动计算爆款率并输出复盘报告沉淀至 Injoys 文档。
5. **用户反馈与需求回流**：跨渠道抓取受众评论，聚类提炼 Bug 与功能需求写入 Injoys 需求池，并将高频提问沉淀到知识库 FAQ。
6. **自动化任务无缝联动**：挂载 DSH 系统侧边栏的「自动化任务」，支持设置周发布巡检日历与定时唤醒。

-----

<a id="tool-list"></a>
## 工具列表

| 工具名 | 作用 |
|---|---|
| `ops_plan_calendar` | 结合知识库生成周/月排期，并写入 Injoys 表格 |
| `ops_draft_article` | 撰写公众号深度图文，生成摘要与排版，存入 Injoys 文档 |
| `ops_draft_video_meta` | 输入本地视频文件，生成 3 套爆款标题、标签与分镜打点 |
| `ops_push_drafts` | 调用 BrowserOS 预填草稿箱，返回各平台直达审核链接 |
| `ops_fetch_metrics` | 采集微信公众号、视频号、B站、抖音的运营数据并同步指标表格 |
| `ops_generate_review` | 分析跨渠道数据，计算爆款率、互动率与转化漏斗，生成复盘报告 |
| `ops_fetch_comments` | 跨渠道批量抓取受众真实评论、高频提问与点赞互动 |
| `ops_extract_feedback` | 聚类提炼 BUG 与功能需求，更新 Injoys 需求池与知识库 FAQ |
| `ops_discover_trends` | 嗅探赛道行业热搜、高播放选题模式与关键词热度评分 |
| `ops_setup_schedule` | 注册定时巡检规则（如每周一早9点复盘），直接联动 DSH「自动化任务」 |
| `ops_draft_launch_kit` | 生成针对海外受众的 Product Hunt Launch 物料包与 Twitter/X 爆款发布 Thread，提供最佳发布时区建议 |

-----

<a id="adapter-matrix"></a>
## 适配器矩阵

- **微信生态**：微信公众号 (`wechat_mp`)、微信视频号 (`wechat_channels`)
- **国内视频生态**：哔哩哔哩 (`bilibili`)、抖音创作者服务平台 (`douyin`)
- **海外主流阵地**：
  - **YouTube Studio** (`youtube`)：长视频教程、前沿实战分享
  - **TikTok Creator Studio** (`tiktok`)：短视频竖屏高转化实操展示
  - **Twitter / X** (`twitter_x`)：独立开发者 5 部曲 Launch Thread 连推、痛点互动
  - **Product Hunt** (`product_hunt`)：00:01 AM PT 日榜冲榜 Launch Kit、Maker 故事评论与沉淀
