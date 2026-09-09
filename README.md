# Crypto Sentiment Pulse

A sleek, real-time cryptocurrency news sentiment analysis dashboard powered by Google Gemini AI and CoinDesk RSS feed.

Designed with a high-utility FinTech terminal aesthetic inspired by Linear.app, DefiLlama, and Bloomberg Terminal.

---

## Key Features

- **Live CoinDesk Feed**: Automatically retrieves the latest 25 breaking stories directly from CoinDesk RSS.
- **Gemini AI Sentiment Engine**: Analyzes each article using Google Gemini (`gemini-1.5-flash` with multi-model failover) to determine:
  - **Sentiment Label**: Bullish, Bearish, or Neutral.
  - **Score**: Signed sentiment score from `-100` to `+100`.
  - **Market Impact**: 1-sentence actionable summary of potential price or liquidity impacts.
  - **Coin Tagging**: Smart classification for `$BTC`, `$ETH`, `$SOL`, and broader market trends.
- **Market Sentiment Barometer**: Dynamic segmented progress bar displaying the real-time ratio of Bullish vs. Neutral vs. Bearish articles with executive market summaries.
- **Asset Filtering**: Filter news instantaneously by **All**, **Bitcoin ($BTC)**, **Ethereum ($ETH)**, and **Solana ($SOL)**.
- **1-Click Copy Analysis**: Formatted clipboard snippet export for analysts and social sharing.
- **Native Serverless Architecture**: Built with vanilla HTML5, CSS3, and JavaScript, paired with a zero-dependency Vercel Serverless Function (`/api/analyze`).

---

## Tech Stack

- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Design System), Modern JavaScript (ES Modules).
- **Backend**: Vercel Serverless Function (`Node.js 18+`, native `fetch`, zero npm runtime dependencies).
- **AI Model**: Google Gemini API (`gemini-1.5-flash`).
- **Data Source**: CoinDesk XML RSS Feed.

---

## Getting Started Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ibnusyafrizal15-cmyk/crypto-sentiment-pulse.git
   cd crypto-sentiment-pulse
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Run with Vercel CLI (or local server)**:
   ```bash
   npx vercel dev
   ```
   Open `http://localhost:3000` in your browser.

---

## Deployment to Vercel

1. Push your repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Under **Environment Variables**, add:
   - Key: `GEMINI_API_KEY`
   - Value: Your Google Gemini API Key from Google AI Studio.
4. Deploy!

---

## License

MIT License &copy; 2026 Crypto Sentiment Pulse.
