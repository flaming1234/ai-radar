// 一次性脚本：把现有 public/news.json 写入今日 archive，避免重复付费抓取
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('.');
const newsPath = path.join(ROOT, 'public', 'news.json');
const archiveDir = path.join(ROOT, 'public', 'archive');

const news = JSON.parse(await fs.readFile(newsPath, 'utf8'));
if (!news.roundup || news.roundup.status !== 'ready') {
  console.error('news.json 没有 ready 状态的 roundup，跳过归档');
  process.exit(1);
}

const d = new Date();
const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const archive = {
  date: dateKey,
  generatedAt: news.generatedAt,
  roundup: news.roundup,
  stats: news.stats,
  itemCount: news.items?.length || 0,
  sources: news.sources || [],
  items: (news.items || []).slice(0, 60).map((it) => ({
    id: it.id, author: it.author, text: it.text, url: it.url,
    hasValidUrl: it.hasValidUrl, publishedAt: it.publishedAt,
    topic: it.topic, tier: it.tier, group: it.group,
    whyItMatters: it.whyItMatters,
  })),
};

await fs.mkdir(archiveDir, { recursive: true });
await fs.writeFile(path.join(archiveDir, `${dateKey}.json`), JSON.stringify(archive, null, 2));
console.log(`seeded data/archive/${dateKey}.json`);
