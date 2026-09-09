/* ============================================
   Crypto Sentiment Pulse — Client Logic
   ============================================ */

(() => {
  'use strict';

  // ── State ──
  let newsData = [];
  let activeFilter = 'Semua';

  // ── DOM References ──
  const grid = document.getElementById('card-grid');
  const btnRefresh = document.getElementById('btn-refresh');
  const filterBtns = document.querySelectorAll('.filter-btn');

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
          <div class="skeleton-line w-60"></div>
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
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Sentiment Badge Class ──
  function sentimentClass(sentiment) {
    const s = (sentiment || '').toLowerCase();
    if (s === 'bullish') return 'badge-bullish';
    if (s === 'bearish') return 'badge-bearish';
    return 'badge-neutral';
  }

  // ── Render Cards ──
  function renderCards() {
    const filtered = activeFilter === 'Semua'
      ? newsData
      : newsData.filter(item => item.coin === activeFilter || (activeFilter === 'Semua'));

    if (filtered.length === 0) {
      renderEmpty();
      return;
    }

    let html = '';
    filtered.forEach((item, index) => {
      const badgeClass = sentimentClass(item.sentiment);
      const coinLabel = item.coin === 'Umum' ? 'UMUM' : `$${item.coin}`;
      const delay = index * 0.05;

      html += `
        <article class="news-card" style="animation-delay: ${delay}s">
          <div class="card-top-row">
            <div class="card-badges">
              <span class="badge ${badgeClass}">${escapeHTML(item.sentiment)}</span>
              <span class="badge badge-coin">${escapeHTML(coinLabel)}</span>
            </div>
            <button class="btn-copy" type="button" data-summary="${escapeHTML(item.summary)}" aria-label="Salin ringkasan">
              Salin Ringkasan
            </button>
          </div>
          <h2 class="card-title">${escapeHTML(item.title)}</h2>
          <p class="card-summary">${escapeHTML(item.summary)}</p>
          <div class="card-footer">
            <a class="source-link" href="${escapeHTML(item.source_url)}" target="_blank" rel="noopener noreferrer">
              Baca Sumber ↗
            </a>
          </div>
        </article>`;
    });

    grid.innerHTML = html;

    // Attach copy listeners
    grid.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', handleCopy);
    });
  }

  // ── Copy to Clipboard ──
  async function handleCopy(e) {
    const btn = e.currentTarget;
    const summary = btn.getAttribute('data-summary');
    if (!summary) return;

    try {
      await navigator.clipboard.writeText(summary);
      btn.textContent = 'Tersalin! ✓';
      btn.classList.add('copied');

      setTimeout(() => {
        btn.textContent = 'Salin Ringkasan';
        btn.classList.remove('copied');
      }, 1500);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = summary;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);

      btn.textContent = 'Tersalin! ✓';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Salin Ringkasan';
        btn.classList.remove('copied');
      }, 1500);
    }
  }

  // ── Fetch Data ──
  async function fetchData() {
    renderSkeleton();
    btnRefresh.disabled = true;

    try {
      const res = await fetch('/api/analyze');

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Data berita kosong atau tidak valid dari server.');
      }

      newsData = data;
      renderCards();
    } catch (err) {
      console.error('[Fetch Error]', err);
      renderError(err.message || 'Gagal mengambil data. Silakan coba lagi.');
    } finally {
      btnRefresh.disabled = false;
    }
  }

  // ── Filter Tabs ──
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
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
