# AI 资讯雷达 (AI Radar) v2

一期数据源：**X / Twitter only**（参考 SPRD §13）。
通过 OpenRouter 调用 `x-ai/grok-4.3:online` 获取 S/A 级账号近 7 天的高信号帖子（带真实 tweet URL），并用 `anthropic/claude-haiku-4.5` 合成 Latent.Space AINews 风格的今日综述。

## 快速开始

```bash
node scripts/serve.mjs
# 打开 http://localhost:4173 → 点击右上角「刷新资讯」
```

## 环境变量

```env
OPENROUTER_API_KEY=sk-or-v1-...
# X 抓取（必须带 :online 后缀以拿到真实链接）
OPENROUTER_X_MODEL=x-ai/grok-4.3:online
# 综述合成（无需联网，便宜稳定）
OPENROUTER_ROUNDUP_MODEL=anthropic/claude-haiku-4.5
PORT=4173
```

## 视图

- **资讯** — 卡片流，每条带 @handle / S/A 标签 / 主题标签 / why_it_matters / 原文链接。顶部有搜索框，左侧可按主题、按账号筛选。
- **收藏** — 本地浏览器存储。
- **今日综述** — Latent.Space AINews 风格：标题判断 + 头条段落 + AI Twitter Recap 分组 + Top Tweets + 今日结论。
- **数据看板** — X 抓取统计 + 批次健康度 + 最活跃账号。

## 接口

- `GET  /` — 页面
- `GET  /api/news` — 当前 X feed + roundup
- `GET  /api/sources` — 抓取批次状态
- `POST /api/refresh` — 触发抓取（约 30-90 秒，含 4 次 `:online` 调用 + 1 次综述合成）
- `POST /api/x-search` — 单查询 X 信号搜索（保留，前端 UI 已不暴露）
- `GET  /api/x-accounts` — 返回 S/A 级账号池

## 数据流

```
                     ┌─────────────────────────────────┐
POST /api/refresh ───►  scripts/fetch-news.mjs         │
                     │   ↓                              │
                     │  src/x-fetcher.mjs               │
                     │   ↓ 4 并行 :online 调用           │
                     │   - S 研究者+官方 (33)           │
                     │   - S Coding+Infra (28)         │
                     │   - S Evals+开源+媒体 (21)       │
                     │   - A 全部 (39)                  │
                     │   ↓ 去重+排序+按账号聚合          │
                     │  src/summarizer.mjs              │
                     │   ↓ Claude Haiku 合成今日综述    │
                     │  public/news.json                │
                     └─────────────────────────────────┘
```

## 目录

```
ai-radar/
├── package.json / .env / .gitignore / README.md
├── scripts/
│   ├── serve.mjs        — HTTP 服务（4173）
│   ├── fetch-news.mjs   — 抓取入口
│   └── debug-grok.mjs   — 模型对比测试（开发用）
├── src/
│   ├── sources.mjs      — 主题枚举 + topic 推断
│   ├── x-accounts.mjs   — S(82) / A(39) 账号池 + 分组 + canonicalHandle
│   ├── x-fetcher.mjs    — X feed 抓取（4 并行批次）
│   └── summarizer.mjs   — 今日综述合成 + X 搜索接口
└── public/
    ├── index.html / styles.css / app.js
    └── news.json / news-data.js (运行时生成)
```

## v2 与 v1 的差异

- 去掉所有 RSS 源（机器之心、OpenAI News、HF Blog 等）；仅保留 X。
- 资讯卡片现在以 X 推文为主：@handle / 推文正文 / why_it_matters / 真实 tweet URL。
- 侧边栏来源按 S/A 级、再按组（研究者/官方/Coding/Infra/Evals/开源/媒体）分组展示。
- 区域筛选移除（全部海外 X）。
- 「搜索」「X 信号」独立视图移除；搜索框内嵌在「资讯」顶部。
- 「今日精简」改为「今日综述」，结构升级到 Latent.Space AINews 风格：标题+副标题、3-6 段头条、AI Twitter Recap 分组、5-8 条 Top Tweets、3-5 条今日结论。
