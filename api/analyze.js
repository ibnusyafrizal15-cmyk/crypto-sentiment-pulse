// Vercel Serverless Function — /api/analyze
// Runtime: Node.js 18+ (native fetch with no external dependencies)

export default async function handler(req, res) {
  // CORS & Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(200).json({
      error: 'GEMINI_API_KEY is not configured in Vercel environment variables.'
    });
  }

  try {
    // ── 1. Fetch 20-25 Latest News Articles from CoinDesk Feed ──
    const articles = await fetchCoinDeskArticles();

    if (!articles || articles.length === 0) {
      return res.status(200).json({
        error: 'Failed to fetch news feed from CoinDesk.'
      });
    }

    // ── 2. System Prompt & User Prompt for Gemini ──
    const systemPrompt = `You are a senior cryptocurrency market analyst and professional FinTech journalist.
Your task is to provide sharp, in-depth sentiment analysis for the following crypto news articles.

STRICT RULES:
1. "title": Provide a sharp, accurate, engaging headline in English.
2. "summary": Write a concise 1-2 sentence summary in English highlighting key facts and events.
3. "impact": Provide a 1-sentence market/price impact assessment (e.g., "Bolsters institutional liquidity and sentiment", "May trigger short-term selling pressure", or "Neutral impact with subdued volatility").
4. "sentiment": Strictly classify as "Bullish", "Bearish", or "Neutral".
5. "score": Provide a signed numerical score from -100 to +100 with +/- sign (e.g., "+85", "+40", "0", "-65").
6. "coin": Identify the primary relevant coin: "BTC", "ETH", "SOL", or "General". CRITICAL: If the article discusses Solana, SOL, or its ecosystem, you MUST tag it as "SOL".
7. "time_ago": Use the estimated publication time provided.
8. "source_url": Use the original article URL.

Response MUST be a pure JSON array with no markdown formatting (no \`\`\`json).`;

    const userPrompt = `Analyze all ${articles.length} crypto news items:\n\n${JSON.stringify(articles, null, 2)}`;

    // ── 3. Call Gemini API (with gemini-1.5-flash & multi-model fallback) ──
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

    // Parse JSON response from Gemini
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
            title: item.title || articles[idx]?.title || 'Latest Crypto Market News',
            summary: item.summary || 'Recent cryptocurrency market developments and sentiment analysis.',
            impact: item.impact || 'Market dynamics remain within standard consolidation parameters.',
            sentiment: ['Bullish', 'Bearish', 'Neutral'].includes(item.sentiment) ? item.sentiment : 'Neutral',
            score: formatScore(item.score, item.sentiment),
            coin: normalizeCoin(item.coin, articles[idx]?.title, articles[idx]?.description),
            time_ago: item.time_ago || articles[idx]?.time_ago || 'Just now',
            source_url: item.source_url || articles[idx]?.link || '#'
          }));
        }
      } catch (parseErr) {
        console.error('[Gemini JSON Parse Error]', parseErr.message);
      }
    }

    // ── 4. Intelligent Heuristic Fallback if Gemini Temporarily Unavailable ──
    if (finalResult.length === 0) {
      console.warn('[Heuristic Fallback Active] Evaluating market sentiment directly.');
      finalResult = articles.map((art, idx) => {
        const text = `${art.title} ${art.description}`.toLowerCase();

        // Evaluate Sentiment & Score
        let sentiment = 'Neutral';
        let score = '0';
        if (/surge|rally|record high|jump|bull|soar|approval|inflow|climb|boost|gain|outperform/i.test(text)) {
          sentiment = 'Bullish';
          score = '+75';
        } else if (/drop|fall|plunge|crash|bear|hack|lawsuit|ban|slump|sink|down|liquidation|outflow/i.test(text)) {
          sentiment = 'Bearish';
          score = '-65';
        }

        // Coin Detection
        let coin = 'General';
        if (/solana|\$sol|\bsol\b|phantom|raydium|jupiter/i.test(text)) coin = 'SOL';
        else if (/bitcoin|\$btc|\bbtc\b/i.test(text)) coin = 'BTC';
        else if (/ethereum|\$eth|\beth\b|ether/i.test(text)) coin = 'ETH';

        const cleanDesc = art.description ? art.description.replace(/\s+/g, ' ').trim() : '';
        const firstSentence = cleanDesc.split('.')[0]?.trim() || '';

        const title = art.title.replace(/\s+/g, ' ').trim();
        const summary = firstSentence.length > 25
          ? `${title}. ${firstSentence}.`
          : `${title}. Comprehensive market coverage on digital asset price action and regulatory developments.`;

        let impact = 'Brings normal market volatility to associated digital assets.';
        if (sentiment === 'Bullish') impact = 'Likely to drive buying momentum and fresh capital inflows.';
        else if (sentiment === 'Bearish') impact = 'Could trigger profit-taking or short-term downward pressure.';

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
      error: err.message || 'Internal server error during news sentiment analysis.'
    });
  }
}

// ── Helper: Fetch 20-25 Articles from CoinDesk ──
async function fetchCoinDeskArticles() {
  // Method 1: Fetch XML directly from CoinDesk RSS (provides 25 full articles)
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

  // Method 2: Fallback to rss2json
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

// ── Helper: Calculate Time Ago ──
function calculateTimeAgo(pubDateStr) {
  if (!pubDateStr) return 'Just now';
  try {
    const diffMs = Date.now() - new Date(pubDateStr).getTime();
    if (isNaN(diffMs)) return 'Just now';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Just now';
  }
}

// ── Helper: Normalize Coin ──
function normalizeCoin(coin, title = '', desc = '') {
  const combined = `${coin || ''} ${title || ''} ${desc || ''}`.toLowerCase();
  if (/solana|\$sol|\bsol\b/i.test(combined)) return 'SOL';
  if (/bitcoin|\$btc|\bbtc\b/i.test(combined)) return 'BTC';
  if (/ethereum|\$eth|\beth\b|ether/i.test(combined)) return 'ETH';
  if (['BTC', 'ETH', 'SOL'].includes(coin)) return coin;
  return 'General';
}

// ── Helper: Format Score ──
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
