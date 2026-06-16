import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { useTradingStore } from '../store/tradingStore'
import MarketTable from '../components/MarketTable'
import PriceChart from '../components/PriceChart'
import OrderPanel from '../components/OrderPanel'
import GlobalTicker from '../components/GlobalTicker'
import { Search, RefreshCw } from 'lucide-react'

const TABS = [
  { id: 'stocks',      label: '📊 Stocks',      endpoint: null },
  { id: 'forex',       label: '💱 Forex',        endpoint: '/api/market/forex' },
  { id: 'commodities', label: '🛢  Commodities',  endpoint: '/api/market/commodities' },
  { id: 'bonds',       label: '🏦 Bonds',        endpoint: '/api/market/bonds' },
  { id: 'crypto',      label: '🪙 Crypto',       endpoint: '/api/market/crypto' },
]

// Popular stock lists by region
const STOCK_LISTS = {
  'US':    ['AAPL','MSFT','NVDA','AMZN','META','GOOGL','TSLA','JPM','GS','BRK-B','V','WMT','JNJ','UNH','XOM'],
  'HK':    ['0700.HK','0005.HK','9988.HK','2318.HK','0941.HK','1299.HK','0388.HK','2020.HK','1810.HK','9999.HK'],
  'Japan': ['7203.T','6758.T','9984.T','8306.T','6861.T','4519.T','9432.T','7974.T','6501.T','8035.T'],
  'UK':    ['SHEL.L','HSBA.L','BP.L','AZN.L','ULVR.L','GSK.L','RIO.L','BATS.L','BHP.L','LSEG.L'],
  'EU':    ['ASML.AS','LVMH.PA','SAP.DE','NESN.SW','NOVO-B.CO','MC.PA','SIE.DE','AIR.PA','SHELL.AS','BNP.PA'],
  'India': ['RELIANCE.NS','TCS.NS','INFY.NS','HDFCBANK.NS','ICICIBANK.NS','BHARTIARTL.NS','ITC.NS','LT.NS'],
  'China': ['600519.SS','000858.SZ','601318.SS','000333.SZ','600036.SS','601888.SS','000002.SZ'],
  'Aus':   ['BHP.AX','CBA.AX','WBC.AX','NAB.AX','ANZ.AX','RIO.AX','CSL.AX','WDS.AX'],
}

export default function Markets() {
  const [activeTab, setActiveTab]       = useState('stocks')
  const [stockRegion, setStockRegion]   = useState('US')
  const [data, setData]                 = useState([])
  const [loading, setLoading]           = useState(false)
  const [searchQ, setSearchQ]           = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]       = useState(false)
  const { selectedSymbol, selectInstrument } = useTradingStore()

  const loadData = useCallback(async () => {
    setLoading(true)
    setData([])
    try {
      const tab = TABS.find(t => t.id === activeTab)
      if (activeTab === 'stocks') {
        const symbols = STOCK_LISTS[stockRegion] || []
        const quotes = await Promise.all(
          symbols.map(s => axios.get(`/api/market/quote/${s}`).then(r => r.data).catch(() => null))
        )
        setData(quotes.filter(Boolean).filter(q => q.price != null))
      } else if (tab?.endpoint) {
        const { data: d } = await axios.get(tab.endpoint)
        setData(d)
      }
    } finally {
      setLoading(false)
    }
  }, [activeTab, stockRegion])

  useEffect(() => { loadData() }, [loadData])

  const handleSearch = async (q) => {
    setSearchQ(q)
    if (!q || q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const { data: results } = await axios.get(`/api/market/search?q=${encodeURIComponent(q)}`)
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }

  const handleSelectResult = (r) => {
    selectInstrument(r.symbol, r.name || r.symbol, 'stock', r.currency || 'USD', r.region || '')
    setSearchQ('')
    setSearchResults([])
  }

  const assetClassMap = {
    stocks: 'stock', forex: 'forex', commodities: 'commodity', bonds: 'bond', crypto: 'crypto'
  }

  return (
    <div className="flex flex-col h-full">
      <GlobalTicker />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-panel">
          <h1 className="text-text font-semibold text-base">Markets</h1>

          {/* Global search */}
          <div className="relative ml-auto w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={searchQ}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search any symbol…"
              className="w-full bg-surface border border-border rounded-md pl-8 pr-3 py-1.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
            />
            {/* Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-panel border border-border rounded-md shadow-xl z-50 max-h-64 overflow-auto">
                {searchResults.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectResult(r)}
                    className="px-3 py-2 hover:bg-border/50 cursor-pointer"
                  >
                    <div className="font-mono text-accent text-sm">{r.symbol}</div>
                    <div className="text-muted text-xs">{r.name} · {r.type} · {r.region}</div>
                  </div>
                ))}
              </div>
            )}
            {searching && (
              <div className="absolute top-full mt-1 w-full bg-panel border border-border rounded-md px-3 py-2 text-muted text-xs">
                Searching…
              </div>
            )}
          </div>

          <button onClick={loadData} className="btn-ghost flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Asset class tabs */}
        <div className="flex gap-0 border-b border-border bg-panel px-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Stock region sub-tabs */}
        {activeTab === 'stocks' && (
          <div className="flex gap-1 px-4 py-2 border-b border-border bg-surface overflow-x-auto">
            {Object.keys(STOCK_LISTS).map(region => (
              <button
                key={region}
                onClick={() => setStockRegion(region)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  stockRegion === region
                    ? 'bg-accent text-surface'
                    : 'text-muted hover:text-text hover:bg-border/50'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        )}

        {/* Main content: table + chart+order */}
        <div className="flex flex-1 overflow-hidden">
          {/* Market table */}
          <div className="w-[420px] flex-shrink-0 border-r border-border overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted text-sm animate-pulse">
                Loading {activeTab}…
              </div>
            ) : (
              <MarketTable
                data={data}
                assetClass={assetClassMap[activeTab]}
              />
            )}
          </div>

          {/* Chart + order panel */}
          <div className="flex-1 flex gap-0 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-border text-sm font-semibold text-text flex items-center gap-2">
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                {selectedSymbol}
              </div>
              <div className="flex-1 min-h-0">
                <PriceChart symbol={selectedSymbol} />
              </div>
            </div>
            <div className="w-[280px] border-l border-border overflow-auto p-3">
              <OrderPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
