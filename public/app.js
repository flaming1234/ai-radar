// AI 资讯雷达 前端 v2 — X-only
const TOPICS = [
  { id: 'models', label: '模型' },
  { id: 'agents', label: 'Agent' },
  { id: 'coding', label: 'AI Coding' },
  { id: 'infra', label: '基础设施' },
  { id: 'research', label: '研究' },
  { id: 'products', label: '产品' },
  { id: 'evals', label: 'Evals' },
  { id: 'open_source', label: '开源' },
  { id: 'business', label: '商业' },
];

const state = {
  data: null,
  view: 'feed',
  tier: 'all',     // all / S / A
  topic: 'all',
  source: 'all',   // @handle 或 all
  search: '',
  favorites: loadFavorites(),
  archiveList: [],           // [{date, title, subtitle, mainTheme, itemCount, stats}]
  archiveCache: new Map(),   // date → full archive payload
  expandedDays: new Set(),   // 当前展开的日期
};

const $ = (id) => document.getElementById(id);

function loadFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem('ai-radar:favs') || '[]')); }
  catch { return new Set(); }
}
function saveFavorites() {
  try { localStorage.setItem('ai-radar:favs', JSON.stringify([...state.favorites])); } catch {}
}

function toast(msg, kind = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = 'toast ' + kind; }, 2400);
}

function formatTime(s) {
  if (!s) return '';
  // ISO
  const iso = Date.parse(s);
  if (Number.isFinite(iso)) {
    const diff = (Date.now() - iso) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 86400 * 3) return `${Math.floor(diff / 86400)} 天前`;
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
  }
  // 相对时间字符串原样返回
  return String(s);
}

function topicLabel(id) { return TOPICS.find((t) => t.id === id)?.label || id; }

function escape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function handleProfileUrl(h) {
  const clean = String(h || '').replace(/^@/, '');
  return clean ? `https://x.com/${encodeURIComponent(clean)}` : '#';
}

function authorInitial(h) {
  const clean = String(h || '').replace(/^@/, '');
  return clean.slice(0, 2).toUpperCase();
}

// ============ Fetch & Refresh ============
const EMPTY_NEWS = { items: [], sources: [], batches: [], errors: [], stats: {}, roundup: { status: 'empty', bullets: [] }, generatedAt: null };
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);

async function fetchJsonOrNull(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function loadNews() {
  try {
    const [n, idx] = await Promise.all([
      fetchJsonOrNull('/news.json'),
      fetchJsonOrNull('/archive-index.json'),
    ]);
    state.data = n || EMPTY_NEWS;
    state.archiveList = Array.isArray(idx?.archive) ? idx.archive : [];
    // 今日卡片默认展开
    const today = todayKey();
    if (state.data?.roundup?.status === 'ready' || state.archiveList.some((a) => a.date === today)) {
      state.expandedDays.add(today);
    }
    renderAll();
  } catch (e) {
    toast('加载数据失败', 'error');
  }
}

async function refreshNews() {
  const btn = $('refreshBtn');
  btn.disabled = true;
  btn.classList.add('loading');
  const label = btn.querySelector('.btn-label');
  const old = label.textContent;
  label.textContent = '抓取中…';
  try {
    const r = await fetch('/api/refresh', { method: 'POST' });
    const result = await r.json();
    if (!result.ok) throw new Error(result.error || '未知错误');
    await loadNews();
    toast(`抓取完成 · ${result.stats?.total || 0} 条 X 信号`, 'success');
  } catch (e) {
    toast('抓取失败：' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    label.textContent = old;
  }
}

// ============ Filtering ============
function filteredItems() {
  if (!state.data?.items) return [];
  const q = state.search.trim().toLowerCase();
  return state.data.items.filter((it) => {
    if (state.tier !== 'all' && it.tier !== state.tier) return false;
    if (state.topic !== 'all' && it.topic !== state.topic) return false;
    if (state.source !== 'all' && it.author !== state.source) return false;
    if (q) {
      const hay = `${it.author} ${it.text} ${it.topic} ${it.whyItMatters}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ============ Cards ============
function newsCard(item) {
  const fav = state.favorites.has(item.id);
  const tier = item.tier === 'S' ? 'S' : (item.tier === 'A' ? 'A' : '');
  const url = item.hasValidUrl ? item.url : null;
  const profileUrl = handleProfileUrl(item.author);
  return `
    <article class="news-card" data-id="${item.id}">
      <div class="card-head">
        <div class="card-author">
          <a href="${profileUrl}" target="_blank" rel="noopener" class="author-avatar" title="${escape(item.author)}">${authorInitial(item.author)}</a>
          <div class="author-info">
            <div class="author-handle">
              <a href="${profileUrl}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${escape(item.author)}</a>
              ${tier ? `<span class="tier-badge ${tier}">${tier}</span>` : ''}
            </div>
            <div class="author-meta">${escape(item.group || '')} · ${escape(formatTime(item.publishedAt))}</div>
          </div>
        </div>
        <div class="card-actions">
          <button class="icon-btn fav-btn ${fav ? 'active' : ''}" data-fav="${item.id}" title="${fav ? '取消收藏' : '收藏'}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
          <a href="${url || '#'}" target="_blank" rel="noopener" class="icon-btn link-btn ${url ? '' : 'disabled'}" title="${url ? '查看原文' : '原文链接不可用'}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      </div>
      <div class="card-text">${escape(item.text)}</div>
      ${item.whyItMatters ? `<div class="card-why">${escape(item.whyItMatters)}</div>` : ''}
      <div class="card-foot">
        <span class="tag topic">${topicLabel(item.topic)}</span>
        ${url
          ? `<a href="${escape(url)}" target="_blank" rel="noopener" style="color:var(--accent-2)">原文 ↗</a>`
          : '<span style="opacity:.5">无原文链接</span>'}
      </div>
    </article>
  `;
}

function renderFeed() {
  const items = filteredItems();
  $('resultCount').textContent = `${items.length} 条`;
  $('feedCount').textContent = state.data?.items?.length || 0;
  const grid = $('newsGrid');
  const empty = $('emptyState');
  if (items.length === 0) {
    grid.innerHTML = '';
    empty.hidden = (state.data?.items?.length || 0) > 0
      // 有数据但过滤掉了 → 给一个轻提示
      ? false : false;
    empty.hidden = !(!state.data || (state.data.items || []).length === 0);
  } else {
    empty.hidden = true;
    grid.innerHTML = items.map(newsCard).join('');
  }
}

function renderFavorites() {
  const all = state.data?.items || [];
  const favs = all.filter((it) => state.favorites.has(it.id));
  const grid = $('favGrid');
  const empty = $('favEmpty');
  if (favs.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
  } else {
    empty.hidden = true;
    grid.innerHTML = favs.map(newsCard).join('');
  }
  $('favCount').textContent = state.favorites.size;
}

// ============ Roundup body renderer (复用于每张折叠卡) ============
function renderQuoteAndSources(item) {
  const quote = item?.quote
    ? `<blockquote class="recap-quote">"${escape(item.quote)}"</blockquote>`
    : '';
  const sources = item?.sources?.length
    ? `<div class="recap-bullet-sources">${item.sources.map((s) => `<a class="source-link" href="${handleProfileUrl(s)}" target="_blank" rel="noopener">${escape(s)}</a>`).join('')}</div>`
    : '';
  return quote + sources;
}

function renderDeepDive(d) {
  const factsHtml = d.facts?.length ? `
    <div class="dd-block">
      <div class="dd-block-label">事实</div>
      <ul class="dd-facts">
        ${d.facts.map((f) => `
          <li>
            <div class="dd-fact-text">${escape(f.text)}</div>
            ${renderQuoteAndSources(f)}
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  const specsHtml = d.specs?.length ? `
    <div class="dd-block">
      <div class="dd-block-label">关键参数</div>
      <dl class="spec-table">
        ${d.specs.map((s) => `
          <div class="spec-row">
            <dt>${escape(s.key)}</dt>
            <dd>${escape(s.value)}</dd>
          </div>
        `).join('')}
      </dl>
    </div>
  ` : '';

  const renderReactionGroup = (label, kind, arr) => {
    if (!arr?.length) return '';
    return `
      <div class="reaction-group reaction-${kind}">
        <div class="reaction-label">${label}</div>
        <ul>
          ${arr.map((r) => `
            <li>
              <span class="reaction-text">${escape(r.text)}</span>
              ${r.source ? `<a class="reaction-source" href="${handleProfileUrl(r.source)}" target="_blank" rel="noopener">${escape(r.source)}</a>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  };
  const rx = d.reactions || {};
  const hasReactions = (rx.bullish?.length || 0) + (rx.skeptical?.length || 0) + (rx.neutral?.length || 0) > 0;
  const reactionsHtml = hasReactions ? `
    <div class="dd-block">
      <div class="dd-block-label">反响</div>
      <div class="reactions-grid">
        ${renderReactionGroup('看多', 'bullish', rx.bullish)}
        ${renderReactionGroup('看空', 'skeptical', rx.skeptical)}
        ${renderReactionGroup('中性', 'neutral', rx.neutral)}
      </div>
    </div>
  ` : '';

  return `
    <article class="deep-dive">
      <div class="dd-head">
        <span class="tag topic">${topicLabel(d.topic)}</span>
        <h3 class="dd-title">${escape(d.title)}</h3>
      </div>
      ${d.summary ? `<p class="dd-summary">${escape(d.summary)}</p>` : ''}
      ${factsHtml}
      ${specsHtml}
      ${reactionsHtml}
    </article>
  `;
}

function renderRoundupBody(roundup) {
  if (!roundup || roundup.status !== 'ready') {
    const msg = roundup?.message
      || (roundup?.status === 'missing_api_key' ? '未配置 OPENROUTER_API_KEY' : '该日综述生成失败或为空');
    return `<div class="empty" style="padding:30px 10px"><div class="empty-sub">${escape(msg)}</div></div>`;
  }
  const sections = [];

  if (roundup.headline?.length) {
    sections.push(`
      <section class="roundup-section">
        <div class="roundup-section-title"><span class="section-rule"></span><span>今日头条</span></div>
        <div class="roundup-headline">${roundup.headline.map((p) => `<p>${escape(p)}</p>`).join('')}</div>
      </section>
    `);
  }

  if (roundup.deepDives?.length) {
    sections.push(`
      <section class="roundup-section">
        <div class="roundup-section-title"><span class="section-rule"></span><span>主线事件</span></div>
        <div class="deep-dive-list">
          ${roundup.deepDives.map(renderDeepDive).join('')}
        </div>
      </section>
    `);
  }

  if (roundup.recap?.length) {
    sections.push(`
      <section class="roundup-section">
        <div class="roundup-section-title"><span class="section-rule"></span><span>AI Twitter Recap</span></div>
        <div class="recap-list">
          ${roundup.recap.map((g) => `
            <div class="recap-group">
              <div class="recap-group-head">
                <span class="tag topic">${topicLabel(g.topic)}</span>
                <div class="recap-group-title">${escape(g.title)}</div>
              </div>
              <ul class="recap-bullets">
                ${(g.bullets || []).map((b) => `
                  <li class="recap-bullet">
                    <div class="recap-bullet-body">
                      <div>${escape(b.text)}</div>
                      ${renderQuoteAndSources(b)}
                    </div>
                  </li>
                `).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      </section>
    `);
  }

  if (roundup.talentMoves?.length) {
    sections.push(`
      <section class="roundup-section">
        <div class="roundup-section-title"><span class="section-rule"></span><span>Talent &amp; Ecosystem Moves</span></div>
        <ul class="talent-list">
          ${roundup.talentMoves.map((t) => `
            <li class="talent-item">
              <span class="talent-icon">→</span>
              <div class="talent-body">
                <div>${escape(t.text)}</div>
                <div class="talent-meta">
                  ${t.source ? `<a class="source-link" href="${handleProfileUrl(t.source)}" target="_blank" rel="noopener">${escape(t.source)}</a>` : ''}
                  ${t.url ? `<a href="${escape(t.url)}" target="_blank" rel="noopener" style="color:var(--accent-2)">原文 ↗</a>` : ''}
                </div>
              </div>
            </li>
          `).join('')}
        </ul>
      </section>
    `);
  }

  if (roundup.topTweets?.length) {
    sections.push(`
      <section class="roundup-section">
        <div class="roundup-section-title"><span class="section-rule"></span><span>Top Tweets</span></div>
        <div class="top-tweet-grid">
          ${roundup.topTweets.map((t, i) => `
            <article class="top-tweet">
              <div class="top-tweet-rank">${String(i + 1).padStart(2, '0')}</div>
              <div class="top-tweet-head">
                <a href="${handleProfileUrl(t.author)}" target="_blank" rel="noopener" class="top-tweet-author">${escape(t.author)}</a>
              </div>
              <div class="top-tweet-text">${escape(t.text)}</div>
              ${t.whyItMatters ? `<div class="top-tweet-why">${escape(t.whyItMatters)}</div>` : ''}
              <div class="top-tweet-foot">
                <div class="top-tweet-tags">${(t.tags || []).map((tag) => `<span class="tag topic">${topicLabel(tag)}</span>`).join('')}</div>
                ${t.url ? `<a href="${escape(t.url)}" target="_blank" rel="noopener">原文 ↗</a>` : '<span style="opacity:.5">无原文链接</span>'}
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `);
  }

  if (roundup.takeaways?.length) {
    sections.push(`
      <section class="roundup-section">
        <div class="roundup-section-title"><span class="section-rule"></span><span>今日结论</span></div>
        <ol class="takeaway-list">
          ${roundup.takeaways.map((t) => `<li>${escape(t)}</li>`).join('')}
        </ol>
      </section>
    `);
  }

  return `<div class="roundup">${sections.join('')}</div>`;
}

// ============ Digest 日列表 ============
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDayLabel(dateStr) {
  // dateStr: YYYY-MM-DD
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!y) return { md: dateStr || '', year: '' };
  return { md: `${MONTH_ABBR[m - 1]} ${d}`, year: String(y) };
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 把"今天"和归档列表合并去重；今天的优先用 live data（state.data.roundup）
function buildDayList() {
  const today = todayKey();
  const live = state.data?.roundup;
  const liveReady = live && live.status === 'ready';

  // 归档（去掉今天，因为 live 优先）
  const arch = state.archiveList.filter((a) => a.date !== today);

  const days = [];
  if (liveReady) {
    days.push({
      date: today,
      isToday: true,
      isLive: true,
      title: live.title,
      subtitle: live.subtitle,
      mainTheme: live.mainTheme,
      itemCount: state.data?.stats?.total || 0,
      stats: state.data?.stats || null,
      generatedAt: live.generatedAt,
    });
  } else if (state.archiveList.some((a) => a.date === today)) {
    const t = state.archiveList.find((a) => a.date === today);
    days.push({ ...t, isToday: true });
  }
  for (const a of arch) {
    days.push({ ...a, isToday: false });
  }
  // 按日期降序
  return days.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function renderDigest() {
  const list = $('dayList');
  const empty = $('digestEmpty');
  const days = buildDayList();
  if (days.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = days.map((d) => {
    const { md, year } = formatDayLabel(d.date);
    const expanded = state.expandedDays.has(d.date);
    const stats = d.stats || {};
    return `
      <article class="day-card ${expanded ? 'expanded' : ''}" data-day-card="${escape(d.date)}">
        <button class="day-head" data-toggle-day="${escape(d.date)}" aria-expanded="${expanded}">
          <div class="day-date">
            <span class="day-date-md">${md}</span>
            <span class="day-date-y">${year}</span>
          </div>
          <div class="day-body">
            <div class="day-meta-row">
              ${d.isToday ? '<span class="day-today-pill">TODAY</span>' : ''}
              ${d.mainTheme ? `<span class="day-theme">${escape(d.mainTheme)}</span>` : ''}
              <span class="day-stat">${stats.total ?? d.itemCount ?? 0} 条 · S ${stats.sTier ?? 0} · A ${stats.aTier ?? 0}</span>
            </div>
            <div class="day-title">${escape(d.title || '尚未生成综述')}</div>
            ${d.subtitle ? `<div class="day-subtitle">${escape(d.subtitle)}</div>` : ''}
          </div>
          <div class="day-chevron">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </button>
        <div class="day-content">
          <div class="day-content-inner" data-day-content="${escape(d.date)}">
            ${expanded ? renderDayInner(d) : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// 取得指定日期的完整 roundup（today 走 live，其余走 archive 缓存或 API）
function getRoundupForDay(day) {
  if (day.isToday && day.isLive) return state.data?.roundup;
  const cached = state.archiveCache.get(day.date);
  return cached?.roundup;
}

function renderDayInner(day) {
  const r = getRoundupForDay(day);
  if (!r) {
    return '<div class="empty" style="padding:24px 10px"><div class="empty-sub">加载中…</div></div>';
  }
  return renderRoundupBody(r);
}

async function toggleDay(date) {
  const day = buildDayList().find((d) => d.date === date);
  if (!day) return;
  const card = document.querySelector(`[data-day-card="${date}"]`);
  if (!card) return;

  if (state.expandedDays.has(date)) {
    state.expandedDays.delete(date);
    card.classList.remove('expanded');
    return;
  }

  state.expandedDays.add(date);
  card.classList.add('expanded');

  // 若需要 lazy load
  const inner = card.querySelector('[data-day-content]');
  if (!day.isLive && !state.archiveCache.has(date)) {
    inner.innerHTML = '<div class="empty" style="padding:24px 10px"><div class="empty-sub">加载中…</div></div>';
    card.classList.add('loading');
    try {
      const r = await fetch(`/archive/${encodeURIComponent(date)}.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      state.archiveCache.set(date, data);
      inner.innerHTML = renderDayInner(day);
    } catch (e) {
      inner.innerHTML = `<div class="empty" style="padding:24px 10px"><div class="empty-sub">加载失败：${escape(String(e.message || e))}</div></div>`;
    } finally {
      card.classList.remove('loading');
    }
  } else {
    inner.innerHTML = renderDayInner(day);
  }
}

// ============ Sidebar ============
function renderSidebar() {
  // Topic chips
  $('topicChips').innerHTML = [
    `<button class="chip ${state.topic === 'all' ? 'active' : ''}" data-topic="all">全部</button>`,
    ...TOPICS.map((t) => `<button class="chip ${state.topic === t.id ? 'active' : ''}" data-topic="${t.id}">${t.label}</button>`),
  ].join('');

  // Sources grouped by tier
  const sources = state.data?.sources || [];
  const sList = sources.filter((s) => s.tier === 'S');
  const aList = sources.filter((s) => s.tier === 'A');

  const renderList = (list) => {
    if (list.length === 0) return '<div style="padding:8px 10px;font-size:12px;color:var(--text-mute)">暂无数据</div>';
    // 按 count 倒序展示
    return [...list].sort((a, b) => b.count - a.count).map((s) => `
      <div class="source-item ${state.source === s.author ? 'active' : ''}" data-source="${escape(s.author)}" title="点击只看此账号">
        <span class="source-tier-dot ${s.tier}"></span>
        <span class="source-handle">${escape(s.author)}</span>
        <span class="source-count">${s.count}</span>
      </div>
    `).join('');
  };

  // "全部" at top of S list (use S list container)
  const allItem = `
    <div class="source-item source-all-item ${state.source === 'all' ? 'active' : ''}" data-source="all">
      <span class="source-tier-dot S"></span>
      <span class="source-handle">全部账号</span>
      <span class="source-count">${state.data?.items?.length || 0}</span>
    </div>
  `;
  $('sourceListS').innerHTML = allItem + renderList(sList);
  $('sourceListA').innerHTML = renderList(aList);
}

// ============ Dashboard ============
function renderDashboard() {
  const st = state.data?.stats || {};
  const r = state.data?.roundup || {};
  $('statGrid').innerHTML = `
    <div class="stat-card"><div class="stat-value">${st.total ?? 0}</div><div class="stat-label">X 信号总数</div></div>
    <div class="stat-card"><div class="stat-value">${st.sTier ?? 0}</div><div class="stat-label">S 级帖子</div></div>
    <div class="stat-card"><div class="stat-value">${st.aTier ?? 0}</div><div class="stat-label">A 级帖子</div></div>
    <div class="stat-card"><div class="stat-value">${st.withUrl ?? 0}</div><div class="stat-label">含原文链接</div></div>
    <div class="stat-card"><div class="stat-value">${st.okBatches ?? 0}/${(st.okBatches ?? 0) + (st.failedBatches ?? 0)}</div><div class="stat-label">批次成功率</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:18px">${r.status || '-'}</div><div class="stat-label">综述状态</div></div>
  `;

  const batches = state.data?.batches || [];
  $('batchTable').innerHTML = batches.length ? batches.map((b) => `
    <div class="batch-row">
      <span class="batch-dot ${b.ok ? 'ok' : 'fail'}"></span>
      <span class="batch-name">${escape(b.label)}</span>
      <span class="batch-tier">${b.tier} 级</span>
      <span class="batch-count">${b.count} 条</span>
      <span class="batch-latency">${b.latencyMs || 0}ms</span>
      ${!b.ok && b.error ? `<span class="batch-error">${escape(b.error)}</span>` : ''}
    </div>
  `).join('') : '<div style="font-size:12px;color:var(--text-mute)">暂无批次数据</div>';

  const top = (state.data?.sources || []).slice(0, 16);
  $('topAccounts').innerHTML = top.length ? top.map((s) => `
    <div class="top-account">
      <a class="top-account-handle" href="${handleProfileUrl(s.author)}" target="_blank" rel="noopener">${escape(s.author)}</a>
      <span class="top-account-count">${s.count}</span>
    </div>
  `).join('') : '<div style="font-size:12px;color:var(--text-mute)">暂无账号数据</div>';
}

function renderHeader() {
  const t = state.data?.generatedAt;
  $('lastUpdate').textContent = t ? '上次抓取 · ' + formatTime(t) : '未抓取';
}

function renderAll() {
  renderHeader();
  renderSidebar();
  renderFeed();
  renderFavorites();
  renderDigest();
  renderDashboard();
}

// ============ Views ============
function switchView(v) {
  state.view = v;
  const sidebar = $('sidebar');
  if (sidebar) sidebar.dataset.view = v;
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach((d) => { d.hidden = d.dataset.view !== v; });
  if (v === 'favorites') renderFavorites();
  if (v === 'digest') renderDigest();
  if (v === 'dashboard') renderDashboard();
}

// ============ Wiring ============
document.addEventListener('click', (e) => {
  const dayToggle = e.target.closest('[data-toggle-day]');
  if (dayToggle) {
    toggleDay(dayToggle.dataset.toggleDay);
    return;
  }

  const navBtn = e.target.closest('.nav-item');
  if (navBtn) { switchView(navBtn.dataset.view); return; }

  const tierChip = e.target.closest('[data-tier]');
  if (tierChip) {
    state.tier = tierChip.dataset.tier;
    document.querySelectorAll('[data-tier]').forEach((c) => c.classList.toggle('active', c.dataset.tier === state.tier));
    renderFeed();
    return;
  }

  const topicChip = e.target.closest('[data-topic]');
  if (topicChip) {
    state.topic = topicChip.dataset.topic;
    document.querySelectorAll('[data-topic]').forEach((c) => c.classList.toggle('active', c.dataset.topic === state.topic));
    renderFeed();
    return;
  }

  const srcItem = e.target.closest('[data-source]');
  if (srcItem) {
    state.source = srcItem.dataset.source;
    document.querySelectorAll('[data-source]').forEach((c) => c.classList.toggle('active', c.dataset.source === state.source));
    renderFeed();
    return;
  }

  const favBtn = e.target.closest('[data-fav]');
  if (favBtn) {
    e.preventDefault();
    e.stopPropagation();
    const id = favBtn.dataset.fav;
    if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    saveFavorites();
    favBtn.classList.toggle('active');
    const svg = favBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', state.favorites.has(id) ? 'currentColor' : 'none');
    $('favCount').textContent = state.favorites.size;
    if (state.view === 'favorites') renderFavorites();
    return;
  }
});

// 生产静态站没有 /api/refresh — 按钮只在本地开发显示
if (IS_LOCAL) {
  $('refreshBtn').addEventListener('click', refreshNews);
} else {
  const btn = $('refreshBtn');
  if (btn) btn.style.display = 'none';
}
$('searchInput').addEventListener('input', (e) => { state.search = e.target.value; renderFeed(); });

// ============ Boot ============
loadNews();
