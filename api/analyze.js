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

  // Validasi GEMINI_API_KEY
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(200).json({
      error: 'GEMINI_API_KEY belum dikonfigurasi pada environment variables Vercel.'
    });
  }

  try {
    // ── 1. Tarik RSS Feed CoinDesk via rss2json ──
    const RSS_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://www.coindesk.com/arc/outboundfeeds/rss/';
    const rssRes = await fetch(RSS_URL);

    if (!rssRes.ok) {
      return res.status(200).json({
        error: `Gagal mengambil RSS feed CoinDesk: HTTP ${rssRes.status} ${rssRes.statusText}`
      });
    }

    const rssData = await rssRes.json();
    if (!rssData.items || !Array.isArray(rssData.items) || rssData.items.length === 0) {
      return res.status(200).json({
        error: 'RSS feed CoinDesk tidak mengembalikan artikel berita.'
      });
    }

    // Ambil 8-10 artikel teratas (title, description, link)
    const articles = rssData.items.slice(0, 10).map((item, idx) => ({
      id: idx + 1,
      title: item.title ? item.title.trim() : 'Untitled',
      description: item.description
        ? item.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 500)
        : '',
      source_url: item.link || '#'
    }));

    // ── 2. System Prompt & User Prompt Gemini ──
    const systemPrompt = "Analisis daftar berita crypto berikut. Untuk setiap berita, buat ringkasan padat 2 kalimat dalam Bahasa Indonesia, tentukan sentimen (Bullish, Bearish, atau Neutral), dan tentukan koin terkait (BTC, ETH, SOL, atau Umum). Kembalikan dalam bentuk JSON array objek dengan properti: id, title, summary, sentiment, coin, source_url.";
    const userPrompt = `Daftar berita crypto:\n${JSON.stringify(articles, null, 2)}`;

    // ── 3. Panggil Gemini API (dengan model gemini-1.5-flash & fallback jika model dipensiunkan/overload) ──
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
            break; // Berhasil mendapatkan respons JSON
          }
        } else {
          console.warn(`[Gemini API ${model} status: ${geminiRes.status}]`);
        }
      } catch (callErr) {
        console.warn(`[Gemini API ${model} exception]`, callErr.message);
      }
    }

    let finalResult = [];

    // Parse hasil JSON dari Gemini
    if (geminiJsonText) {
      // Hilangkan codeblock markdown jika ada
      const cleaned = geminiJsonText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          finalResult = parsed.map((item, idx) => ({
            id: item.id || idx + 1,
            title: item.title || articles[idx]?.title || 'Untitled',
            summary: item.summary || `${articles[idx]?.title || ''}. Berita perkembangan terkini pasar crypto.`,
            sentiment: ['Bullish', 'Bearish', 'Neutral'].includes(item.sentiment) ? item.sentiment : 'Neutral',
            coin: ['BTC', 'ETH', 'SOL', 'Umum'].includes(item.coin) ? item.coin : 'Umum',
            source_url: item.source_url || articles[idx]?.source_url || '#'
          }));
        }
      } catch (parseErr) {
        console.error('[Gemini JSON Parse Error]', parseErr.message);
      }
    }

    // ── 4. Fallback Heuristik Tangguh jika API AI Sedang Mengalami Gangguan Global (503/Quota) ──
    if (finalResult.length === 0) {
      console.warn('[Fallback] Mengaktifkan analisis heuristik teks karena Gemini API sedang sibuk.');
      finalResult = articles.map((art, idx) => {
        const text = `${art.title} ${art.description}`.toLowerCase();

        // Sentimen berbasis kata kunci berita
        let sentiment = 'Neutral';
        if (/surge|rally|high|gain|jump|bull|soar|record|approval|inflow|climb|boost/i.test(text)) {
          sentiment = 'Bullish';
        } else if (/drop|fall|plunge|crash|bear|hack|lawsuit|ban|slump|sink|down|liquidation/i.test(text)) {
          sentiment = 'Bearish';
        }

        // Koin terkait
        let coin = 'Umum';
        if (/bitcoin|\$btc|\bbtc\b/i.test(text)) coin = 'BTC';
        else if (/ethereum|\$eth|\beth\b|ether/i.test(text)) coin = 'ETH';
        else if (/solana|\$sol|\bsol\b/i.test(text)) coin = 'SOL';

        // Ringkasan padat 2 kalimat
        const cleanDesc = art.description || '';
        const firstSentence = cleanDesc.split('.')[0]?.trim();
        const summary = firstSentence && firstSentence.length > 20
          ? `${art.title}. ${firstSentence}.`
          : `${art.title}. Informasi terkini mengenai pergerakan aset kripto dan sentimen pasar global.`;

        return {
          id: idx + 1,
          title: art.title,
          summary,
          sentiment,
          coin,
          source_url: art.source_url
        };
      });
    }

    return res.status(200).json(finalResult);
  } catch (err) {
    console.error('[/api/analyze Server Error]', err);
    return res.status(200).json({
      error: err.message || 'Terjadi kesalahan saat memproses data analisis berita.'
    });
  }
}
