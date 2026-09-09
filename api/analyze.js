// Vercel Serverless Function — /api/analyze
// Runtime: Node.js 18+ (native fetch tanpa dependensi eksternal)

export default async function handler(req, res) {
  // CORS & Header
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(200).json({
      error: 'GEMINI_API_KEY belum dikonfigurasi pada environment variables Vercel.'
    });
  }

  try {
    // ── 1. Tarik 20-25 Berita Terbaru dari Feed CoinDesk ──
    const articles = await fetchCoinDeskArticles();

    if (!articles || articles.length === 0) {
      return res.status(200).json({
        error: 'Gagal menarik feed berita dari CoinDesk.'
      });
    }

    // ── 2. System Prompt & User Prompt Gemini ──
    const systemPrompt = `Kamu adalah analis senior pasar cryptocurrency dan jurnalis FinTech profesional.
Tugasmu adalah menganalisis daftar berita crypto berikut secara tajam dan mendalam.

ATURAN KETAT:
1. "title": Buat judul berita dalam Bahasa Indonesia yang tajam, akurat, dan memikat (BUKAN salinan kata per kata dari bahasa Inggris).
2. "summary": Tulis ringkasan 1-2 kalimat padat dalam Bahasa Indonesia murni yang menjelaskan fakta kunci peristiwa.
3. "impact": Buat analisis dampak potensial ke harga/pasar dalam 1 kalimat ringkas (contoh: "Meningkatkan likuiditas dan sentimen institusional", "Memicu tekanan jual jangka pendek", atau "Dampak terbatas pada pergerakan harga").
4. "sentiment": Tentukan apakah berita ini "Bullish", "Bearish", atau "Neutral".
5. "score": Berikan skor numerik sentimen dari -100 s.d +100 dengan tanda +/- (contoh: "+85", "+40", "0", "-65").
6. "coin": Tentukan koin utama yang paling relevan: "BTC", "ETH", "SOL", atau "Umum". PENTING: Jika berita membahas Solana, SOL, atau ekosistem terkait, WAJIB tandai sebagai "SOL".
7. "time_ago": Gunakan perkiraan waktu rilis yang telah disediakan.
8. "source_url": Gunakan URL asli berita.

Respons WAJIB berupa JSON array murni tanpa pembungkus markdown (tanpa \`\`\`json).`;

    const userPrompt = `Analisis seluruh ${articles.length} berita crypto ini:\n\n${JSON.stringify(articles, null, 2)}`;

    // ── 3. Panggil Gemini API (dengan model gemini-1.5-flash & fallback multi-model) ──
    const candidateModels = [
      'gemini-1.5-flash',
      'gemini-2.5-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-flash-latest'
    ];

    let geminiJsonText = null;

    for (const model of candidateModels) {
      try {
        const geminiURL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const geminiRes = await fetch(geminiURL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemPrompt }]
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt }]
              }
            ],
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json'
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const parts = geminiData?.candidates?.[0]?.content?.parts || [];
          const textCandidate = parts.filter(p => p.text && !p.thought).map(p => p.text).join('')
            || parts.map(p => p.text || '').join('');

          if (textCandidate && textCandidate.trim().length > 0) {
            geminiJsonText = textCandidate.trim();
            break;
          }
        } else {
          console.warn(`[Gemini API ${model} status: ${geminiRes.status}]`);
        }
      } catch (callErr) {
        console.warn(`[Gemini API ${model} exception]`, callErr.message);
      }
    }

    let finalResult = [];

    // Parse respons JSON dari Gemini
    if (geminiJsonText) {
      const cleaned = geminiJsonText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          finalResult = parsed.map((item, idx) => ({
            id: item.id || idx + 1,
            title: item.title || articles[idx]?.title || 'Berita Pasar Kripto Terkini',
            summary: item.summary || 'Perkembangan pasar cryptocurrency terbaru dan analisis sentimen.',
            impact: item.impact || 'Menjaga dinamika pasar dalam tren konsolidasi.',
            sentiment: ['Bullish', 'Bearish', 'Neutral'].includes(item.sentiment) ? item.sentiment : 'Neutral',
            score: formatScore(item.score, item.sentiment),
            coin: normalizeCoin(item.coin, articles[idx]?.title, articles[idx]?.description),
            time_ago: item.time_ago || articles[idx]?.time_ago || 'Baru saja',
            source_url: item.source_url || articles[idx]?.link || '#'
          }));
        }
      } catch (parseErr) {
        console.error('[Gemini JSON Parse Error]', parseErr.message);
      }
    }

    // ── 4. Fallback Heuristik Cerdas jika Gemini Mengalami Gangguan Sementara (503/Quota) ──
    if (finalResult.length === 0) {
      console.warn('[Fallback Heuristik Aktif] Menerjemahkan dan menganalisis sentimen berita langsung.');
      finalResult = articles.map((art, idx) => {
        const text = `${art.title} ${art.description}`.toLowerCase();

        // Evaluasi Sentimen & Skor
        let sentiment = 'Neutral';
        let score = '0';
        if (/surge|rally|record high|jump|bull|soar|approval|inflow|climb|boost|gain|outperform/i.test(text)) {
          sentiment = 'Bullish';
          score = '+75';
        } else if (/drop|fall|plunge|crash|bear|hack|lawsuit|ban|slump|sink|down|liquidation|outflow/i.test(text)) {
          sentiment = 'Bearish';
          score = '-65';
        }

        // Deteksi Koin
        let coin = 'Umum';
        if (/solana|\$sol|\bsol\b|phantom|raydium|jupiter/i.test(text)) coin = 'SOL';
        else if (/bitcoin|\$btc|\bbtc\b/i.test(text)) coin = 'BTC';
        else if (/ethereum|\$eth|\beth\b|ether/i.test(text)) coin = 'ETH';

        // Buat judul dan ringkasan bahasa Indonesia yang rapi
        const cleanDesc = art.description ? art.description.replace(/\s+/g, ' ').trim() : '';
        const firstSentence = cleanDesc.split('.')[0]?.trim() || '';

        const title = translateHeuristicTitle(art.title);
        const summary = firstSentence.length > 25
          ? `${title}. ${firstSentence}.`
          : `${title}. Laporan berita mendalam seputar pergerakan aset kripto dan dinamika regulasi terkini.`;

        let impact = 'Membawa volatilitas wajar pada pergerakan harga aset terkait.';
        if (sentiment === 'Bullish') impact = 'Berpotensi mendorong momentum beli dan inflow modal baru.';
        else if (sentiment === 'Bearish') impact = 'Dapat memicu aksi ambil untung atau tekanan jual jangka pendek.';

        return {
          id: idx + 1,
          title,
          summary,
          impact,
          sentiment,
          score,
          coin,
          time_ago: art.time_ago,
          source_url: art.link
        };
      });
    }

    return res.status(200).json(finalResult);

  } catch (err) {
    console.error('[/api/analyze Fatal Error]', err);
    return res.status(200).json({
      error: err.message || 'Terjadi kesalahan internal pada server analisis berita.'
    });
  }
}

// ── Helper: Tarik 20-25 Berita dari CoinDesk ──
async function fetchCoinDeskArticles() {
  // Metode 1: Tarik XML langsung dari CoinDesk RSS (menyediakan 25 berita lengkap)
  try {
    const rssRes = await fetch('https://www.coindesk.com/arc/outboundfeeds/rss/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (rssRes.ok) {
      const xml = await rssRes.text();
      const items = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;

      while ((match = itemRegex.exec(xml)) !== null && items.length < 25) {
        const itemStr = match[1];
        const tm = itemStr.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
        const lm = itemStr.match(/<link>(.*?)<\/link>/i);
        const dm = itemStr.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/i);
        const pm = itemStr.match(/<pubDate>(.*?)<\/pubDate>/i);

        const title = (tm ? (tm[1] || tm[2]) : '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        const link = (lm ? lm[1] : '').trim();
        let description = (dm ? (dm[1] || dm[2]) : '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
        const pubDateStr = (pm ? pm[1] : '').trim();

        if (title) {
          items.push({
            id: items.length + 1,
            title,
            description: description.substring(0, 400),
            link: link || '#',
            time_ago: calculateTimeAgo(pubDateStr)
          });
        }
      }

      if (items.length >= 10) {
        return items;
      }
    }
  } catch (err) {
    console.warn('[Direct XML Fetch Warning]', err.message);
  }

  // Metode 2: Fallback ke rss2json
  try {
    const fallbackRes = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.coindesk.com/arc/outboundfeeds/rss/');
    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      if (Array.isArray(data.items)) {
        return data.items.map((it, idx) => ({
          id: idx + 1,
          title: it.title || 'Untitled',
          description: (it.description || '').replace(/<[^>]*>/g, '').trim().substring(0, 400),
          link: it.link || '#',
          time_ago: calculateTimeAgo(it.pubDate)
        }));
      }
    }
  } catch (err2) {
    console.warn('[rss2json Fallback Warning]', err2.message);
  }

  return [];
}

// ── Helper: Hitung Time Ago ──
function calculateTimeAgo(pubDateStr) {
  if (!pubDateStr) return 'Baru saja';
  try {
    const diffMs = Date.now() - new Date(pubDateStr).getTime();
    if (isNaN(diffMs)) return 'Baru saja';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins}m lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}j lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}h lalu`;
  } catch {
    return 'Baru saja';
  }
}

// ── Helper: Normalisasi Koin ──
function normalizeCoin(coin, title = '', desc = '') {
  const combined = `${coin} ${title} ${desc}`.toLowerCase();
  if (/solana|\$sol|\bsol\b/i.test(combined)) return 'SOL';
  if (/bitcoin|\$btc|\bbtc\b/i.test(combined)) return 'BTC';
  if (/ethereum|\$eth|\beth\b|ether/i.test(combined)) return 'ETH';
  if (['BTC', 'ETH', 'SOL'].includes(coin)) return coin;
  return 'Umum';
}

// ── Helper: Format Skor ──
function formatScore(score, sentiment) {
  if (score !== undefined && score !== null) {
    const str = String(score).trim();
    if (str.startsWith('+') || str.startsWith('-')) return str;
    const num = parseInt(str, 10);
    if (!isNaN(num)) {
      return num > 0 ? `+${num}` : `${num}`;
    }
  }
  if (sentiment === 'Bullish') return '+70';
  if (sentiment === 'Bearish') return '-60';
  return '0';
}

// ── Helper: Adaptasi Judul Heuristik ──
function translateHeuristicTitle(title) {
  if (!title) return 'Pembaruan Berita Pasar Crypto';
  return title
    .replace(/\bflags\b/gi, 'Soroti')
    .replace(/\bAML lapses\b/gi, 'Pelanggaran Aturan Anti-Pencucian Uang')
    .replace(/\boutflows\b/gi, 'Arus Dana Keluar')
    .replace(/\binflows\b/gi, 'Arus Dana Masuk')
    .replace(/\brises\b/gi, 'Melonjak')
    .replace(/\bdrops\b/gi, 'Terkoreksi')
    .replace(/\bhits record\b/gi, 'Capai Rekor Baru')
    .replace(/\bLive updates:\b/gi, 'Kabar Terkini:')
    .trim();
}
