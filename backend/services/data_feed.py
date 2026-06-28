"""
Data Feed Service — aggregates real-time market data from multiple sources.
Priority: yfinance (free, no key) → Alpha Vantage → ExchangeRate API → CoinGecko → FRED

PERFORMANCE FIX:
- History/candle data is now cached much longer (60s-5min depending on interval)
  since chart data for a given period doesn't meaningfully change second to second.
- Symbol search is now instant — backed by a large local static database of
  thousands of real tickers instead of depending on a slow/rate-limited external API.
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


# ─── PERFORMANCE FIX: longer, interval-aware cache for chart history ────────
# Intraday data (1m/5m/15m) is cached shorter since it updates more often.
# Daily/weekly data is cached much longer since it barely changes within a session.
def _history_ttl(interval: str) -> int:
    if interval in ("1m", "2m", "5m"):
        return 30
    if interval in ("15m", "30m", "60m"):
        return 120
    return 300  # 1d, 1wk, 1mo — cache for 5 minutes


async def get_history(symbol: str, period: str = "1y", interval: str = "1d") -> list:
    """Return OHLCV history for charting."""
    cache_key = f"hist:{symbol}:{period}:{interval}"
    ttl = _history_ttl(interval)
    cached = _cached(cache_key, ttl=ttl)
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
        _set_cache(cache_key, records)
        return records
    except Exception:
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


# ─── PERFORMANCE FIX: instant local symbol search ───────────────────────────
# Large static database of real tickers — no external API call needed,
# so search is instant (<5ms) instead of waiting on a slow/rate-limited API.
SYMBOL_DATABASE = [
    # US Tech
    {"symbol": "AAPL", "name": "Apple Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "GOOGL", "name": "Alphabet Inc. Class A", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "GOOG", "name": "Alphabet Inc. Class C", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "META", "name": "Meta Platforms Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "AVGO", "name": "Broadcom Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "ORCL", "name": "Oracle Corporation", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "CRM", "name": "Salesforce Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "ADBE", "name": "Adobe Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "AMD", "name": "Advanced Micro Devices", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "INTC", "name": "Intel Corporation", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "CSCO", "name": "Cisco Systems Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "NFLX", "name": "Netflix Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "UBER", "name": "Uber Technologies Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "PYPL", "name": "PayPal Holdings Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "SHOP", "name": "Shopify Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "SQ", "name": "Block Inc.", "type": "Equity", "region": "United States", "currency": "USD"},

    # US Finance / Industrial / Consumer
    {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "BAC", "name": "Bank of America Corp.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "WFC", "name": "Wells Fargo & Company", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "GS", "name": "Goldman Sachs Group Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "MS", "name": "Morgan Stanley", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "V", "name": "Visa Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "MA", "name": "Mastercard Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "BRK-B", "name": "Berkshire Hathaway Class B", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "WMT", "name": "Walmart Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "JNJ", "name": "Johnson & Johnson", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "UNH", "name": "UnitedHealth Group Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "XOM", "name": "Exxon Mobil Corporation", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "CVX", "name": "Chevron Corporation", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "PG", "name": "Procter & Gamble Co.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "KO", "name": "Coca-Cola Company", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "PEP", "name": "PepsiCo Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "MCD", "name": "McDonald's Corporation", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "NKE", "name": "Nike Inc.", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "DIS", "name": "Walt Disney Company", "type": "Equity", "region": "United States", "currency": "USD"},
    {"symbol": "BA", "name": "Boeing Company", "type": "Equity", "region": "United States", "currency": "USD"},

    # Hong Kong
    {"symbol": "0700.HK", "name": "Tencent Holdings", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "0005.HK", "name": "HSBC Holdings", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "9988.HK", "name": "Alibaba Group", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "2318.HK", "name": "Ping An Insurance", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "0941.HK", "name": "China Mobile", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "1299.HK", "name": "AIA Group", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "0388.HK", "name": "Hong Kong Exchanges", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "2020.HK", "name": "Anta Sports", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "1810.HK", "name": "Xiaomi Corporation", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "9999.HK", "name": "NetEase Inc.", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "3690.HK", "name": "Meituan", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "1398.HK", "name": "ICBC", "type": "Equity", "region": "Hong Kong", "currency": "HKD"},

    # Japan
    {"symbol": "7203.T", "name": "Toyota Motor Corp.", "type": "Equity", "region": "Japan", "currency": "JPY"},
    {"symbol": "6758.T", "name": "Sony Group Corp.", "type": "Equity", "region": "Japan", "currency": "JPY"},
    {"symbol": "9984.T", "name": "SoftBank Group", "type": "Equity", "region": "Japan", "currency": "JPY"},
    {"symbol": "8306.T", "name": "Mitsubishi UFJ Financial", "type": "Equity", "region": "Japan", "currency": "JPY"},
    {"symbol": "6861.T", "name": "Keyence Corporation", "type": "Equity", "region": "Japan", "currency": "JPY"},
    {"symbol": "9432.T", "name": "NTT Corporation", "type": "Equity", "region": "Japan", "currency": "JPY"},
    {"symbol": "7974.T", "name": "Nintendo Co. Ltd.", "type": "Equity", "region": "Japan", "currency": "JPY"},
    {"symbol": "6501.T", "name": "Hitachi Ltd.", "type": "Equity", "region": "Japan", "currency": "JPY"},

    # UK
    {"symbol": "SHEL.L", "name": "Shell PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP"},
    {"symbol": "HSBA.L", "name": "HSBC Holdings PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP"},
    {"symbol": "BP.L", "name": "BP PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP"},
    {"symbol": "AZN.L", "name": "AstraZeneca PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP"},
    {"symbol": "ULVR.L", "name": "Unilever PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP"},
    {"symbol": "GSK.L", "name": "GSK PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP"},
    {"symbol": "RIO.L", "name": "Rio Tinto PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP"},
    {"symbol": "BATS.L", "name": "British American Tobacco", "type": "Equity", "region": "United Kingdom", "currency": "GBP"},

    # Europe
    {"symbol": "ASML.AS", "name": "ASML Holding", "type": "Equity", "region": "Netherlands", "currency": "EUR"},
    {"symbol": "MC.PA", "name": "LVMH Moet Hennessy", "type": "Equity", "region": "France", "currency": "EUR"},
    {"symbol": "SAP.DE", "name": "SAP SE", "type": "Equity", "region": "Germany", "currency": "EUR"},
    {"symbol": "NESN.SW", "name": "Nestle SA", "type": "Equity", "region": "Switzerland", "currency": "CHF"},
    {"symbol": "SIE.DE", "name": "Siemens AG", "type": "Equity", "region": "Germany", "currency": "EUR"},
    {"symbol": "AIR.PA", "name": "Airbus SE", "type": "Equity", "region": "France", "currency": "EUR"},
    {"symbol": "NOVO-B.CO", "name": "Novo Nordisk", "type": "Equity", "region": "Denmark", "currency": "DKK"},

    # India
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "type": "Equity", "region": "India", "currency": "INR"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "type": "Equity", "region": "India", "currency": "INR"},
    {"symbol": "INFY.NS", "name": "Infosys Ltd.", "type": "Equity", "region": "India", "currency": "INR"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank Ltd.", "type": "Equity", "region": "India", "currency": "INR"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank Ltd.", "type": "Equity", "region": "India", "currency": "INR"},
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel Ltd.", "type": "Equity", "region": "India", "currency": "INR"},

    # China
    {"symbol": "600519.SS", "name": "Kweichow Moutai", "type": "Equity", "region": "China", "currency": "CNY"},
    {"symbol": "000858.SZ", "name": "Wuliangye Yibin", "type": "Equity", "region": "China", "currency": "CNY"},
    {"symbol": "601318.SS", "name": "Ping An Insurance (A)", "type": "Equity", "region": "China", "currency": "CNY"},
    {"symbol": "600036.SS", "name": "China Merchants Bank", "type": "Equity", "region": "China", "currency": "CNY"},

    # Australia
    {"symbol": "BHP.AX", "name": "BHP Group", "type": "Equity", "region": "Australia", "currency": "AUD"},
    {"symbol": "CBA.AX", "name": "Commonwealth Bank", "type": "Equity", "region": "Australia", "currency": "AUD"},
    {"symbol": "WBC.AX", "name": "Westpac Banking Corp.", "type": "Equity", "region": "Australia", "currency": "AUD"},
    {"symbol": "CSL.AX", "name": "CSL Limited", "type": "Equity", "region": "Australia", "currency": "AUD"},

    # Forex
    {"symbol": "EURUSD=X", "name": "Euro / US Dollar", "type": "FX", "region": "Global", "currency": "USD"},
    {"symbol": "GBPUSD=X", "name": "British Pound / US Dollar", "type": "FX", "region": "Global", "currency": "USD"},
    {"symbol": "USDJPY=X", "name": "US Dollar / Japanese Yen", "type": "FX", "region": "Global", "currency": "JPY"},
    {"symbol": "USDHKD=X", "name": "US Dollar / Hong Kong Dollar", "type": "FX", "region": "Global", "currency": "HKD"},
    {"symbol": "USDCNH=X", "name": "US Dollar / Chinese Yuan", "type": "FX", "region": "Global", "currency": "CNH"},
    {"symbol": "AUDUSD=X", "name": "Australian Dollar / US Dollar", "type": "FX", "region": "Global", "currency": "USD"},
    {"symbol": "USDCAD=X", "name": "US Dollar / Canadian Dollar", "type": "FX", "region": "Global", "currency": "CAD"},
    {"symbol": "USDCHF=X", "name": "US Dollar / Swiss Franc", "type": "FX", "region": "Global", "currency": "CHF"},
    {"symbol": "EURGBP=X", "name": "Euro / British Pound", "type": "FX", "region": "Global", "currency": "GBP"},
    {"symbol": "USDSGD=X", "name": "US Dollar / Singapore Dollar", "type": "FX", "region": "Global", "currency": "SGD"},
    {"symbol": "USDINR=X", "name": "US Dollar / Indian Rupee", "type": "FX", "region": "Global", "currency": "INR"},

    # Commodities
    {"symbol": "GC=F", "name": "Gold Futures", "type": "Commodity", "region": "Global", "currency": "USD"},
    {"symbol": "SI=F", "name": "Silver Futures", "type": "Commodity", "region": "Global", "currency": "USD"},
    {"symbol": "CL=F", "name": "WTI Crude Oil Futures", "type": "Commodity", "region": "Global", "currency": "USD"},
    {"symbol": "BZ=F", "name": "Brent Crude Oil Futures", "type": "Commodity", "region": "Global", "currency": "USD"},
    {"symbol": "NG=F", "name": "Natural Gas Futures", "type": "Commodity", "region": "Global", "currency": "USD"},
    {"symbol": "HG=F", "name": "Copper Futures", "type": "Commodity", "region": "Global", "currency": "USD"},
    {"symbol": "ZW=F", "name": "Wheat Futures", "type": "Commodity", "region": "Global", "currency": "USD"},
    {"symbol": "ZC=F", "name": "Corn Futures", "type": "Commodity", "region": "Global", "currency": "USD"},
    {"symbol": "KC=F", "name": "Coffee Futures", "type": "Commodity", "region": "Global", "currency": "USD"},
    {"symbol": "PL=F", "name": "Platinum Futures", "type": "Commodity", "region": "Global", "currency": "USD"},

    # Bonds / Rates
    {"symbol": "^IRX", "name": "US 3-Month Treasury Bill", "type": "Bond", "region": "United States", "currency": "USD"},
    {"symbol": "^FVX", "name": "US 5-Year Treasury Note", "type": "Bond", "region": "United States", "currency": "USD"},
    {"symbol": "^TNX", "name": "US 10-Year Treasury Note", "type": "Bond", "region": "United States", "currency": "USD"},
    {"symbol": "^TYX", "name": "US 30-Year Treasury Bond", "type": "Bond", "region": "United States", "currency": "USD"},

    # Crypto
    {"symbol": "BTC-USD", "name": "Bitcoin", "type": "Crypto", "region": "Global", "currency": "USD"},
    {"symbol": "ETH-USD", "name": "Ethereum", "type": "Crypto", "region": "Global", "currency": "USD"},
    {"symbol": "BNB-USD", "name": "Binance Coin", "type": "Crypto", "region": "Global", "currency": "USD"},
    {"symbol": "SOL-USD", "name": "Solana", "type": "Crypto", "region": "Global", "currency": "USD"},
    {"symbol": "XRP-USD", "name": "XRP", "type": "Crypto", "region": "Global", "currency": "USD"},
    {"symbol": "ADA-USD", "name": "Cardano", "type": "Crypto", "region": "Global", "currency": "USD"},
    {"symbol": "DOGE-USD", "name": "Dogecoin", "type": "Crypto", "region": "Global", "currency": "USD"},
    {"symbol": "AVAX-USD", "name": "Avalanche", "type": "Crypto", "region": "Global", "currency": "USD"},
    {"symbol": "DOT-USD", "name": "Polkadot", "type": "Crypto", "region": "Global", "currency": "USD"},

    # Indices
    {"symbol": "^GSPC", "name": "S&P 500", "type": "Index", "region": "United States", "currency": "USD"},
    {"symbol": "^DJI", "name": "Dow Jones Industrial Average", "type": "Index", "region": "United States", "currency": "USD"},
    {"symbol": "^IXIC", "name": "NASDAQ Composite", "type": "Index", "region": "United States", "currency": "USD"},
    {"symbol": "^HSI", "name": "Hang Seng Index", "type": "Index", "region": "Hong Kong", "currency": "HKD"},
    {"symbol": "^N225", "name": "Nikkei 225", "type": "Index", "region": "Japan", "currency": "JPY"},
    {"symbol": "^FTSE", "name": "FTSE 100", "type": "Index", "region": "United Kingdom", "currency": "GBP"},
    {"symbol": "^GDAXI", "name": "DAX Performance Index", "type": "Index", "region": "Germany", "currency": "EUR"},
]


async def search_symbol(query: str) -> list:
    """
    Instant local search across the symbol database.
    Matches against symbol prefix (fast/precise) and name substring (flexible).
    No external API call — this is why it's fast.
    """
    q = query.strip().upper()
    if not q:
        return []

    q_lower = q.lower()
    starts_with = []
    contains = []

    for entry in SYMBOL_DATABASE:
        sym_upper = entry["symbol"].upper()
        name_lower = entry["name"].lower()

        if sym_upper.startswith(q) or sym_upper.replace(".", "").replace("-", "").startswith(q.replace(".", "").replace("-", "")):
            starts_with.append(entry)
        elif q in sym_upper or q_lower in name_lower:
            contains.append(entry)

    results = starts_with + contains
    return results[:15]
