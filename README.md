# 📈 TradeArena — Local Trading Simulation Platform

Practice trading **stocks, forex, commodities, bonds and crypto** with real live market data and $100,000 of virtual money. No real money. No risk. All real market conditions.

![License](https://img.shields.io/badge/license-MIT-green) ![Python](https://img.shields.io/badge/python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12-blue) ![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)

---

## 🌍 Markets Covered

| Asset Class | Coverage |
|-------------|---------|
| **Stocks** | NYSE, NASDAQ, HKEX, Tokyo, London, Frankfurt, India, China, Australia |
| **Forex** | 170+ pairs — majors, minors, exotics, HKD pairs |
| **Commodities** | Gold, Silver, WTI Oil, Brent, Natural Gas, Copper, Wheat, Coffee |
| **Bonds** | US Treasuries (3M / 5Y / 10Y / 30Y) |
| **Crypto** | Bitcoin, Ethereum, and top 20 coins |

---

## 🚀 Quick Start

### Requirements
- **Node.js** v16+ → [nodejs.org](https://nodejs.org)
- **Python** 3.9, 3.10, 3.11 or 3.12 → [python.org](https://python.org)
- ⚠️ Python 3.13 not yet supported by some dependencies — use 3.11 if possible

### 1. Clone
```bash
git clone https://github.com/AXE-on-IRON/tradearena.git
cd tradearena
```

### 2. Setup (one command)
```bash
./setup.sh
```
This installs all Python and Node dependencies automatically.

> **Windows users:** Run `setup.sh` in Git Bash, or follow the manual steps below.

### 3. Start
```bash
./start.sh
```

### 4. Open in browser
```
http://localhost:5173
```

---

## 🔑 API Keys (Optional)

The app works out of the box with **no API keys** using yfinance (free, no registration).

For extra data coverage, add free keys to your `.env` file:

| API | Provides | Free Tier | Sign Up |
|-----|---------|-----------|---------|
| Alpha Vantage | Stocks, Forex, Commodities | 25 req/day | [alphavantage.co](https://www.alphavantage.co/support/#api-key) |
| ExchangeRate API | 170+ live forex pairs | 1,500 req/mo | [exchangerate-api.com](https://www.exchangerate-api.com/) |
| FRED | US Treasury bond yields | Unlimited | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |
| CoinGecko | Crypto data | 30 req/min | [coingecko.com](https://www.coingecko.com/en/api) |

---

## ⚙️ Manual Setup (if scripts don't work)

```bash
# Backend
cd backend
pip install -r requirements.txt
python app.py          # runs on http://localhost:8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev            # runs on http://localhost:5173
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, WebSocket, SQLite |
| Data | yfinance, Alpha Vantage, FRED |
| Frontend | React 18, Vite, Zustand, Tailwind CSS |
| Charts | TradingView Lightweight Charts |

---

## ⚠️ Disclaimer

TradeArena is for **educational purposes only**. No real money is involved.

---

## 📝 License

MIT
