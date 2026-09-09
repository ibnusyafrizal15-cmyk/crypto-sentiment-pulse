// Vercel Serverless Function — /api/analyze
// Runtime: Node.js 18+ (native fetch)

export default async function handler(req, res) {
  // CORS & method guard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di environment variables.' });
  }

  try {
    // ── Step 1: Fetch CoinDesk RSS via rss2json ──
    const RSS_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://www.coindesk.com/arc/outboundfeeds/rss/';
    const rssRes = await fetch(RSS_URL);

    if (!rssRes.ok) {
      throw new Error(`RSS feed error: ${rssRes.status} ${rssRes.statusText}`);
    }

    const rssData = await rssRes.json();

    if (!rssData.items || rssData.items.length === 0) {
      throw new Error('RSS feed tidak mengembalikan item berita.');
    }

    // Take top 10 news items
    const articles = rssData.items.slice(0, 10).map((item, idx) => ({
      id: idx + 1,
      title: item.title || 'Untitled',
      description: (item.description || '').replace(/<[^>]*>/g, '').substring(0, 500),
      link: item.link || '',
    }));

    // ── Step 2: Build Gemini Prompt ──
    const systemPrompt = `Kamu adalah analis pasar cryptocurrency profesional. Tugasmu:
1. Untuk setiap berita di bawah ini, buat ringkasan inti dalam TEPAT 2 kalimat menggunakan Bahasa Indonesia yang natural dan informatif.
2. Tentukan koin utama yang paling relevan: "BTC", "ETH", "SOL", atau "Umum" jika tidak spesifik ke satu koin.
3. Tentukan sentimen pasar dari berita tersebut: "Bullish", "Bearish", atau "Neutral".

ATURAN KETAT:
- Respons WAJIB berupa JSON array murni. JANGAN gunakan markdown formatting, JANGAN gunakan \`\`\`json, JANGAN tambahkan teks di luar JSON.
- Setiap objek dalam array HARUS memiliki field: "id" (number), "title" (string, judul asli), "summary" (string, ringkasan 2 kalimat Bahasa Indonesia), "sentiment" (string, salah satu dari: "Bullish", "Bearish", "Neutral"), "coin" (string, salah satu dari: "BTC", "ETH", "SOL", "Umum"), "source_url" (string, URL asli berita).
- Pastikan jumlah objek di array sama dengan jumlah berita yang diberikan.`;

    const userPrompt = `Berikut ${articles.length} berita crypto terbaru. Analisis semuanya:\n\n${JSON.stringify(articles, null, 2)}`;

    // ── Step 3: Call Gemini API (with multi-model fallback & retry) ──
    const candidateModels = [
      'gemini-1.5-flash',
      'gemini-2.5-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-flash-latest'
    ];

    let geminiData = null;
    let lastError = null;

    for (const model of candidateModels) {
      try {
        const geminiURL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const geminiRes = await fetch(geminiURL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (geminiRes.ok) {
          geminiData = await geminiRes.json();
          break;
        } else {
          const errText = await geminiRes.text();
          console.warn(`[Gemini ${model} failed: ${geminiRes.status}]`, errText.substring(0, 200));
          lastError = new Error(`Gemini ${model} returned ${geminiRes.status}`);
        }
      } catch (callErr) {
        lastError = callErr;
        console.warn(`[Gemini ${model} exception]`, callErr.message);
      }
    }

    let finalResult = [];

    if (geminiData) {
      // Extract text from parts (excluding internal thoughts if present)
      const parts = geminiData?.candidates?.[0]?.content?.parts || [];
      const nonThoughtText = parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
      const rawText = nonThoughtText || parts.map(p => p.text || '').join('');

      if (rawText) {
        let cleanedText = rawText.trim()
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '');

        try {
          const parsed = JSON.parse(cleanedText);
          if (Array.isArray(parsed) && parsed.length > 0) {
            finalResult = parsed.map((item, idx) => ({
              id: item.id || idx + 1,
              title: item.title || articles[idx]?.title || 'Untitled',
              summary: item.summary || `${articles[idx]?.title || ''}. Berita pasar crypto terkini.`,
              sentiment: ['Bullish', 'Bearish', 'Neutral'].includes(item.sentiment) ? item.sentiment : 'Neutral',
              coin: ['BTC', 'ETH', 'SOL', 'Umum'].includes(item.coin) ? item.coin : 'Umum',
              source_url: item.source_url || articles[idx]?.link || '#',
            }));
          }
        } catch (parseErr) {
          console.error('[JSON Parse Error]', parseErr.message);
        }
      }
    }

    // Heuristic fallback if Gemini is temporarily unavailable (e.g. 503 outage)
    if (finalResult.length === 0) {
      console.warn('[Fallback] Menggunakan analisis heuristik berbasis kata kunci karena Gemini sedang sibuk.');
      finalResult = articles.map((art, idx) => {
        const text = `${art.title} ${art.description}`.toLowerCase();

        // Sentiment heuristic
        let sentiment = 'Neutral';
        if (/surge|rally|high|gain|jump|bull|soar|record|approval|inflow|climb|boost/i.test(text)) {
          sentiment = 'Bullish';
        } else if (/drop|fall|plunge|crash|bear|hack|lawsuit|ban|slump|sink|down|liquidation/i.test(text)) {
          sentiment = 'Bearish';
        }

        // Coin heuristic
        let coin = 'Umum';
        if (/bitcoin|\$btc|\bbtc\b/i.test(text)) coin = 'BTC';
        else if (/ethereum|\$eth|\beth\b|ether/i.test(text)) coin = 'ETH';
        else if (/solana|\$sol|\bsol\b/i.test(text)) coin = 'SOL';

        // 2-sentence summary fallback
        const cleanDesc = art.description ? art.description.replace(/\s+/g, ' ').trim() : '';
        const summary = cleanDesc.length > 30
          ? `${art.title}. ${cleanDesc.split('.')[0] || 'Simak perkembangan selengkapnya pada tautan berita asli'}.`
          : `${art.title}. Berita terkini mengenai perkembangan ekosistem cryptocurrency global.`;

        return {
          id: idx + 1,
          title: art.title,
          summary,
          sentiment,
          coin,
          source_url: art.link,
        };
      });
    }

    return res.status(200).json(finalResult);
  } catch (err) {
    console.error('[/api/analyze Error]', err);
    return res.status(500).json({
      error: err.message || 'Terjadi kesalahan internal pada server.',
    });
  }
}
