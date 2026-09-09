<div align="center">

# ⚡ Crypto Sentiment Pulse

### *Real-Time Cryptocurrency Market Sentiment & Intelligence Dashboard*

[![HTML5](https://img.shields.io/badge/HTML5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-%23F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Vercel Serverless](https://img.shields.io/badge/Vercel-Serverless%20Functions-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![Google Gemini AI](https://img.shields.io/badge/Google%20Gemini-1.5%20Flash-%238E75B2.svg?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](LICENSE)

<br/>

> A high-utility, minimalist FinTech utility terminal inspired by **Linear.app**, **DefiLlama**, and **Bloomberg Terminal**.  
> Monitors real-time crypto headlines from CoinDesk, evaluates market impact using Google Gemini AI, and displays market sentiment across Bitcoin, Ethereum, and Solana.

<br/>

[**🌐 View Live Demo**](https://crypto-sentiment-pulse.vercel.app) &nbsp;&bull;&nbsp; [**Report Bug**](https://github.com/ibnusyafrizal15-cmyk/crypto-sentiment-pulse/issues) &nbsp;&bull;&nbsp; [**Request Feature**](https://github.com/ibnusyafrizal15-cmyk/crypto-sentiment-pulse/issues)

---

</div>

## 📌 Table of Contents

- [Live Demo](#-live-demo)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Local Installation & Setup](#-local-installation--setup)
- [Deployment to Vercel](#-deployment-to-vercel)
- [Design Philosophy](#-design-philosophy)
- [License](#-license)

---

## 🚀 Live Demo

Experience the live application deployed on Vercel:

👉 **[https://crypto-sentiment-pulse.vercel.app](https://crypto-sentiment-pulse.vercel.app)**

> *Note: Make sure `GEMINI_API_KEY` is configured in your Vercel Project Environment Variables.*

---

## ⚡ Key Features

- **🔴 25-Article Live Stream**: Ingests the latest 25 breaking stories directly from the CoinDesk XML RSS outbound feed.
- **🧠 Google Gemini AI Analysis Engine**:
  - **Sentiment Classification**: Labels articles strictly into `Bullish`, `Bearish`, or `Neutral`.
  - **Numeric Impact Scoring**: Calculates a signed confidence score between `-100` and `+100`.
  - **Actionable Market Impact**: Generates a 1-sentence breakdown of liquidity, volatility, or price trends.
  - **Intelligent Coin Attribution**: Automatically attributes stories to **Bitcoin (`$BTC`)**, **Ethereum (`$ETH`)**, **Solana (`$SOL`)**, or **Broad Market**.
- **📊 Market Pulse Barometer**: Dynamic segmented status bar presenting real-time market sentiment distribution (`Bullish %` vs `Neutral %` vs `Bearish %`) along with high-level executive summaries.
- **🎯 One-Touch Asset Filters**: Instantly toggle between **All**, **Bitcoin ($BTC)**, **Ethereum ($ETH)**, and **Solana ($SOL)**.
- **🛡️ Solana Ecosystem Fallback**: Guarantees zero blank screens—if breaking Solana wire news is quiet, an educational on-chain ecosystem insight is seamlessly provided with direct DeFiLlama links.
- **📋 1-Click Clipboard Sharing**: Copy pre-formatted market analysis reports (Headline, Sentiment Score, Impact, and Source) with instant visual feedback (`Copied! ✓`).
- **🔄 Dual Failover System**:
  - **Feed Failover**: CoinDesk XML Direct Stream ➔ `rss2json` backup.
  - **AI Failover**: Multi-model Gemini fallback (`gemini-1.5-flash`, `gemini-2.5-flash`, etc.) ➔ Deterministic rule-based heuristic engine.

---

## 🏗️ System Architecture

```mermaid
flowchart LR
    A[📡 CoinDesk Outbound RSS] -->|XML / JSON Feed| B(⚡ Vercel Serverless Function<br/><code>/api/analyze</code>)
    B -->|Structured Prompt| C{🤖 Google Gemini API<br/><code>gemini-1.5-flash</code>}
    C -->|JSON Analysis| B
    B -->|Fallback Heuristic Engine<br/><i>(if API unavailable)</i>| B
    B -->|Pure JSON Array| D[💻 Client Dashboard<br/>Vanilla HTML5 / CSS3 / JS]
    D --> E[📊 Market Barometer]
    D --> F[🪙 Coin Filters BTC / ETH / SOL]
    D --> G[📋 1-Click Clipboard Share]
```

### Flow Breakdown:
1. **Fetch**: `/api/analyze` fetches the latest 25 items from CoinDesk RSS.
2. **Analyze**: The backend sends structured JSON generation requests to Google Gemini.
3. **Format**: Returns normalized sentiment objects (`id`, `title`, `summary`, `impact`, `sentiment`, `score`, `coin`, `time_ago`, `source_url`).
4. **Render**: Vanilla JavaScript dynamically renders the segmented barometer, ticker badges, and reactive cards with zero framework overhead.

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | Vanilla HTML5, CSS3, JS (ES6+) | Zero external framework dependencies; pure speed & 100 Lighthouse score potential |
| **Design System** | Custom Dark Utility Theme | High-contrast palette (`#0A0B0E`, `#12141A`, `#1E222D`), glass accents, and JetBrains Mono typography |
| **Backend API** | Vercel Serverless Function | Node.js 18+ runtime utilizing native `fetch`, stateless and globally distributed |
| **Intelligence** | Google Gemini 1.5 Flash | Fast multimodal/NLP model configured with JSON schema output |
| **Data Provider** | CoinDesk Outbound Feed | Authoritative institutional crypto journalism wire |

---

## 📁 Project Structure

```text
crypto-sentiment-pulse/
├── api/
│   └── analyze.js       # Vercel Serverless Function (RSS ingestion & Gemini AI pipeline)
├── index.html           # Main dashboard structure & SEO metadata
├── script.js            # Reactive client-side logic, filtering, & clipboard copy
├── style.css            # Minimalist FinTech terminal design system
├── package.json         # Project metadata
├── .env.example         # Environment template for local development
├── .gitignore           # Git ignore list for keys and cache
└── README.md            # Comprehensive documentation
```

---

## 🔌 API Reference

### `GET /api/analyze`

Fetches and analyzes the latest 25 crypto stories.

#### Response Structure (`200 OK`):
```json
[
  {
    "id": 1,
    "title": "Bitcoin Surges Past Key Resistance as Spot Inflows Rebound",
    "summary": "Bitcoin climbed higher following sustained institutional spot ETF inflows, breaking key overhead resistance levels.",
    "impact": "Likely to drive buying momentum and fresh capital inflows into major digital assets.",
    "sentiment": "Bullish",
    "score": "+78",
    "coin": "BTC",
    "time_ago": "25m ago",
    "source_url": "https://www.coindesk.com/markets/..."
  }
]
```

---

## 💻 Local Installation & Setup

### Prerequisites
- Node.js 18.x or higher
- [Google AI Studio API Key](https://aistudio.google.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/ibnusyafrizal15-cmyk/crypto-sentiment-pulse.git
cd crypto-sentiment-pulse
```

### 2. Configure Environment Variables
Copy `.env.example` into `.env`:
```bash
cp .env.example .env
```
Add your Google Gemini API Key inside `.env`:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 3. Run Locally

#### Option A: Using Vercel CLI (Recommended)
```bash
npx vercel dev
```
Open `http://localhost:3000` in your browser.

#### Option B: Using Python Test Server
If you want to test without installing Node dependencies:
```bash
python -m http.server 3000
```

---

## ☁️ Deployment to Vercel

1. Push your changes to GitHub:
   ```bash
   git push origin main
   ```
2. Go to [Vercel Dashboard](https://vercel.com) and click **"Add New Project"**.
3. Import the `crypto-sentiment-pulse` repository.
4. In **Settings > Environment Variables**, add:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `your_gemini_api_key`
5. Click **Deploy**. Your dashboard will be live within seconds!

---

## 🎨 Design Philosophy

- **FinTech Terminal Utility**: Clean, distraction-free interface focused on data density and actionable insight.
- **Micro-Animations**: Smooth cubic-bezier transitions for sentiment bars, skeleton loaders, and interactive filter states.
- **Accessible & Responsive**: Fully responsive layout tailored for desktops, tablets, and mobile devices.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) &copy; 2026 Crypto Sentiment Pulse.
