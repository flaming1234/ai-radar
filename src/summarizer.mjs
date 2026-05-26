// 综述生成器 — SPRD §14 Latent.Space AINews 风格
// 输入：当日 X items，输出：标题/副标题/头条/Recap/Top Tweets/Takeaways

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey() {
  return process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
}

function getModel() {
  // 综述合成：不需要联网，所以默认走 grok-4.3（不带 :online）。Haiku-4.5 在部分区域不可用。
  return process.env.OPENROUTER_ROUNDUP_MODEL || 'x-ai/grok-4.3';
}

async function callOpenRouter({ messages, model, temperature = 0.5, max_tokens = 4500 }) {
  const key = getApiKey();
  if (!key) throw new Error('missing_api_key');
  const resp = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'http://localhost:4173',
      'X-Title': 'AI Radar',
    },
    body: JSON.stringify({
      model: model || getModel(),
      messages,
      temperature,
      max_tokens,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`openrouter_${resp.status}: ${text.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (_) { return null; }
}

// 给模型的候选条目，去除冗余字段、控制 token 数量
function compactItem(it, idx) {
  return {
    i: idx,
    a: it.author,
    t: it.text.slice(0, 220),
    u: it.hasValidUrl ? it.url : '',
    topic: it.topic,
    tier: it.tier,
    why: it.whyItMatters || '',
  };
}

const TOPIC_GROUPS = [
  { topic: 'agents', title: 'Agent Products / Harnesses / Workflow' },
  { topic: 'models', title: 'Model Performance / Cost / Frontier Competition' },
  { topic: 'infra',  title: 'Protocols / Infra / Runtime Tooling' },
  { topic: 'research', title: 'Research / RL / Distillation / Evaluation' },
  { topic: 'coding', title: 'AI Coding / Developer Experience' },
  { topic: 'products', title: 'Products / Multimodal / End-User Systems' },
  { topic: 'evals', title: 'Benchmarks / Evals / Leaderboards' },
  { topic: 'open_source', title: 'Open Source / Local Models' },
  { topic: 'business', title: 'Business / Funding / Strategy' },
];

export async function generateRoundup(items) {
  if (!getApiKey()) {
    return {
      generatedAt: new Date().toISOString(),
      status: 'missing_api_key',
      model: null,
      message: '未配置 OPENROUTER_API_KEY，无法生成今日综述',
      title: '',
      subtitle: '',
      headline: [],
      recap: [],
      topTweets: [],
      takeaways: [],
    };
  }
  if (!items || items.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      status: 'empty',
      model: null,
      message: '今日暂无候选内容',
      title: '',
      subtitle: '',
      headline: [],
      recap: [],
      topTweets: [],
      takeaways: [],
    };
  }

  const candidates = items.slice(0, 60).map(compactItem);
  const todayStr = new Date().toISOString().slice(0, 10);

  const system = `你是 AI Engineer Radar 的主编，写法参考 Latent.Space AINews 系列（如《All Model Labs are now Agent Labs》《Google I/O 2026: Gemini 3.5 Flash, Omni》）。

请基于今日 X 候选帖子（已按重要性排序），生成 JSON 结构日报。各字段定义：

【title】一句话英文风格短标题（60 字符内）
【subtitle】中文副标题（40 字内）
【main_theme】单 token slug，如 agent_labs / google_io / model_race / infra_shift / quiet_day
【headline】3-6 段中文，每段 2-4 句，解释当日主线。每段引用至少 2 个 @handle。

【deep_dives】★ 当日 0-3 个主线事件的独立深度展开（如有大模型/大产品/重大发布才填，无则空数组）。每个 deep_dive 含：
  - title: 中文事件标题
  - topic: models|agents|coding|infra|research|products|evals|open_source|business
  - summary: 1-2 句中文背景
  - facts[]: 官方/一手事实，每条 { text:"中文事实", quote:"如有英文原话则附原文（最多 120 字符，无则空字符串）", sources:["@官方账号"] }
  - specs[]: 可量化的结构化数据，每条 { key:"中英文标签", value:"数值带单位" }（例如 {key:"Context", value:"1M tokens"} / {key:"Price (in/out)", value:"$1.50 / $9.00 per 1M"} / {key:"Terminal-Bench", value:"76.2%"}），无则空数组
  - reactions: { bullish:[{text, source}], skeptical:[{text, source}], neutral:[{text, source}] } 每组 0-3 条，反应必须来自候选里 builder/researcher 而非媒体账号

【recap】4-6 个主题分组（用于覆盖 deep_dives 之外的次要信号）。每组：
  - title: 中英混合分组名（参考 Latent.Space："Agent Products / Harnesses / Workflow"、"Model Performance & Cost Curves"、"Protocols / Infra / Runtime Tooling"、"Research / RL / Distillation"、"Multimodal Systems"、"Security / Policy / Production Risk" 等）
  - topic: 同上枚举
  - bullets[]: 每条 { text:"一句话中文总结", quote:"如包含具体数字/版本/价格请引原文短句（120 字符内，无则空字符串）", sources:["@xxx"] }

【talent_moves】★ 0-5 条人事/生态动态：员工跳槽、合作发布、新公司成立等。每条 { text:"中文一句话", source:"@xxx", url:"如候选里有则填" }。无则空数组。

【top_tweets】5-8 条候选里信号最强的：{ author, text:"中文一句话提炼", url, why_it_matters:"中文 30 字内", tags:["agents","infra"]（1-3 个 topic id）}

【takeaways】3-5 条面向 AI Engineer 的 takeaways（中文 30-60 字）

通用规则：
- 中文为主，保留 Agent / Harness / MCP / evals / infra / benchmark / GPU / SDK 等英文术语
- 所有 @handle 引用必须出现在候选清单里（小写敏感无所谓，但拼写要对）
- 不编造数字、价格、benchmark 名次、链接、人名
- 媒体号（@TheDecoder/@TechCrunch/@venturebeat/@TheRundownAI 等）只作发现线索，不单独支撑事实
- url 候选里有就填，没有留空字符串
- quote 字段：如能直引推文中包含数字/价格/版本的英文短句最佳，否则留空字符串（不要硬塞中文 paraphrase 到 quote 里）
- specs：必须是可量化的 key-value，不要写主观判断
- reactions 必须区分立场，不要把"很厉害"和"质疑"混在一组

严格输出 JSON，不要任何解释或 markdown 包装：

{
  "title": "...",
  "subtitle": "...",
  "main_theme": "...",
  "headline": ["..."],
  "deep_dives": [
    {
      "title": "...",
      "topic": "...",
      "summary": "...",
      "facts": [{ "text": "...", "quote": "...", "sources": ["@xxx"] }],
      "specs": [{ "key": "...", "value": "..." }],
      "reactions": { "bullish": [{"text":"...","source":"@xxx"}], "skeptical": [], "neutral": [] }
    }
  ],
  "recap": [
    {
      "title": "...",
      "topic": "...",
      "bullets": [{ "text": "...", "quote": "...", "sources": ["@xxx"] }]
    }
  ],
  "talent_moves": [{ "text": "...", "source": "@xxx", "url": "..." }],
  "top_tweets": [{ "author": "@xxx", "text": "...", "url": "...", "why_it_matters": "...", "tags": ["..."] }],
  "takeaways": ["..."]
}`;

  const user = `日期：${todayStr}
候选帖子（${candidates.length} 条）：
${JSON.stringify(candidates)}

请输出 JSON。`;

  try {
    const content = await callOpenRouter({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 8000,
    });
    const json = extractJson(content);
    if (!json) {
      return {
        generatedAt: new Date().toISOString(),
        status: 'error',
        model: getModel(),
        message: '模型未返回有效 JSON',
        title: '', subtitle: '', headline: [], deepDives: [], recap: [], talentMoves: [], topTweets: [], takeaways: [],
        raw: content.slice(0, 400),
      };
    }
    const safeArray = (v) => (Array.isArray(v) ? v : []);
    const safeStr = (v, max = 240) => String(v ?? '').slice(0, max);
    const safeSources = (v) => safeArray(v).map((s) => String(s)).filter(Boolean).slice(0, 4);

    const normReaction = (arr) => safeArray(arr).map((r) => ({
      text: safeStr(r?.text, 200),
      source: safeStr(r?.source, 40),
    })).filter((r) => r.text).slice(0, 3);

    const deepDives = safeArray(json.deep_dives).map((d) => ({
      title: safeStr(d.title, 120),
      topic: d.topic || 'models',
      summary: safeStr(d.summary, 320),
      facts: safeArray(d.facts).map((f) => ({
        text: safeStr(f.text, 280),
        quote: safeStr(f.quote, 200),
        sources: safeSources(f.sources),
      })).filter((f) => f.text).slice(0, 8),
      specs: safeArray(d.specs).map((s) => ({
        key: safeStr(s.key, 60),
        value: safeStr(s.value, 120),
      })).filter((s) => s.key && s.value).slice(0, 10),
      reactions: {
        bullish: normReaction(d.reactions?.bullish),
        skeptical: normReaction(d.reactions?.skeptical),
        neutral: normReaction(d.reactions?.neutral),
      },
    })).filter((d) => d.title).slice(0, 3);

    const recap = safeArray(json.recap).map((g) => ({
      title: safeStr(g.title, 100),
      topic: g.topic || 'models',
      bullets: safeArray(g.bullets).map((b) => ({
        text: safeStr(b.text, 280),
        quote: safeStr(b.quote, 200),
        sources: safeSources(b.sources),
      })).filter((b) => b.text).slice(0, 6),
    })).filter((g) => g.bullets.length);

    const talentMoves = safeArray(json.talent_moves).map((t) => ({
      text: safeStr(t.text, 240),
      source: safeStr(t.source, 40),
      url: safeStr(t.url, 280),
    })).filter((t) => t.text).slice(0, 6);

    const topTweets = safeArray(json.top_tweets).map((t) => ({
      author: safeStr(t.author, 40),
      text: safeStr(t.text, 280),
      url: safeStr(t.url, 280),
      whyItMatters: safeStr(t.why_it_matters, 120),
      tags: safeArray(t.tags).map((x) => String(x)).slice(0, 3),
    })).filter((t) => t.author && t.text).slice(0, 8);

    return {
      generatedAt: new Date().toISOString(),
      status: 'ready',
      model: getModel(),
      message: '',
      date: todayStr,
      title: safeStr(json.title, 140),
      subtitle: safeStr(json.subtitle, 140),
      mainTheme: safeStr(json.main_theme, 40),
      headline: safeArray(json.headline).map((p) => safeStr(p, 700)).filter(Boolean).slice(0, 6),
      deepDives,
      recap,
      talentMoves,
      topTweets,
      takeaways: safeArray(json.takeaways).map((t) => safeStr(t, 240)).filter(Boolean).slice(0, 5),
    };
  } catch (err) {
    return {
      generatedAt: new Date().toISOString(),
      status: 'error',
      model: null,
      message: String(err.message || err),
      title: '', subtitle: '', headline: [], deepDives: [], recap: [], talentMoves: [], topTweets: [], takeaways: [],
    };
  }
}

// 保留 X 搜索接口（供外部 API 调用，前端 UI 已下线该入口）
export async function searchXSignals(query, accounts = []) {
  const key = getApiKey();
  if (!key) return { status: 'missing_api_key', items: [], message: '未配置 OPENROUTER_API_KEY' };
  const accountHint = accounts.length ? `重点关注以下账号：${accounts.slice(0, 30).join(', ')}。` : '';
  try {
    const content = await callOpenRouter({
      messages: [
        { role: 'system', content: '你是 X 信号搜索助手。返回 5-8 条近 48h 高信号讨论，严格 JSON：{"items":[{"author":"@handle","text":"中文一句话","url":"原文URL","topic":"...","why":"中文 30 字内"}]}。不要解释。' },
        { role: 'user', content: `${accountHint}主题：${query}` },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    });
    const json = extractJson(content);
    const items = (json?.items || []).map((x) => ({
      author: String(x.author || '').replace(/^@?/, '@'),
      text: String(x.text || '').slice(0, 280),
      url: String(x.url || ''),
      topic: x.topic || 'models',
      why: String(x.why || '').slice(0, 80),
    })).filter((x) => x.text);
    return {
      status: items.length ? 'ready' : 'error',
      model: getModel(),
      message: items.length ? '' : '模型未返回有效结果',
      items,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { status: 'error', items: [], message: String(err.message || err), generatedAt: new Date().toISOString() };
  }
}
