// 本地 HTTP 服务 — SPRD §5 接口
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runFetch } from './fetch-news.mjs';
import { searchXSignals } from '../src/summarizer.mjs';
import { X_S_TIER, X_A_TIER } from '../src/x-accounts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const ARCHIVE_DIR = path.join(PUBLIC_DIR, 'archive');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function listArchive() {
  try {
    const entries = await fs.readdir(ARCHIVE_DIR);
    const files = entries.filter((f) => f.endsWith('.json') && DATE_RE.test(f.replace('.json', '')));
    const out = [];
    for (const f of files) {
      try {
        const raw = await fs.readFile(path.join(ARCHIVE_DIR, f), 'utf8');
        const j = JSON.parse(raw);
        out.push({
          date: j.date,
          generatedAt: j.generatedAt,
          title: j.roundup?.title || '',
          subtitle: j.roundup?.subtitle || '',
          mainTheme: j.roundup?.mainTheme || '',
          itemCount: j.itemCount || 0,
          stats: j.stats || null,
          recapCount: (j.roundup?.recap || []).length,
          topTweetsCount: (j.roundup?.topTweets || []).length,
          takeawaysCount: (j.roundup?.takeaways || []).length,
        });
      } catch (_) { /* skip malformed */ }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readArchiveByDate(date) {
  if (!DATE_RE.test(date)) return null;
  try {
    const raw = await fs.readFile(path.join(ARCHIVE_DIR, `${date}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// 加载 .env（与 fetch 入口一致，确保单独启动 serve 也能拿到 key）
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

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

async function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error('body_too_large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

async function readNews() {
  try {
    const text = await fs.readFile(path.join(PUBLIC_DIR, 'news.json'), 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function serveStatic(res, urlPath) {
  // 路径白名单：阻止任何向上跳的 path
  const clean = path.normalize(urlPath).replace(/^[/\\]+/, '');
  if (clean.includes('..')) return send(res, 400, 'bad path');
  const filePath = path.join(PUBLIC_DIR, clean);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 400, 'bad path');
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  } catch {
    send(res, 404, 'not found');
  }
}

// 简单的并发互斥：避免多次点击刷新同时跑
let refreshInflight = null;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const p = u.pathname;
  const method = req.method || 'GET';

  // CORS（本地用，宽松）
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    if (method === 'GET' && (p === '/' || p === '/index.html')) {
      return serveStatic(res, 'index.html');
    }

    if (method === 'GET' && p === '/api/news') {
      const data = await readNews();
      if (!data) return sendJson(res, 200, { items: [], sources: [], errors: [], stats: {}, summary: { status: 'empty', bullets: [] }, generatedAt: null });
      return sendJson(res, 200, data);
    }

    if (method === 'GET' && p === '/api/sources') {
      const data = await readNews();
      return sendJson(res, 200, { sources: data?.sources || [], errors: data?.errors || [] });
    }

    if (method === 'GET' && p === '/api/archive') {
      const list = await listArchive();
      return sendJson(res, 200, { archive: list });
    }

    if (method === 'GET' && p.startsWith('/api/archive/')) {
      const date = p.slice('/api/archive/'.length);
      const entry = await readArchiveByDate(date);
      if (!entry) return sendJson(res, 404, { error: 'not_found' });
      return sendJson(res, 200, entry);
    }

    if (method === 'POST' && p === '/api/refresh') {
      if (refreshInflight) {
        const result = await refreshInflight;
        return sendJson(res, 200, { ok: true, alreadyRunning: true, stats: result.stats });
      }
      refreshInflight = runFetch({ withRoundup: true })
        .finally(() => { refreshInflight = null; });
      try {
        const result = await refreshInflight;
        return sendJson(res, 200, { ok: true, stats: result.stats, roundup: { status: result.roundup?.status, title: result.roundup?.title } });
      } catch (err) {
        console.error('[radar] refresh error', err);
        return sendJson(res, 500, { ok: false, error: String(err.message || err) });
      }
    }

    if (method === 'POST' && p === '/api/x-search') {
      let body;
      try { body = await readJsonBody(req); } catch { return sendJson(res, 400, { error: 'invalid_body' }); }
      const query = String(body.query || '').trim().slice(0, 200);
      if (!query) return sendJson(res, 400, { error: 'missing_query' });
      const tier = body.tier === 'A' ? X_A_TIER : X_S_TIER;
      const result = await searchXSignals(query, tier);
      return sendJson(res, 200, result);
    }

    if (method === 'GET' && p === '/api/x-accounts') {
      return sendJson(res, 200, { s: X_S_TIER, a: X_A_TIER });
    }

    // 兜底：静态资源
    if (method === 'GET') {
      return serveStatic(res, p);
    }

    send(res, 405, 'method not allowed');
  } catch (err) {
    console.error('[radar] unhandled', err);
    sendJson(res, 500, { error: String(err.message || err) });
  }
});

await loadEnv();

server.listen(PORT, () => {
  console.log(`AI 资讯雷达 running at http://localhost:${PORT}`);
  console.log(`  GET  /              页面`);
  console.log(`  GET  /api/news      新闻数据`);
  console.log(`  GET  /api/sources   数据源状态`);
  console.log(`  POST /api/refresh   触发抓取`);
  console.log(`  POST /api/x-search  X 信号搜索`);
});
