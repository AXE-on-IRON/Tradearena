import { useState, useRef } from 'react'
import axios from 'axios'
import { useTradingStore } from '../store/tradingStore'
import PriceChart from '../components/PriceChart'
import OrderPanel from '../components/OrderPanel'
import { Search, BarChart2 } from 'lucide-react'
import { usd, pct, colorClass } from '../utils/format'

const QUICK_PICKS = [
  { symbol: 'AAPL',     label: 'Apple',     class: 'stock' },
  { symbol: 'TSLA',     label: 'Tesla',     class: 'stock' },
  { symbol: 'NVDA',     label: 'NVIDIA',    class: 'stock' },
  { symbol: '0700.HK',  label: 'Tencent',   class: 'stock' },
  { symbol: 'EURUSD=X', label: 'EUR/USD',   class: 'forex' },
  { symbol: 'USDJPY=X', label: 'USD/JPY',   class: 'forex' },
  { symbol: 'USDHKD=X', label: 'USD/HKD',   class: 'forex' },
  { symbol: 'GC=F',     label: 'Gold',      class: 'commodity' },
  { symbol: 'CL=F',     label: 'WTI Oil',   class: 'commodity' },
  { symbol: 'BTC-USD',  label: 'Bitcoin',   class: 'crypto' },
  { symbol: 'ETH-USD',  label: 'Ethereum',  class: 'crypto' },
  { symbol: '^TNX',     label: 'US 10Y',    class: 'bond' },
]

export default function Research() {
  const { selectedSymbol, selectInstrument, prices } = useTradingStore()
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [quoteInfo, setQuoteInfo] = useState(null)
  const [loadingQuote, setLoadingQuote] = useState(false)

  // FIX: debounce ref so search doesn't fire on every keystroke
  const debounceRef = useRef(null)

  const livePrice = prices[selectedSymbol]

  const handleSearch = (q) => {
    setSearchQ(q)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!q || q.length < 1) {
      setSearchResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`/api/market/search?q=${encodeURIComponent(q)}`)
        setSearchResults(data)
      } finally {
        setSearching(false)
      }
    }, 250)
  }

  const handleSelect = async (symbol, name, assetClass, currency, exchange) => {
    selectInstrument(symbol, name, assetClass, currency, exchange)
    setSearchQ('')
    setSearchResults([])
    setLoadingQuote(true)
    try {
      const { data } = await axios.get(`/api/market/quote/${symbol}`)
      setQuoteInfo(data)
    } finally {
      setLoadingQuote(false)
    }
  }

  const handleQuickPick = (item) => {
    handleSelect(item.symbol, item.label, item.class, 'USD', '')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-panel flex items-center gap-4">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-accent" />
          <span className="text-text font-semibold">Research</span>
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchQ}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search any symbol worldwide…"
            className="w-full bg-surface border border-border rounded-md pl-8 pr-3 py-1.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
          />
          {(searchResults.length > 0 || searching) && (
            <div className="absolute top-full mt-1 w-full bg-panel border border-border rounded-md shadow-xl z-50 max-h-72 overflow-auto">
              {searching && searchResults.length === 0 && (
                <div className="px-3 py-2 text-muted text-xs">Searching…</div>
              )}
              {searchResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => handleSelect(r.symbol, r.name || r.symbol, 'stock', r.currency || 'USD', r.region || '')}
                  className="px-3 py-2.5 hover:bg-border/50 cursor-pointer border-b border-border/40"
                >
                  <div className="font-mono text-accent text-sm font-semibold">{r.symbol}</div>
                  <div className="text-muted text-xs">{r.name} · {r.type} · {r.region}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current symbol info */}
        {livePrice && (
          <div className="flex items-center gap-4 ml-2">
            <div>
              <span className="font-mono text-accent font-semibold text-lg">{selectedSymbol}</span>
            </div>
            <div>
              <div className="font-mono font-semibold text-text text-lg">
                {livePrice.price != null ? `$${livePrice.price.toLocaleString('en-US', { maximumFractionDigits: 5 })}` : '—'}
              </div>
            </div>
            <div className={`font-mono text-sm font-semibold ${colorClass(livePrice.change_pct ?? 0)}`}>
              {(livePrice.change_pct ?? 0) >= 0 ? '+' : ''}{(livePrice.change_pct ?? 0).toFixed(2)}%
            </div>
            {livePrice.change != null && (
              <div className={`font-mono text-sm ${colorClass(livePrice.change)}`}>
                ({livePrice.change >= 0 ? '+' : ''}{livePrice.change.toFixed(4)})
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick picks */}
      <div className="flex gap-1.5 px-4 py-2 border-b border-border bg-surface overflow-x-auto flex-shrink-0">
        {QUICK_PICKS.map(item => (
          <button
            key={item.symbol}
            onClick={() => handleQuickPick(item)}
            className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors ${
              selectedSymbol === item.symbol
                ? 'bg-accent text-surface font-semibold'
                : 'text-muted hover:text-text hover:bg-border/50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main layout: big chart + order panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart - takes most space */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0">
            <PriceChart symbol={selectedSymbol} />
          </div>

          {/* Quote details bar */}
          {quoteInfo && (
            <div className="border-t border-border px-4 py-2 flex gap-6 text-xs overflow-x-auto bg-panel flex-shrink-0">
              {[
                ['Exchange', quoteInfo.exchange],
                ['Currency', quoteInfo.currency],
                ['Market Cap', quoteInfo.market_cap
                  ? `$${(quoteInfo.market_cap / 1e9).toFixed(2)}B`
                  : '—'],
                ['Volume (3M Avg)', quoteInfo.volume
                  ? quoteInfo.volume.toLocaleString()
                  : '—'],
              ].map(([label, val]) => (
                <div key={label} className="whitespace-nowrap">
                  <span className="text-muted">{label}: </span>
                  <span className="text-text font-mono">{val || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order panel */}
        <div className="w-[280px] border-l border-border overflow-auto p-3 flex-shrink-0">
          <OrderPanel />
        </div>
      </div>
    </div>
  )
}
