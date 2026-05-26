// X 数据抓取 — 通过 OpenRouter Grok 调取近 48h 高信号帖子
// SPRD §13 一期 X-only 数据源

import { getFetchBatches, tierOf, canonicalHandle, normalizeHandle } from './x-accounts.mjs';
import { inferTopic, isValidTopic } from './sources.mjs';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey() {
  return process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
}

function getXModel() {
  return process.env.OPENROUTER_X_MODEL || 'x-ai/grok-4.3';
}

async function callGrok({ messages, temperature = 0.3, max_tokens = 2400, timeoutMs = 150000 }) {
  const key = getApiKey();
  if (!key) throw new Error('missing_api_key');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'http://localhost:4173',
        'X-Title': 'AI Radar',
      },
      body: JSON.stringify({
        model: getXModel(),
        messages,
        temperature,
        max_tokens,
      }),
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`openrouter_${resp.status}: ${text.slice(0, 300)}`);
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(t);
  }
}

function extractJson(text) {
  if (!text) return null;
  // 优先匹配 ```json ... ``` 块
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (_) { return null; }
}

function isValidTweetUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\/(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/.test(url);
}

function buildBatchPrompt(batch) {
  const accountList = batch.accounts.join(', ');
  return {
    system: `你是 AI Engineer Radar 的数据采集助手，目标读者是 AI 工程师。请用 web 搜索功能去 X/Twitter（site:x.com 或 site:twitter.com）找下方账号在最近 7 天内发布的最重要 AI 相关帖子。

严格筛选规则：
1) 主题必须属于以下之一，必须填入 topic 字段：
   - models（模型发布/更新/对比）
   - agents（Agent、Harness、MCP、autonomous workflow）
   - coding（AI Coding、Cursor、Copilot、Claude Code、Codex 等）
   - infra（GPU、推理、vLLM、Modal、serving、runtime）
   - research（论文、RLHF、distillation、新方法）
   - products（产品发布、UI/UX、用户量）
   - evals（benchmark、leaderboard、Arena、MMLU、GPQA）
   - open_source（开源、Hugging Face、本地模型）
   - business（融资、估值、收购、营收）
2) 丢弃以下内容：生活、家庭、宠物、运动、节日、政治、八卦、闲聊、表情包、个人感受、政治观点、AI 行业历史趣闻（如某 CEO 早期 title）、纯转发无评论。
3) URL 必须是真实可访问的 tweet 链接（https://x.com/<handle>/status/<19 位数字>），不允许编造数字 ID。如果搜索结果里没有该账号的真实 tweet URL，宁可不要这一条。
4) 优先选有具体信号量的：版本号、价格、benchmark 数字、API 改动、新模型、重要演讲、被大量引用。

严格输出 JSON，不要解释、不要 markdown：
{
  "posts": [
    {
      "author": "@handle",
      "text": "推文原文（英文原文，截断到 280 字符以内）",
      "url": "https://x.com/handle/status/<19位数字ID>",
      "posted_at": "相对时间，例如 6h ago / 2d ago / 5d ago",
      "topic": "models|agents|coding|infra|research|products|evals|open_source|business",
      "why_it_matters": "为什么 AI Engineer 应该关注（中文，30 字内）"
    }
  ]
}`,
    user: `账号清单（${batch.tier} 级 · ${batch.label}，共 ${batch.accounts.length} 个）：
${accountList}

请用 web 搜索逐一查这些账号的近期 X 帖子，挑选 3-10 条最重要的输出 JSON。宁缺勿滥：如果该批次账号近一周没有合格内容，可以只返回 1-2 条甚至空数组，不要为凑数引入弱信号。`,
  };
}

async function fetchBatch(batch) {
  const started = Date.now();
  const { system, user } = buildBatchPrompt(batch);
  try {
    const content = await callGrok({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 3200,
    });
    const json = extractJson(content);
    const rawPosts = Array.isArray(json?.posts) ? json.posts : [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const posts = rawPosts.map((p) => {
      const author = canonicalHandle(p.author);
      const topic = isValidTopic(p.topic) ? p.topic : inferTopic(p.text);
      const tier = tierOf(author) || batch.tier;
      return {
        author,
        text: String(p.text || '').slice(0, 320),
        url: String(p.url || ''),
        postedAt: String(p.posted_at || ''),
        topic,
        whyItMatters: String(p.why_it_matters || '').slice(0, 100),
        tier,
        group: `${tier} 级`,
      };
    }).filter((p) => {
      if (!p.author || !p.text) return false;
      // 硬过滤：只保留近 7 天内的帖子；posted_at 无法解析的丢弃
      const ts = postedAtScore(p.postedAt);
      if (!ts || ts < sevenDaysAgo) return false;
      return true;
    });

    return {
      batchLabel: batch.label,
      tier: batch.tier,
      accountsCount: batch.accounts.length,
      ok: true,
      count: posts.length,
      latencyMs: Date.now() - started,
      posts,
    };
  } catch (err) {
    return {
      batchLabel: batch.label,
      tier: batch.tier,
      accountsCount: batch.accounts.length,
      ok: false,
      count: 0,
      latencyMs: Date.now() - started,
      posts: [],
      error: String(err.message || err),
    };
  }
}

// FNV-1a 哈希，做条目 id（用 url 做 key，URL 不可用时退回 author+text）
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

function postToItem(p) {
  const key = p.url || `${p.author}:${p.text.slice(0, 80)}`;
  return {
    id: hash(key),
    author: p.author,
    sourceName: p.author,
    text: p.text,
    title: p.text.length > 100 ? p.text.slice(0, 100) + '…' : p.text,
    url: p.url,
    hasValidUrl: isValidTweetUrl(p.url),
    publishedAt: p.postedAt,
    topic: p.topic,
    whyItMatters: p.whyItMatters,
    tier: p.tier,
    group: p.group,
    summary: p.text,
    summaryStatus: 'source',
    summaryGeneratedBy: null,
  };
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((it) => {
    const k = it.url && it.hasValidUrl ? it.url : `${it.author}:${it.text.slice(0, 80)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// 把相对时间（"6h ago" / "2d ago"）粗略换算成数字以便排序
function postedAtScore(s) {
  if (!s) return 0;
  const txt = String(s).trim().toLowerCase();
  // ISO
  const iso = Date.parse(txt);
  if (Number.isFinite(iso)) return iso;
  // "6h ago" / "2d ago" / "30m ago"
  const m = txt.match(/(\d+)\s*(m|min|minute|h|hr|hour|d|day)/);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2];
    const now = Date.now();
    if (unit.startsWith('m')) return now - n * 60 * 1000;
    if (unit.startsWith('h')) return now - n * 60 * 60 * 1000;
    if (unit.startsWith('d')) return now - n * 24 * 60 * 60 * 1000;
  }
  return 0;
}

// Event 级动态扩展：从已抓帖子文本里提取 @xxx 提及
// 过滤：不在 S/A/B 池里 + 被 ≥2 个不同账号引用
function extractEventMentions(items) {
  const mentions = new Map();
  // 匹配 @handle，X handle 规则：字母数字下划线，1-15 字符
  const handleRe = /(?:^|[^a-zA-Z0-9_/])@([a-zA-Z0-9_]{2,15})\b/g;
  for (const it of items) {
    const seen = new Set();
    let m;
    while ((m = handleRe.exec(it.text)) !== null) {
      const h = canonicalHandle('@' + m[1]);
      if (seen.has(h.toLowerCase())) continue;
      seen.add(h.toLowerCase());
      // 不算自引
      if (h.toLowerCase() === it.author.toLowerCase()) continue;
      if (!mentions.has(h)) mentions.set(h, { count: 0, citedBy: new Set() });
      const entry = mentions.get(h);
      entry.count += 1;
      entry.citedBy.add(it.author);
    }
    handleRe.lastIndex = 0;
  }
  const out = [];
  for (const [h, info] of mentions.entries()) {
    if (tierOf(h)) continue; // 已在 S/A/B 池
    if (info.citedBy.size < 2) continue; // 至少 2 个不同账号引用
    out.push({ handle: h, count: info.count, citedBy: [...info.citedBy] });
  }
  return out
    .sort((a, b) => (b.citedBy.length - a.citedBy.length) || (b.count - a.count))
    .slice(0, 8);
}

export async function fetchXFeed() {
  const batches = getFetchBatches();
  // 12 个批次，每轮最多 6 个 :online 并发，避免 OpenRouter 限流
  const CONCURRENCY = 6;
  const baseResults = [];
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const round = await Promise.all(chunk.map((b) => fetchBatch(b)));
    baseResults.push(...round);
  }

  // Event 级：基于主池帖子的 @ 提及，挑出非池内但被多人引用的临时账号
  const baseItems = baseResults.flatMap((r) => r.posts);
  const eventMentions = extractEventMentions(baseItems);
  let eventResult = null;
  if (eventMentions.length >= 3) {
    console.log('[radar] event candidates:', eventMentions.map((e) => `${e.handle}(x${e.citedBy.length})`).join(', '));
    eventResult = await fetchBatch({
      tier: 'event',
      label: 'Event 动态加入',
      accounts: eventMentions.map((e) => e.handle),
    });
  } else {
    console.log('[radar] event candidates: 0 (no cross-cited non-pool handles)');
  }

  const results = eventResult ? [...baseResults, eventResult] : baseResults;
  const allPosts = results.flatMap((r) => r.posts);

  // 去重 + 排序（按 posted_at 时间倒序，无时间的放后面）
  const items = dedupe(allPosts.map(postToItem))
    .sort((a, b) => postedAtScore(b.publishedAt) - postedAtScore(a.publishedAt));

  // 来源统计：按 author 聚合
  const sourceMap = new Map();
  for (const it of items) {
    if (!sourceMap.has(it.author)) {
      sourceMap.set(it.author, { author: it.author, tier: it.tier, group: it.group, count: 0, latestAt: it.publishedAt });
    }
    const s = sourceMap.get(it.author);
    s.count += 1;
  }
  const sources = [...sourceMap.values()].sort((a, b) => b.count - a.count);

  const batchReports = results.map((r) => ({
    label: r.batchLabel,
    tier: r.tier,
    accountsCount: r.accountsCount,
    ok: r.ok,
    count: r.count,
    latencyMs: r.latencyMs,
    error: r.error || null,
  }));

  return {
    items,
    sources,
    batches: batchReports,
    eventMentions: eventMentions.map((e) => ({ handle: e.handle, citedBy: e.citedBy, count: e.count })),
    stats: {
      total: items.length,
      withUrl: items.filter((it) => it.hasValidUrl).length,
      sTier: items.filter((it) => it.tier === 'S').length,
      aTier: items.filter((it) => it.tier === 'A').length,
      bTier: items.filter((it) => it.tier === 'B').length,
      eventTier: items.filter((it) => it.tier === 'event').length,
      okBatches: batchReports.filter((b) => b.ok).length,
      failedBatches: batchReports.filter((b) => !b.ok).length,
    },
  };
}
