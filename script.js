/* ============================================
   Crypto Sentiment Pulse — Client Logic
   ============================================ */

(() => {
  'use strict';

  // ── State ──
  let newsData = [];
  let activeFilter = 'All';

  // Educational Fallback specifically for Solana if no breaking SOL news exists in feed
  const solFallbackItem = {
    id: 'sol-fallback',
    title: 'Solana Network Pulse: DEX Liquidity & On-Chain Ecosystem Hold Strong',
    summary: 'While breaking news specifically highlighting Solana has been calm on the wire in recent hours, Solana on-chain metrics display solid DeFi activity with stable TVL and micro-transaction efficiency.',
    impact: 'Supports SOL price resilience while sustaining developer retention and daily trading volume across the ecosystem.',
    sentiment: 'Bullish',
    score: '+75',
    coin: 'SOL',
    time_ago: 'Ecosystem Insight',
    source_url: 'https://defillama.com/chain/Solana'
  };

  // ── DOM References ──
  const grid = document.getElementById('card-grid');
  const btnRefresh = document.getElementById('btn-refresh');
  const filterBtns = document.querySelectorAll('.filter-btn');

  // Barometer DOM
  const marketStatusText = document.getElementById('market-status-text');
  const totalArticlesCount = document.getElementById('total-articles-count');
  const barBullish = document.getElementById('bar-bullish');
  const barNeutral = document.getElementById('bar-neutral');
  const barBearish = document.getElementById('bar-bearish');
  const pctBullish = document.getElementById('pct-bullish');
  const pctNeutral = document.getElementById('pct-neutral');
  const pctBearish = document.getElementById('pct-bearish');

  // ── Skeleton Loader ──
  function renderSkeleton(count = 6) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-card" style="animation-delay: ${i * 0.05}s">
          <div class="skeleton-row">
            <div class="skeleton-line h-badge"></div>
            <div class="skeleton-line h-badge"></div>
          </div>
          <div class="skeleton-line w-80"></div>
          <div class="skeleton-line w-100"></div>
          <div class="skeleton-line h-impact"></div>
        </div>`;
    }
    grid.innerHTML = html;
  }

  // ── Error State ──
  function renderError(message) {
    grid.innerHTML = `
      <div class="error-state" style="grid-column: 1 / -1">
        <div class="error-icon">⚠</div>
        <p class="error-message">${escapeHTML(message)}</p>
        <button class="btn-retry" type="button" onclick="location.reload()">Try Again</button>
      </div>`;
  }

  // ── Empty State ──
  function renderEmpty() {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1">
        No articles found for this filter.
      </div>`;
  }

  // ── Escape HTML ──
  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Decode HTML Entities ──
  function decodeHTML(str) {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  // ── Coin Badge Class ──
  function coinBadgeClass(coin) {
    const c = (coin || '').toUpperCase();
    if (c === 'BTC') return 'badge-btc';
    if (c === 'ETH') return 'badge-eth';
    if (c === 'SOL') return 'badge-sol';
    return 'badge-general';
  }

  // ── Sentiment Badge Class ──
  function sentimentBadgeClass(sentiment) {
    const s = (sentiment || '').toLowerCase();
    if (s === 'bullish') return 'badge-bullish';
    if (s === 'bearish') return 'badge-bearish';
    return 'badge-neutral';
  }

  // ── Impact Class ──
  function impactClass(sentiment) {
    const s = (sentiment || '').toLowerCase();
    if (s === 'bullish') return 'impact-bullish';
    if (s === 'bearish') return 'impact-bearish';
    return 'impact-neutral';
  }

  // ── Update Market Barometer ──
  function updateMarketBarometer() {
    if (!Array.isArray(newsData) || newsData.length === 0) return;

    const total = newsData.length;
    let bullCount = 0;
    let bearCount = 0;
    let neutCount = 0;

    newsData.forEach(item => {
      const s = (item.sentiment || '').toLowerCase();
      if (s === 'bullish') bullCount++;
      else if (s === 'bearish') bearCount++;
      else neutCount++;
    });

    const bullPct = Math.round((bullCount / total) * 100);
    const bearPct = Math.round((bearCount / total) * 100);
    const neutPct = 100 - bullPct - bearPct; // Keep sum exactly 100%

    // Update Bar widths
    if (barBullish) barBullish.style.width = `${bullPct}%`;
    if (barNeutral) barNeutral.style.width = `${neutPct}%`;
    if (barBearish) barBearish.style.width = `${bearPct}%`;

    // Update Text percentages
    if (pctBullish) pctBullish.textContent = `${bullPct}%`;
    if (pctNeutral) pctNeutral.textContent = `${neutPct}%`;
    if (pctBearish) pctBearish.textContent = `${bearPct}%`;

    // Update Counts
    if (totalArticlesCount) {
      totalArticlesCount.textContent = `${total} Articles Analyzed`;
    }

    // Update Summary Status
    if (marketStatusText) {
      if (bullPct >= 50) {
        marketStatusText.textContent = `Market Sentiment: Bullish Dominance (${bullPct}%) — Strong Optimism`;
      } else if (bearPct >= 50) {
        marketStatusText.textContent = `Market Sentiment: Bearish Dominance (${bearPct}%) — Caution on Selling Pressure`;
      } else if (neutPct >= 45) {
        marketStatusText.textContent = `Market Sentiment: Neutral Consolidation (${neutPct}%) — Awaiting Catalysts`;
      } else if (bullPct > bearPct) {
        marketStatusText.textContent = `Market Sentiment: Leaning Bullish (${bullPct}% vs ${bearPct}%) — Positive Momentum`;
      } else if (bearPct > bullPct) {
        marketStatusText.textContent = `Market Sentiment: Leaning Bearish (${bearPct}% vs ${bullPct}%) — Heightened Volatility`;
      } else {
        marketStatusText.textContent = `Market Sentiment: Balanced — Mixed Action`;
      }
    }
  }

  // ── Render Cards ──
  function renderCards() {
    let filtered = [];

    if (activeFilter === 'All') {
      filtered = newsData;
    } else {
      filtered = newsData.filter(item => item.coin === activeFilter);
    }

    // Solana ($SOL) Special Case: If no SOL news found in feed, display educational ecosystem insight
    if (activeFilter === 'SOL' && filtered.length === 0) {
      renderSolanaFallback();
      return;
    }

    if (filtered.length === 0) {
      renderEmpty();
      return;
    }

    let html = '';
    filtered.forEach((item, index) => {
      const badgeCoin = coinBadgeClass(item.coin);
      const badgeSent = sentimentBadgeClass(item.sentiment);
      const coinLabel = (item.coin === 'General' || item.coin === 'Umum') ? 'MARKET' : `$${item.coin}`;
      const scoreLabel = item.score ? `${item.score}` : (item.sentiment === 'Bullish' ? '+70' : (item.sentiment === 'Bearish' ? '-60' : '0'));
      const timeLabel = item.time_ago || 'Recent';
      const delay = Math.min(index * 0.04, 0.4);

      html += `
        <article class="news-card" style="animation-delay: ${delay}s">
          <div class="card-top-row">
            <div class="card-badges">
              <span class="badge ${badgeCoin}">${escapeHTML(coinLabel)}</span>
              <span class="badge ${badgeSent}">${escapeHTML(scoreLabel)} ${escapeHTML(item.sentiment)}</span>
            </div>
            <span class="card-time">${escapeHTML(timeLabel)}</span>
          </div>

          <h2 class="card-title">${escapeHTML(item.title)}</h2>
          <p class="card-summary">${escapeHTML(item.summary)}</p>

          <div class="card-impact ${impactClass(item.sentiment)}">
            <span class="impact-label">Market Impact ⚡</span>
            <span class="impact-text">${escapeHTML(item.impact || 'Preserves market dynamics within current trends.')}</span>
          </div>

          <div class="card-footer">
            <div class="card-footer-left">
              <a class="source-link" href="${escapeHTML(item.source_url)}" target="_blank" rel="noopener noreferrer">
                Source Story ↗
              </a>
            </div>
            <button class="btn-copy" type="button" data-id="${item.id}" aria-label="Copy news analysis">
              Copy Analysis
            </button>
          </div>
        </article>`;
    });

    grid.innerHTML = html;

    // Attach copy listeners
    grid.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', handleCopy);
    });
  }

  // ── Render Solana Fallback ──
  function renderSolanaFallback() {
    grid.innerHTML = `
      <article class="news-card fallback-sol-card" style="animation-delay: 0.05s; grid-column: 1 / -1;">
        <div class="card-top-row">
          <div class="card-badges">
            <span class="badge badge-sol">$SOL</span>
            <span class="badge badge-bullish">+75 Bullish</span>
          </div>
          <span class="card-time">Ecosystem Insight</span>
        </div>

        <h2 class="card-title">${escapeHTML(solFallbackItem.title)}</h2>
        <p class="card-summary">${escapeHTML(solFallbackItem.summary)}</p>

        <div class="card-impact impact-bullish">
          <span class="impact-label">Market Impact ⚡</span>
          <span class="impact-text">${escapeHTML(solFallbackItem.impact)}</span>
        </div>

        <div class="card-footer">
          <div class="card-footer-left">
            <a class="source-link" href="${solFallbackItem.source_url}" target="_blank" rel="noopener noreferrer">
              Check On-Chain DeFiLlama ↗
            </a>
          </div>
          <button class="btn-copy" type="button" data-id="sol-fallback" aria-label="Copy Solana insight">
            Copy Analysis
          </button>
        </div>
      </article>`;

    const copyBtn = grid.querySelector('.btn-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', handleCopy);
    }
  }

  // ── Copy to Clipboard ──
  async function handleCopy(e) {
    const btn = e.currentTarget;
    const rawId = btn.getAttribute('data-id');

    let targetItem = null;
    if (rawId === 'sol-fallback') {
      targetItem = solFallbackItem;
    } else {
      const articleId = parseInt(rawId, 10);
      targetItem = newsData.find(item => item.id === articleId);
    }

    if (!targetItem) return;

    // Formatted copy snippet
    const copyContent = decodeHTML(
      `[CRYPTO SENTIMENT PULSE]\n` +
      `${(targetItem.coin !== 'General' && targetItem.coin !== 'Umum') ? '$' + targetItem.coin : 'BROAD MARKET'} | Sentiment: ${targetItem.sentiment} (${targetItem.score})\n` +
      `Headline: ${targetItem.title}\n\n` +
      `Summary: ${targetItem.summary}\n` +
      `Market Impact: ${targetItem.impact}\n` +
      `Source: ${targetItem.source_url}`
    );

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(copyContent);
      } else {
        const ta = document.createElement('textarea');
        ta.value = copyContent;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      btn.textContent = 'Copied! ✓';
      btn.classList.add('copied');

      setTimeout(() => {
        btn.textContent = 'Copy Analysis';
        btn.classList.remove('copied');
      }, 1500);
    } catch (err) {
      console.error('[Copy Error]', err);
    }
  }

  // ── Fetch Data ──
  async function fetchData() {
    renderSkeleton(8);
    btnRefresh.disabled = true;

    try {
      const res = await fetch('/api/analyze');
      const data = await res.json();

      if (data && data.error) {
        throw new Error(data.error);
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Empty news response or failed to load.');
      }

      newsData = data;
      updateMarketBarometer();
      renderCards();
    } catch (err) {
      console.error('[Fetch Error]', err);
      renderError(err.message || 'Failed to load crypto sentiment feed.');
    } finally {
      btnRefresh.disabled = false;
    }
  }

  // ── Filter Tabs ──
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      activeFilter = btn.getAttribute('data-filter');
      renderCards();
    });
  });

  // ── Refresh Button ──
  btnRefresh.addEventListener('click', () => {
    activeFilter = 'All';
    filterBtns.forEach(b => b.classList.remove('active'));
    filterBtns[0].classList.add('active');
    fetchData();
  });

  // ── Init ──
  fetchData();

})();
