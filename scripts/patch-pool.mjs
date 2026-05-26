// 一次性脚本：把现有 public/news.json 补上 pool 字段（避免重跑收费抓取）
import fs from 'node:fs/promises';
import { X_S_TIER, X_A_TIER, X_B_TIER } from '../src/x-accounts.mjs';

const news = JSON.parse(await fs.readFile('public/news.json', 'utf8'));
news.pool = {
  sTotal: X_S_TIER.length,
  aTotal: X_A_TIER.length,
  bTotal: X_B_TIER.length,
  sList: X_S_TIER,
  aList: X_A_TIER,
};
await fs.writeFile('public/news.json', JSON.stringify(news, null, 2));
await fs.writeFile('public/news-data.js', `window.__NEWS_DATA__ = ${JSON.stringify(news)};`);
console.log('patched: sTotal=' + news.pool.sTotal + ' aTotal=' + news.pool.aTotal + ' bTotal=' + news.pool.bTotal);

// 同步当天 archive
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
try {
  const ar = JSON.parse(await fs.readFile(`public/archive/${today}.json`, 'utf8'));
  ar.pool = news.pool;
  await fs.writeFile(`public/archive/${today}.json`, JSON.stringify(ar, null, 2));
  console.log('patched archive: ' + today);
} catch (e) { console.log('no archive for today, skipping'); }
