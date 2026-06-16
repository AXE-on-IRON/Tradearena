# 📈 TradeArena — Local Trading Simulation Platform

A fully local, real-time trading simulator with live market data across **stocks, bonds, currencies, commodities, and equities** from all major international markets.

![TradeArena](https://img.shields.io/badge/TradeArena-v1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

---

## 🌍 Markets Covered

| Asset Class | Markets |
|-------------|---------|
| **Stocks / Equities** | NYSE, NASDAQ, LSE, TSE, HKEX, SSE, SZSE, Euronext, ASX, NSE, BSE |
| **Currencies (Forex)** | 170+ currency pairs — majors, minors, exotics |
| **Commodities** | Gold, Silver, Oil (WTI/Brent), Natural Gas, Copper, Wheat, Coffee |
| **Bonds** | US Treasuries (2Y/5Y/10Y/30Y), UK Gilts, German Bunds, JGB |
| **Crypto** | BTC, ETH, and top 20 by market cap |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **Free API keys** (see [API Setup](#-api-setup))

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/trade-arena.git
cd trade-arena

# Install backend dependencies
cd backend && pip install -r requirements.txt && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure API Keys

```bash
cp .env.example .env
# Edit .env with your free API keys (see API Setup section)
```

### 3. Start the Platform

```bash
# Option A: One command (requires concurrently)
npm run dev

# Option B: Two terminals
# Terminal 1 — Backend
cd backend && python app.py

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### 4. Open in Browser

```
http://localhost:5173
```

---

## 🔑 API Setup

All APIs below have **free tiers** sufficient for simulation use.

### Primary Data Sources

| API | What it provides | Free Tier | Sign Up |
|-----|-----------------|-----------|---------|
| **Alpha Vantage** | Stocks, Forex, Crypto, Commodities | 25 req/day | [alphavantage.co](https://www.alphavantage.co/support/#api-key) |
| **Yahoo Finance (yfinance)** | Stocks, ETFs, Indices (no key needed) | Unlimited* | Built-in |
| **ExchangeRate API** | 170+ live currency pairs | 1,500 req/mo | [exchangerate-api.com](https://www.exchangerate-api.com/) |
| **CoinGecko** | Crypto prices & market data | 30 req/min | [coingecko.com](https://www.coingecko.com/en/api) |
| **FRED API** | US Treasury / Bond yields | Unlimited | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |

### `.env` Configuration

```env
# Alpha Vantage (stocks, commodities, forex backup)
ALPHA_VANTAGE_API_KEY=your_key_here

# ExchangeRate API (live forex)
EXCHANGE_RATE_API_KEY=your_key_here

# FRED API (bond yields)
FRED_API_KEY=your_key_here

# CoinGecko (optional — works without key on free tier)
COINGECKO_API_KEY=

# App settings
PORT=8000
FRONTEND_URL=http://localhost:5173
STARTING_BALANCE=100000
DEFAULT_CURRENCY=USD
```

---

## 🏗️ Architecture

```
trade-arena/
├── backend/               # Python FastAPI server
│   ├── app.py             # Main server entry point
│   ├── routers/
│   │   ├── market.py      # Market data endpoints
│   │   ├── portfolio.py   # Portfolio management
│   │   ├── orders.py      # Order execution engine
│   │   └── history.py     # Trade history
│   ├── services/
│   │   ├── data_feed.py   # Real-time data aggregator
│   │   ├── forex.py       # Forex data service
│   │   ├── bonds.py       # Bond yield service
│   │   ├── commodities.py # Commodities service
│   │   └── crypto.py      # Crypto service
│   ├── models/
│   │   ├── portfolio.py   # Portfolio data model
│   │   └── order.py       # Order data model
│   ├── db/
│   │   └── database.py    # SQLite local database
│   └── requirements.txt
│
├── frontend/              # React + Vite app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # Main trading dashboard
│   │   │   ├── Markets.jsx        # Market browser
│   │   │   ├── Portfolio.jsx      # Holdings & P&L
│   │   │   ├── OrderBook.jsx      # Order book & history
│   │   │   └── Research.jsx       # Charting & analysis
│   │   ├── components/
│   │   │   ├── PriceChart.jsx     # Candlestick/line chart
│   │   │   ├── OrderPanel.jsx     # Buy/sell panel
│   │   │   ├── Ticker.jsx         # Live price ticker
│   │   │   ├── PortfolioCard.jsx  # Portfolio summary
│   │   │   └── MarketTable.jsx    # Market data table
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js    # Live price feed hook
│   │   │   └── usePortfolio.js    # Portfolio state hook
│   │   └── store/
│   │       └── tradingStore.js    # Zustand global state
│   └── package.json
│
├── .env.example
├── package.json           # Root scripts
└── README.md
```

---

## ⚙️ Features

### Trading
- **Market Orders** — execute instantly at current price
- **Limit Orders** — set a target price (executed when price is hit)
- **Stop-Loss** — automatic sell to cap losses
- **Short Selling** — bet on price declines
- **Leverage** — configurable 1x–10x (with margin simulation)

### Portfolio
- **Virtual starting balance** — default HK$780,000 (≈ US$100,000)
- **Real-time P&L** — live mark-to-market on all positions
- **Multi-currency accounting** — auto-converts to base currency
- **Performance analytics** — Sharpe ratio, win rate, drawdown

### Market Data
- **Live prices** via WebSocket push (1s refresh)
- **Historical OHLCV** — up to 20 years of daily data
- **Candlestick charts** — with volume, MA, RSI, MACD overlays
- **Global search** — find any ticker across all markets

### Practice Tools
- **Paper trading** — zero real money, real market conditions
- **Trade journal** — auto-logs every trade with P&L
- **Scenario mode** — replay historical market events (2008 crash, COVID, etc.)

---

## 📊 Supported Instruments

### Stocks — Sample Tickers

| Market | Examples |
|--------|---------|
| US (NYSE/NASDAQ) | AAPL, TSLA, NVDA, AMZN, JPM, GS |
| Hong Kong (HKEX) | 0700.HK, 0005.HK, 9988.HK, 2318.HK |
| China (SSE/SZSE) | 600519.SS, 000858.SZ, 601318.SS |
| Japan (TSE) | 7203.T, 6758.T, 9984.T |
| UK (LSE) | SHEL.L, HSBA.L, BP.L, AZN.L |
| Europe | ASML.AS, LVMH.PA, SAP.DE, NESN.SW |
| India (NSE) | RELIANCE.NS, TCS.NS, INFY.NS |
| Australia (ASX) | BHP.AX, CBA.AX, WBC.AX |

### Forex Pairs
- **Majors**: EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD
- **HKD pairs**: USD/HKD, EUR/HKD, GBP/HKD, JPY/HKD, CNH/HKD
- **Exotics**: USD/SGD, USD/THB, USD/INR, USD/ZAR, and 150+ more

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, WebSocket |
| Data | yfinance, Alpha Vantage API, FRED API |
| Database | SQLite (local, no setup needed) |
| Frontend | React 18, Vite, Zustand |
| Charts | Lightweight Charts (TradingView) |
| Styling | Tailwind CSS |

---

## 📝 License

MIT — free to use, fork, and modify.

---

## ⚠️ Disclaimer

TradeArena is a **simulation tool for education only**. No real money is involved. Past simulated performance does not reflect real trading outcomes.
