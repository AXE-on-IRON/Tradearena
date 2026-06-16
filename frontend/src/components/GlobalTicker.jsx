import { useTradingStore } from '../store/tradingStore'

const TICKER_SYMBOLS = [
  { symbol: '^GSPC',    label: 'S&P 500' },
  { symbol: '^HSI',     label: 'Hang Seng' },
  { symbol: '^N225',    label: 'Nikkei' },
  { symbol: '^FTSE',    label: 'FTSE 100' },
  { symbol: 'AAPL',     label: 'AAPL' },
  { symbol: 'TSLA',     label: 'TSLA' },
  { symbol: 'EURUSD=X', label: 'EUR/USD' },
  { symbol: 'USDJPY=X', label: 'USD/JPY' },
  { symbol: 'USDHKD=X', label: 'USD/HKD' },
  { symbol: 'GC=F',     label: 'Gold' },
  { symbol: 'CL=F',     label: 'WTI Oil' },
  { symbol: 'BTC-USD',  label: 'Bitcoin' },
  { symbol: 'ETH-USD',  label: 'Ethereum' },
]

export default function GlobalTicker() {
  const prices = useTradingStore(s => s.prices)

  // Duplicate for seamless scroll
  const items = [...TICKER_SYMBOLS, ...TICKER_SYMBOLS]

  return (
    <div className="bg-panel border-b border-border overflow-hidden h-9 flex items-center">
      <div
        className="flex gap-6 whitespace-nowrap"
        style={{ animation: 'marquee 60s linear infinite' }}
      >
        {items.map((item, i) => {
          const d = prices[item.symbol]
          const price = d?.price
          const pct = d?.change_pct ?? 0
          return (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs font-mono">
              <span className="text-muted">{item.label}</span>
              <span className="text-text">
                {price != null ? price.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '…'}
              </span>
              {price != null && (
                <span className={pct >= 0 ? 'up' : 'down'}>
                  {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                </span>
              )}
            </span>
          )
        })}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
