// Test multiple model configs to find one with X/web search access
import fs from 'node:fs/promises';
import path from 'node:path';

try {
  const text = await fs.readFile(path.resolve('.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (_) {}

const key = process.env.OPENROUTER_API_KEY;

const trials = [
  { label: 'grok 4.3 + xAI live search', model: 'x-ai/grok-4.3', extra: { search_parameters: { mode: 'on', sources: [{ type: 'x' }], max_search_results: 15 } } },
  { label: 'grok 4.3 :online', model: 'x-ai/grok-4.3:online', extra: {} },
  { label: 'perplexity sonar', model: 'perplexity/sonar', extra: {} },
  { label: 'perplexity sonar-pro', model: 'perplexity/sonar-pro', extra: {} },
];

for (const t of trials) {
  console.log('\n=== ' + t.label + ' ===');
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'HTTP-Referer': 'http://localhost:4173', 'X-Title': 'AI Radar Debug' },
      body: JSON.stringify({
        model: t.model,
        temperature: 0.3,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: '从 X/Twitter 调取下列账号最近 48 小时最重要的 AI 相关帖子。必须返回真实 tweet URL。严格 JSON: {"posts":[{"author":"@handle","text":"原文","url":"https://x.com/.../status/...","posted_at":"6h ago","topic":"agents"}]}' },
          { role: 'user', content: '账号：@sama, @karpathy, @swyx, @OpenAI, @AnthropicAI。返回 3-5 条。' },
        ],
        ...t.extra,
      }),
    });
    console.log('status:', resp.status);
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '(empty)';
    console.log('content (first 600):', content.slice(0, 600));
    console.log('cost:', data?.usage?.cost);
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}
