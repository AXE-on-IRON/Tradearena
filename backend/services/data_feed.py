"""
Data Feed Service — aggregates real-time market data from multiple sources.
Priority: yfinance (free, no key) → Alpha Vantage → ExchangeRate API → CoinGecko → FRED
"""
import asyncio
import os
import time
import httpx
import yfinance as yf
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
EXCHANGE_RATE_KEY = os.getenv("EXCHANGE_RATE_API_KEY", "")
FRED_KEY = os.getenv("FRED_API_KEY", "")
COINGECKO_KEY = os.getenv("COINGECKO_API_KEY", "")

# ─── Simple in-memory cache ──────────────────────────────────────────────────
_cache: dict = {}

def _cached(key: str, ttl: int = 10):
    """Return cached value if fresh, else None."""
    if key in _cache:
        val, ts = _cache[key]
        if time.time() - ts < ttl:
            return val
    return None

def _set_cache(key: str, val):
    _cache[key] = (val, time.time())


# ─── Stock / Equity quotes ───────────────────────────────────────────────────
async def get_quote(symbol: str) -> dict:
    """Fetch live quote for any ticker via yfinance."""
    cached = _cached(f"quote:{symbol}", ttl=5)
    if cached:
        return cached

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        hist = ticker.history(period="2d", interval="1m")
        if hist.empty:
            hist = ticker.history(period="5d")

        price = float(info.last_price) if hasattr(info, "last_price") and info.last_price else None
        if price is None and not hist.empty:
            price = float(hist["Close"].iloc[-1])

        prev_close = float(info.previous_close) if hasattr(info, "previous_close") and info.previous_close else None
        if prev_close is None and len(hist) >= 2:
            prev_close = float(hist["Close"].iloc[-2])

        change = price - prev_close if price and prev_close else 0
        change_pct = (change / prev_close * 100) if prev_close else 0

        result = {
            "symbol": symbol,
            "name": getattr(ticker.info, "longName", None) or ticker.info.get("shortName", symbol),
            "price": round(price, 4) if price else None,
            "change": round(change, 4),
            "change_pct": round(change_pct, 4),
            "volume": int(info.three_month_average_volume) if hasattr(info, "three_month_average_volume") and info.three_month_average_volume else None,
            "currency": ticker.info.get("currency", "USD"),
            "exchange": ticker.info.get("exchange", ""),
            "market_cap": ticker.info.get("marketCap"),
            "timestamp": datetime.utcnow().isoformat(),
        }
        _set_cache(f"quote:{symbol}", result)
        return result
    except Exception as e:
        return {"symbol": symbol, "error": str(e), "price": None}


async def get_history(symbol: str, period: str = "1y", interval: str = "1d") -> list:
    """Return OHLCV history for charting."""
    cached = _cached(f"hist:{symbol}:{period}:{interval}", ttl=60)
    if cached:
        return cached

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        df.reset_index(inplace=True)
        records = []
        for _, row in df.iterrows():
            dt = row["Datetime"] if "Datetime" in row else row["Date"]
            records.append({
                "time": int(dt.timestamp()) if hasattr(dt, "timestamp") else str(dt),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]) if row["Volume"] else 0,
            })
        _set_cache(f"hist:{symbol}:{period}:{interval}", records)
        return records
    except Exception as e:
        return []


# ─── Forex ───────────────────────────────────────────────────────────────────
MAJOR_FOREX_PAIRS = [
    "EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCHF=X", "AUDUSD=X",
    "USDCAD=X", "NZDUSD=X", "USDHKD=X", "USDCNH=X", "USDSGD=X",
    "USDINR=X", "USDTHB=X", "USDKRW=X", "USDBRL=X", "USDMXN=X",
    "USDZAR=X", "USDTRY=X", "EURGBP=X", "EURJPY=X", "GBPJPY=X",
]

async def get_forex_pairs(pairs: Optional[list] = None) -> list:
    """Fetch multiple forex pairs via yfinance."""
    symbols = pairs or MAJOR_FOREX_PAIRS
    cached = _cached("forex:all", ttl=5)
    if cached:
        return cached

    results = []
    for sym in symbols:
        try:
            ticker = yf.Ticker(sym)
            info = ticker.fast_info
            price = float(info.last_price) if hasattr(info, "last_price") and info.last_price else None
            prev = float(info.previous_close) if hasattr(info, "previous_close") and info.previous_close else None
            change = price - prev if price and prev else 0
            change_pct = (change / prev * 100) if prev else 0
            pair_name = sym.replace("=X", "")
            base = pair_name[:3]
            quote = pair_name[3:]
            results.append({
                "symbol": sym,
                "pair": f"{base}/{quote}",
                "base": base,
                "quote": quote,
                "price": round(price, 5) if price else None,
                "change": round(change, 5),
                "change_pct": round(change_pct, 4),
                "asset_class": "forex",
            })
        except Exception:
            continue

    _set_cache("forex:all", results)
    return results


# ─── Commodities ─────────────────────────────────────────────────────────────
COMMODITIES = {
    "GC=F":  "Gold (USD/oz)",
    "SI=F":  "Silver (USD/oz)",
    "CL=F":  "WTI Crude Oil (USD/bbl)",
    "BZ=F":  "Brent Crude (USD/bbl)",
    "NG=F":  "Natural Gas (USD/MMBtu)",
    "HG=F":  "Copper (USD/lb)",
    "ZW=F":  "Wheat (USD/bu)",
    "ZC=F":  "Corn (USD/bu)",
    "KC=F":  "Coffee (USD/lb)",
    "SB=F":  "Sugar (USD/lb)",
    "PL=F":  "Platinum (USD/oz)",
    "PA=F":  "Palladium (USD/oz)",
}

async def get_commodities() -> list:
    cached = _cached("commodities:all", ttl=10)
    if cached:
        return cached

    results = []
    for sym, name in COMMODITIES.items():
        try:
            ticker = yf.Ticker(sym)
            info = ticker.fast_info
            price = float(info.last_price) if hasattr(info, "last_price") and info.last_price else None
            prev = float(info.previous_close) if hasattr(info, "previous_close") and info.previous_close else None
            change = price - prev if price and prev else 0
            change_pct = (change / prev * 100) if prev else 0
            results.append({
                "symbol": sym,
                "name": name,
                "price": round(price, 3) if price else None,
                "change": round(change, 3),
                "change_pct": round(change_pct, 4),
                "currency": "USD",
                "asset_class": "commodity",
            })
        except Exception:
            continue

    _set_cache("commodities:all", results)
    return results


# ─── Bonds ───────────────────────────────────────────────────────────────────
BOND_TICKERS = {
    "^IRX":  "US 3-Month T-Bill",
    "^FVX":  "US 5-Year Treasury",
    "^TNX":  "US 10-Year Treasury",
    "^TYX":  "US 30-Year Treasury",
}

async def get_bonds() -> list:
    cached = _cached("bonds:all", ttl=60)
    if cached:
        return cached

    results = []
    for sym, name in BOND_TICKERS.items():
        try:
            ticker = yf.Ticker(sym)
            info = ticker.fast_info
            price = float(info.last_price) if hasattr(info, "last_price") and info.last_price else None
            prev = float(info.previous_close) if hasattr(info, "previous_close") and info.previous_close else None
            change = price - prev if price and prev else 0
            results.append({
                "symbol": sym,
                "name": name,
                "yield_pct": round(price / 10, 3) if price else None,
                "price": round(price, 3) if price else None,
                "change": round(change, 4),
                "asset_class": "bond",
            })
        except Exception:
            continue

    _set_cache("bonds:all", results)
    return results


# ─── Crypto ──────────────────────────────────────────────────────────────────
TOP_CRYPTO = [
    "BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD",
    "USDC-USD", "ADA-USD", "AVAX-USD", "DOGE-USD", "DOT-USD",
]

async def get_crypto() -> list:
    cached = _cached("crypto:all", ttl=10)
    if cached:
        return cached

    results = []
    for sym in TOP_CRYPTO:
        try:
            ticker = yf.Ticker(sym)
            info = ticker.fast_info
            price = float(info.last_price) if hasattr(info, "last_price") and info.last_price else None
            prev = float(info.previous_close) if hasattr(info, "previous_close") and info.previous_close else None
            change = price - prev if price and prev else 0
            change_pct = (change / prev * 100) if prev else 0
            results.append({
                "symbol": sym,
                "name": sym.replace("-USD", ""),
                "price": round(price, 4) if price else None,
                "change": round(change, 4),
                "change_pct": round(change_pct, 4),
                "currency": "USD",
                "asset_class": "crypto",
            })
        except Exception:
            continue

    _set_cache("crypto:all", results)
    return results


# ─── Global indices for dashboard ────────────────────────────────────────────
GLOBAL_INDICES = {
    "^GSPC":   "S&P 500",
    "^DJI":    "Dow Jones",
    "^IXIC":   "NASDAQ",
    "^HSI":    "Hang Seng",
    "^N225":   "Nikkei 225",
    "^FTSE":   "FTSE 100",
    "^GDAXI":  "DAX",
    "000001.SS": "Shanghai Composite",
    "^BSESN":  "BSE Sensex",
    "^AXJO":   "ASX 200",
    "^STOXX50E": "Euro Stoxx 50",
    "^KS11":   "KOSPI",
}

async def get_indices() -> list:
    cached = _cached("indices:all", ttl=10)
    if cached:
        return cached

    results = []
    for sym, name in GLOBAL_INDICES.items():
        try:
            ticker = yf.Ticker(sym)
            info = ticker.fast_info
            price = float(info.last_price) if hasattr(info, "last_price") and info.last_price else None
            prev = float(info.previous_close) if hasattr(info, "previous_close") and info.previous_close else None
            change = price - prev if price and prev else 0
            change_pct = (change / prev * 100) if prev else 0
            results.append({
                "symbol": sym,
                "name": name,
                "price": round(price, 2) if price else None,
                "change": round(change, 2),
                "change_pct": round(change_pct, 4),
                "asset_class": "index",
            })
        except Exception:
            continue

    _set_cache("indices:all", results)
    return results


# ─── Symbol search ───────────────────────────────────────────────────────────
async def search_symbol(query: str) -> list:
    """Use Alpha Vantage symbol search API."""
    if not ALPHA_VANTAGE_KEY or ALPHA_VANTAGE_KEY == "demo":
        # Fallback: search known lists
        results = []
        q = query.upper()
        for sym in list(COMMODITIES.keys()) + list(GLOBAL_INDICES.keys()) + TOP_CRYPTO:
            if q in sym:
                results.append({"symbol": sym, "name": sym})
        return results[:10]

    url = (
        f"https://www.alphavantage.co/query?function=SYMBOL_SEARCH"
        f"&keywords={query}&apikey={ALPHA_VANTAGE_KEY}"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
        data = resp.json()
    matches = data.get("bestMatches", [])
    return [
        {
            "symbol": m["1. symbol"],
            "name": m["2. name"],
            "type": m["3. type"],
            "region": m["4. region"],
            "currency": m["8. currency"],
        }
        for m in matches
    ]
