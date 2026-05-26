// 轻量 RSS / Atom 解析器（零依赖）
// 适用于绝大多数良好结构的 feed，不追求 100% XML 兼容

function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function stripCdata(s) {
  if (!s) return '';
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function stripHtml(s) {
  if (!s) return '';
  return stripCdata(s)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTag(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function getAllTags(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[0]);
  return out;
}

function getAttr(node, attr) {
  const re = new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, 'i');
  const m = node.match(re);
  return m ? m[1] : '';
}

function parseDate(s) {
  if (!s) return null;
  const t = Date.parse(s.trim());
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function isJunkUrl(url) {
  if (!url) return true;
  const u = url.toLowerCase();
  // 过滤导航/壳层/锚点（SPRD §4）
  if (u.includes('#')) {
    const path = u.split('#')[0];
    if (path === '' || path.endsWith('/') || path.split('/').length <= 4) return true;
  }
  const bad = ['/login', '/signup', '/privacy', '/terms', '/about', '/contact', '/settings'];
  return bad.some((b) => u.includes(b));
}

// 解析单个 RSS <item>
function parseRssItem(itemXml) {
  const title = decodeEntities(stripCdata(getTag(itemXml, 'title'))).trim();
  const link = decodeEntities(stripCdata(getTag(itemXml, 'link'))).trim();
  const pubDate = getTag(itemXml, 'pubDate') || getTag(itemXml, 'dc:date');
  const description =
    getTag(itemXml, 'description') ||
    getTag(itemXml, 'content:encoded') ||
    getTag(itemXml, 'summary');
  const author = decodeEntities(stripCdata(getTag(itemXml, 'author') || getTag(itemXml, 'dc:creator'))).trim();
  return {
    title,
    url: link,
    publishedAt: parseDate(pubDate),
    summary: stripHtml(description).slice(0, 500),
    author,
  };
}

// 解析单个 Atom <entry>
function parseAtomEntry(entryXml) {
  const title = decodeEntities(stripCdata(getTag(entryXml, 'title'))).trim();
  // Atom link 用属性
  let url = '';
  const links = entryXml.match(/<link[^>]*\/?>/gi) || [];
  for (const l of links) {
    const rel = getAttr(l, 'rel');
    if (!rel || rel === 'alternate') {
      url = getAttr(l, 'href');
      if (url) break;
    }
  }
  const updated = getTag(entryXml, 'published') || getTag(entryXml, 'updated');
  const description =
    getTag(entryXml, 'summary') ||
    getTag(entryXml, 'content');
  const author = decodeEntities(stripCdata(getTag(getTag(entryXml, 'author'), 'name'))).trim();
  return {
    title,
    url,
    publishedAt: parseDate(updated),
    summary: stripHtml(description).slice(0, 500),
    author,
  };
}

export function parseFeed(xml) {
  if (!xml || typeof xml !== 'string') return [];
  // RSS
  if (/<rss[\s>]/i.test(xml) || /<channel[\s>]/i.test(xml)) {
    return getAllTags(xml, 'item').map(parseRssItem).filter((it) => it.title && it.url && !isJunkUrl(it.url));
  }
  // Atom
  if (/<feed[\s>]/i.test(xml)) {
    return getAllTags(xml, 'entry').map(parseAtomEntry).filter((it) => it.title && it.url && !isJunkUrl(it.url));
  }
  return [];
}

export { stripHtml, decodeEntities };
