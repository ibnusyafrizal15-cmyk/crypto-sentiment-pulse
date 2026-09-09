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

  // ── Escape HTML (untuk render DOM aman) ──
  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Decode HTML Entities (jika ada string yang ter-encode) ──
  function decodeHTML(str) {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
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
      : newsData.filter(item => item.coin === activeFilter);

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
            <button class="btn-copy" type="button" data-id="${item.id}" aria-label="Salin ringkasan berita">
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

    // Pasang event listener tombol salin
    grid.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', handleCopy);
    });
  }

  // ── Copy to Clipboard (Membaca langsung dari state newsData tanpa escape HTML) ──
  async function handleCopy(e) {
    const btn = e.currentTarget;
    const articleId = parseInt(btn.getAttribute('data-id'), 10);

    // Ambil summary asli murni langsung dari array state
    const matchedArticle = newsData.find(item => item.id === articleId);
    let summaryText = matchedArticle ? matchedArticle.summary : '';

    // Pastikan karakter HTML entities seperti &quot;, &#39;, &amp; didecode jika ada
    summaryText = decodeHTML(summaryText);

    if (!summaryText) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(summaryText);
      } else {
        // Fallback untuk context browser non-HTTPS
        const ta = document.createElement('textarea');
        ta.value = summaryText;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      // Feedback visual
      btn.textContent = 'Tersalin! ✓';
      btn.classList.add('copied');

      setTimeout(() => {
        btn.textContent = 'Salin Ringkasan';
        btn.classList.remove('copied');
      }, 1500);
    } catch (err) {
      console.error('[Copy Error]', err);
    }
  }

  // ── Fetch Data ──
  async function fetchData() {
    renderSkeleton();
    btnRefresh.disabled = true;

    try {
      const res = await fetch('/api/analyze');
      const data = await res.json();

      // Cek jika server mengembalikan pesan error
      if (data && data.error) {
        throw new Error(data.error);
      }

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
