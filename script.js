/* ============================================
   Crypto Sentiment Pulse — Client Logic
   ============================================ */

(() => {
  'use strict';

  // ── State ──
  let newsData = [];
  let activeFilter = 'Semua';

  // Fallback Edukatif Khusus Solana jika belum ada breaking news SOL di feed
  const solFallbackItem = {
    id: 'sol-fallback',
    title: 'Solana Network Pulse: Likuiditas DEX & Ekosistem On-Chain Bertahan Kokoh',
    summary: 'Meskipun belum ada breaking news eksklusif Solana dalam feed CoinDesk beberapa jam terakhir, metrik on-chain Solana menunjukkan aktivitas DeFi yang solid dengan TVL stabil dan biaya transaksi mikro yang efisien.',
    impact: 'Menopang ketahanan harga SOL dan menjaga retensi pengembang serta volume harian di ekosistem Solana.',
    sentiment: 'Bullish',
    score: '+75',
    coin: 'SOL',
    time_ago: 'Insight Ekosistem',
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
        <button class="btn-retry" type="button" onclick="location.reload()">Coba Lagi</button>
      </div>`;
  }

  // ── Empty State ──
  function renderEmpty() {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1">
        Tidak ada berita ditemukan untuk filter ini.
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
    return 'badge-umum';
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
    const neutPct = 100 - bullPct - bearPct; // Jaga total pas 100%

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
      totalArticlesCount.textContent = `${total} Berita Dianalisis`;
    }

    // Update Summary Status
    if (marketStatusText) {
      if (bullPct >= 50) {
        marketStatusText.textContent = `Sentimen Pasar: Didominasi Bullish (${bullPct}%) — Optimisme Tinggi`;
      } else if (bearPct >= 50) {
        marketStatusText.textContent = `Sentimen Pasar: Didominasi Bearish (${bearPct}%) — Waspada Tekanan Jual`;
      } else if (neutPct >= 45) {
        marketStatusText.textContent = `Sentimen Pasar: Konsolidasi Netral (${neutPct}%) — Menunggu Katalis Baru`;
      } else if (bullPct > bearPct) {
        marketStatusText.textContent = `Sentimen Pasar: Cenderung Bullish (${bullPct}% vs ${bearPct}%) — Momentum Positif`;
      } else if (bearPct > bullPct) {
        marketStatusText.textContent = `Sentimen Pasar: Cenderung Tertekan (${bearPct}% vs ${bullPct}%) — Volatilitas Meningkat`;
      } else {
        marketStatusText.textContent = `Sentimen Pasar: Seimbang — Pergerakan Campuran`;
      }
    }
  }

  // ── Render Cards ──
  function renderCards() {
    let filtered = [];

    if (activeFilter === 'Semua') {
      filtered = newsData;
    } else {
      filtered = newsData.filter(item => item.coin === activeFilter);
    }

    // Khusus Solana ($SOL): Jika tidak ditemukan artikel SOL dari feed, tampilkan fallback edukatif
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
      const coinLabel = item.coin === 'Umum' ? 'UMUM' : `$${item.coin}`;
      const scoreLabel = item.score ? `${item.score}` : (item.sentiment === 'Bullish' ? '+70' : (item.sentiment === 'Bearish' ? '-60' : '0'));
      const timeLabel = item.time_ago || 'Terkini';
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
            <span class="impact-label">Dampak Pasar ⚡</span>
            <span class="impact-text">${escapeHTML(item.impact || 'Menjaga dinamika pasar dalam tren saat ini.')}</span>
          </div>

          <div class="card-footer">
            <div class="card-footer-left">
              <a class="source-link" href="${escapeHTML(item.source_url)}" target="_blank" rel="noopener noreferrer">
                Sumber Berita ↗
              </a>
            </div>
            <button class="btn-copy" type="button" data-id="${item.id}" aria-label="Salin analisis berita">
              Salin Analisis
            </button>
          </div>
        </article>`;
    });

    grid.innerHTML = html;

    // Pasang listener copy
    grid.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', handleCopy);
    });
  }

  // ── Render Fallback Khusus Solana ──
  function renderSolanaFallback() {
    grid.innerHTML = `
      <article class="news-card fallback-sol-card" style="animation-delay: 0.05s; grid-column: 1 / -1;">
        <div class="card-top-row">
          <div class="card-badges">
            <span class="badge badge-sol">$SOL</span>
            <span class="badge badge-bullish">+75 Bullish</span>
          </div>
          <span class="card-time">Insight Ekosistem</span>
        </div>

        <h2 class="card-title">${escapeHTML(solFallbackItem.title)}</h2>
        <p class="card-summary">${escapeHTML(solFallbackItem.summary)}</p>

        <div class="card-impact impact-bullish">
          <span class="impact-label">Dampak Pasar ⚡</span>
          <span class="impact-text">${escapeHTML(solFallbackItem.impact)}</span>
        </div>

        <div class="card-footer">
          <div class="card-footer-left">
            <a class="source-link" href="${solFallbackItem.source_url}" target="_blank" rel="noopener noreferrer">
              Cek On-Chain DeFiLlama ↗
            </a>
          </div>
          <button class="btn-copy" type="button" data-id="sol-fallback" aria-label="Salin insight Solana">
            Salin Analisis
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

    // Format salinan lengkap & informatif
    const copyContent = decodeHTML(
      `[CRYPTO SENTIMENT PULSE]\n` +
      `${targetItem.coin !== 'Umum' ? '$' + targetItem.coin : 'PASAR UMUM'} | Sentimen: ${targetItem.sentiment} (${targetItem.score})\n` +
      `Judul: ${targetItem.title}\n\n` +
      `Ringkasan: ${targetItem.summary}\n` +
      `Dampak Pasar: ${targetItem.impact}\n` +
      `Sumber: ${targetItem.source_url}`
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

      btn.textContent = 'Tersalin! ✓';
      btn.classList.add('copied');

      setTimeout(() => {
        btn.textContent = 'Salin Analisis';
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
        throw new Error('Data berita kosong atau tidak dapat dimuat.');
      }

      newsData = data;
      updateMarketBarometer();
      renderCards();
    } catch (err) {
      console.error('[Fetch Error]', err);
      renderError(err.message || 'Gagal memuat feed analisis crypto.');
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
    activeFilter = 'Semua';
    filterBtns.forEach(b => b.classList.remove('active'));
    filterBtns[0].classList.add('active');
    fetchData();
  });

  // ── Init ──
  fetchData();

})();
