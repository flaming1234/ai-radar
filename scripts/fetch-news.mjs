// 抓取入口 — v2 X-only
// 通过 Grok 拉取 S/A 级账号近 48h 帖子，并生成 Latent.Space 风格今日综述

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fetchXFeed } from '../src/x-fetcher.mjs';
import { generateRoundup } from '../src/summarizer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
// 归档放在 public/ 下，使其可被静态托管直接访问（Vercel/GitHub Pages 等）
const ARCHIVE_DIR = path.join(PUBLIC_DIR, 'archive');

function todayKey() {
  // 使用东八区（北京时间）作为"今天"的边界，避免 GitHub Actions 在 UTC 运行时跨日
  const beijing = new Date(Date.now() + 8 * 3600 * 1000);
  return `${beijing.getUTCFullYear()}-${String(beijing.getUTCMonth() + 1).padStart(2, '0')}-${String(beijing.getUTCDate()).padStart(2, '0')}`;
}

async function loadEnv() {
  try {
    const text = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        process.env[m[1]] = v;
      }
    }
  } catch (_) {}
}

export async function runFetch({ withRoundup = true } = {}) {
  await loadEnv();
  console.log('[radar] start X-feed fetch', new Date().toISOString());

  let feed;
  try {
    feed = await fetchXFeed();
  } catch (err) {
    console.error('[radar] X feed fetch fatal', err);
    feed = {
      items: [], sources: [], batches: [],
      stats: { total: 0, withUrl: 0, sTier: 0, aTier: 0, okBatches: 0, failedBatches: 0 },
      error: String(err.message || err),
    };
  }

  console.log(`[radar] X feed: items=${feed.items.length} okBatches=${feed.stats.okBatches} failBatches=${feed.stats.failedBatches}`);

  let roundup = null;
  if (withRoundup) {
    roundup = await generateRoundup(feed.items);
    console.log(`[radar] roundup status=${roundup.status} headline=${roundup.headline?.length || 0}p top=${roundup.topTweets?.length || 0}`);
  } else {
    roundup = {
      generatedAt: new Date().toISOString(),
      status: 'empty',
      headline: [], recap: [], topTweets: [], takeaways: [],
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    items: feed.items,
    sources: feed.sources,
    batches: feed.batches,
    errors: feed.batches.filter((b) => !b.ok).map((b) => ({ batch: b.label, error: b.error })),
    stats: feed.stats,
    roundup,
  };

  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.writeFile(path.join(PUBLIC_DIR, 'news.json'), JSON.stringify(payload, null, 2));
  await fs.writeFile(
    path.join(PUBLIC_DIR, 'news-data.js'),
    `window.__NEWS_DATA__ = ${JSON.stringify(payload)};`
  );

  // 归档当天 — 同一天多次刷新会覆盖，保留最新一次
  if (roundup.status === 'ready') {
    await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    const dateKey = todayKey();
    const archive = {
      date: dateKey,
      generatedAt: payload.generatedAt,
      roundup,
      stats: feed.stats,
      itemCount: feed.items.length,
      sources: feed.sources,
      // 只保留必要的 item 摘要，避免归档体积膨胀
      items: feed.items.slice(0, 60).map((it) => ({
        id: it.id, author: it.author, text: it.text, url: it.url,
        hasValidUrl: it.hasValidUrl, publishedAt: it.publishedAt,
        topic: it.topic, tier: it.tier, group: it.group,
        whyItMatters: it.whyItMatters,
      })),
    };
    await fs.writeFile(path.join(ARCHIVE_DIR, `${dateKey}.json`), JSON.stringify(archive, null, 2));
    console.log(`[radar] archived ${dateKey}.json`);

    // 重新生成索引文件 — 列出所有归档日期及元信息（前端静态站靠它做日列表）
    await regenerateArchiveIndex();
  }

  console.log(`[radar] done. total=${feed.stats.total} sources=${feed.sources.length} roundup=${roundup.status}`);
  return payload;
}

async function regenerateArchiveIndex() {
  try {
    const entries = await fs.readdir(ARCHIVE_DIR);
    const dateRe = /^(\d{4}-\d{2}-\d{2})\.json$/;
    const list = [];
    for (const f of entries) {
      const m = f.match(dateRe);
      if (!m) continue;
      try {
        const j = JSON.parse(await fs.readFile(path.join(ARCHIVE_DIR, f), 'utf8'));
        list.push({
          date: j.date,
          generatedAt: j.generatedAt,
          title: j.roundup?.title || '',
          subtitle: j.roundup?.subtitle || '',
          mainTheme: j.roundup?.mainTheme || '',
          itemCount: j.itemCount || 0,
          stats: j.stats || null,
        });
      } catch (_) { /* skip malformed */ }
    }
    list.sort((a, b) => b.date.localeCompare(a.date));
    await fs.writeFile(
      path.join(PUBLIC_DIR, 'archive-index.json'),
      JSON.stringify({ archive: list }, null, 2),
    );
    console.log(`[radar] archive-index has ${list.length} entries`);
  } catch (err) {
    console.error('[radar] regenerateArchiveIndex failed', err);
  }
}

// CLI 入口（Windows / POSIX 通用）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFetch().catch((e) => {
    console.error('[radar] fatal', e);
    process.exit(1);
  });
}
