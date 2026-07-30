# AI 每日雷达（radar-web 云端版）

主线式 AI 日报 + 累积知识图谱。本仓库是 `radar-web` 的 Vercel 部署版：

- **静态站**：`public/` 整站（页面 + `content/daily.json` 日报数据 + `content/graph-index.json` 知识图谱索引 + `content/today-candidates.json` 当日候选精简版）。
- **serverless**：`api/public-agent.mjs` —— 雷达 Agent 问答，调 OpenRouter，key 从 Vercel 环境变量 `OPENROUTER_API_KEY` 读取。
- 本地版的 `/api/knowledge/graph`、`/api/today-candidates` 在云端由 `vercel.json` rewrite 到打包进仓库的静态 JSON。
- 登录 / 订阅为前端演示占位；审稿台（/admin）与本机 loopback 接口云端不存在。

## 数据更新方式

本仓库**不自己抓数据**（旧版的 GitHub Actions 每日抓取已移除）。数据由本地采集机的
`engine/run-daily.mjs` 每日流水线在发布成功后，经 `engine/publish-vercel.mjs`
把最新站点文件 + 数据复制进本仓库并 push，触发 Vercel 自动部署。

## 环境变量（Vercel 控制台）

| 变量 | 用途 |
|---|---|
| `OPENROUTER_API_KEY` | 雷达 Agent 问答（缺失时 Agent 返回 503，页面其余功能不受影响） |
