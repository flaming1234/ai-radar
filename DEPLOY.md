# 部署到 Vercel（方案 A：静态站 + GitHub Actions 每日 9 点抓取）

整个流程一次性完成约 15-20 分钟。需要的账号：GitHub、Vercel（用 GitHub 登录即可）、OpenRouter（你已有 Key）。

## 一、推到 GitHub

在 `D:\document\AI雷达\ai-radar` 目录下执行：

```bash
git init
git add .
git commit -m "initial: AI Radar v3"
```

到 GitHub 网页新建一个仓库（建议设为 **public** 让朋友看；如果想 private 也行，Vercel 都支持）。名字随意，假设叫 `ai-radar`。**不要勾选** "Add README" / ".gitignore" / "license"，让仓库为空。

然后：

```bash
git branch -M main
git remote add origin https://github.com/<你的用户名>/ai-radar.git
git push -u origin main
```

## 二、把 OpenRouter Key 写进 GitHub Secret

仓库页面 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**：

- Name: `OPENROUTER_API_KEY`
- Secret: 你那串 `sk-or-v1-...`

保存。GitHub Actions 跑的时候会自动注入。**不要**把 Key 写进 `.env` commit，`.env` 已经在 `.gitignore` 里。

## 三、连接到 Vercel

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录。
2. 点 **Add New** → **Project**，找到 `ai-radar` 仓库，**Import**。
3. Framework Preset：保持 **Other**（不要选任何框架）。
4. **Root Directory**：保持 `./`（仓库根）。
5. Output Directory：保持空（`vercel.json` 已经写好 `outputDirectory: "public"`）。
6. Build Command：保持空。
7. Install Command：保持空。
8. 点 **Deploy**。约 30 秒后会拿到一个公开 URL，类似 `https://ai-radar-<hash>.vercel.app`。

把这个 URL 发给朋友就能访问。

## 四、验证自动抓取

GitHub Actions 已经配置好北京时间每天 9:00 自动抓取并 commit。

**先手动跑一次确认链路通畅**：仓库页面 → **Actions** → 左侧 **AI Radar Daily Fetch** → 右上 **Run workflow** → 绿色按钮 **Run workflow**。

等 1-2 分钟，workflow 跑完后：
- 仓库会自动多一个新 commit `daily fetch 2026-XX-XX ...`，由 `github-actions[bot]` 提交
- Vercel 接收到 push 后自动重新部署（30-60 秒）
- 刷新你的 Vercel URL 就能看到新数据

之后每天北京时间 9:00（GitHub 的 cron 是尽力调度，可能延迟 0-30 分钟）会自动触发一次。

## 五、想加晚上 9 点也抓一次

编辑 `.github/workflows/daily-fetch.yml` 里的 cron：

```yaml
schedule:
  - cron: '0 1 * * *'   # 北京时间 09:00
  - cron: '0 13 * * *'  # 北京时间 21:00
```

commit + push 后生效。

## 六、本地开发还能用吗

完全可以。改完代码后：

```bash
node scripts/serve.mjs
# 打开 http://localhost:4173
```

- 「刷新资讯」按钮**只在 localhost 可见**（生产环境自动隐藏），点了会真的花 OpenRouter 的钱（约 $0.25-0.30）
- 收藏存在浏览器 `localStorage`，跨设备不同步（这是方案 A 的限制）

## 七、成本预算

- OpenRouter：每次 refresh 约 **$0.25-0.30**（5 次 `:online` 抓取 + 1 次综述合成）
  - 一天 1 次：~$9/月
  - 一天 2 次：~$18/月
- GitHub Actions：**免费**（公共仓库无限分钟，私有仓库每月 2000 分钟够用）
- Vercel：**免费**（Hobby 套餐，足够个人项目）

## 八、常见问题

**Q：朋友能看到我的 OpenRouter Key 吗？**  
A：不能。Key 只在 GitHub Actions 服务器执行时存在，从不写入仓库。Vercel 上是纯静态文件，没有任何 Key 暴露。

**Q：我的 OpenRouter 余额能撑多久？**  
A：按你充值的额度除以月成本即可估算。OpenRouter 余额低于 $1 时会发邮件提醒。

**Q：今日综述写得不好怎么办？**  
A：在 GitHub 网页删掉对应的 `public/archive/YYYY-MM-DD.json` 然后 commit，或本地手动重跑 `node scripts/fetch-news.mjs` 再 push。

**Q：想增加新账号怎么办？**  
A：编辑 `src/x-accounts.mjs` 的 `X_S_TIER` 或 `X_A_TIER`，push 后下次自动抓取生效。

**Q：archive 越积越多会不会慢？**  
A：每个日归档约 30-50KB。一年 360 个文件 ≈ 15MB。Vercel 静态托管完全可承受，前端按需懒加载也不会卡。

## 九、安全建议

- **不要** push `.env` —— 已经在 `.gitignore` 里
- 仓库**最好设为 public**，否则 Vercel 免费档不能用（Vercel Free 不支持私有 GitHub 仓库自动部署，需要 Pro $20/月）
- 如果担心 Key 被滥用：登录 [OpenRouter](https://openrouter.ai/settings/keys) 给这个 Key 设单日花费上限（推荐 $2/day），到顶了就停，防意外

## 十、要不要再做收藏跨设备同步？

方案 A 不带收藏同步。如果以后想做：把 `localStorage` 换成 Supabase，加个邮箱登录。1-2 小时工作量。先用着方案 A 没问题，需要再升级。
