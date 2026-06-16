import { useEffect, useState } from 'react'
import axios from 'axios'
import { useTradingStore } from '../store/tradingStore'
import PriceChart from '../components/PriceChart'
import OrderPanel from '../components/OrderPanel'
import GlobalTicker from '../components/GlobalTicker'
import { usd, pct, colorClass, compact } from '../utils/format'
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react'

function IndexCard({ item }) {
  const live = useTradingStore(s => s.prices[item.symbol])
  const price = live?.price ?? item.price
  const chPct = live?.change_pct ?? item.change_pct ?? 0
  return (
    <div className="card px-4 py-3">
      <div className="text-muted text-xs mb-1 truncate">{item.name}</div>
      <div className="font-mono font-semibold text-text text-base">
        {price != null ? price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '…'}
      </div>
      <div className={`text-xs font-mono ${colorClass(chPct)}`}>{pct(chPct)}</div>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-text' }) {
  return (
    <div className="card px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-md bg-surface ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-muted text-xs">{label}</div>
        <div className={`font-mono font-semibold text-base ${color}`}>{value}</div>
        {sub && <div className="text-muted text-xs">{sub}</div>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { selectedSymbol, performance, fetchPerformance } = useTradingStore()
  const [indices, setIndices] = useState([])
  const [loadingIndices, setLoadingIndices] = useState(true)

  useEffect(() => {
    fetchPerformance()
    axios.get('/api/market/indices')
      .then(r => setIndices(r.data))
      .finally(() => setLoadingIndices(false))
  }, [])

  const perf = performance
  const pnlColor = colorClass(perf?.total_pnl ?? 0)

  return (
    <div className="flex flex-col h-full">
      <GlobalTicker />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Portfolio stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Equity"
            value={usd(perf?.total_equity)}
            icon={DollarSign}
            color="text-accent"
          />
          <StatCard
            label="Cash Balance"
            value={usd(perf?.cash_balance)}
            sub="Available to trade"
            icon={DollarSign}
            color="text-text"
          />
          <StatCard
            label="Unrealized P&L"
            value={usd(perf?.unrealized_pnl)}
            sub={pct(perf?.unrealized_pnl != null && perf?.total_cost ? (perf.unrealized_pnl / perf.total_cost) * 100 : null)}
            icon={perf?.unrealized_pnl >= 0 ? TrendingUp : TrendingDown}
            color={colorClass(perf?.unrealized_pnl ?? 0)}
          />
          <StatCard
            label="Realized P&L"
            value={usd(perf?.realized_pnl)}
            sub="Closed trades"
            icon={Activity}
            color={colorClass(perf?.realized_pnl ?? 0)}
          />
        </div>

        {/* Global indices */}
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-wider mb-2">
            Global Indices
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {loadingIndices
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="card px-4 py-3 animate-pulse">
                    <div className="h-3 bg-border rounded w-3/4 mb-2" />
                    <div className="h-5 bg-border rounded w-1/2" />
                  </div>
                ))
              : indices.map(idx => <IndexCard key={idx.symbol} item={idx} />)
            }
          </div>
        </div>

        {/* Chart + Order panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4" style={{ minHeight: '460px' }}>
          <div className="card overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-border text-sm font-semibold text-text flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              {selectedSymbol} — Live Chart
            </div>
            <div className="flex-1 min-h-0">
              <PriceChart symbol={selectedSymbol} />
            </div>
          </div>
          <OrderPanel />
        </div>

        {/* Open positions mini table */}
        {perf?.positions?.length > 0 && (
          <div className="card">
            <div className="px-4 py-3 border-b border-border text-sm font-semibold text-text">
              Open Positions ({perf.positions.length})
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="px-4 py-2 text-left">Symbol</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Avg Cost</th>
                    <th className="px-4 py-2 text-right">Current</th>
                    <th className="px-4 py-2 text-right">Market Value</th>
                    <th className="px-4 py-2 text-right">P&L</th>
                    <th className="px-4 py-2 text-right">P&L %</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.positions.map(p => (
                    <tr key={p.symbol} className="border-b border-border/40 hover:bg-border/20">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-accent font-semibold">{p.symbol}</span>
                        <div className="text-muted text-xs">{p.asset_class}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{p.quantity.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{usd(p.avg_cost, 4)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{usd(p.current_price, 4)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{usd(p.market_value)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold ${colorClass(p.unrealized_pnl)}`}>
                        {usd(p.unrealized_pnl)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono ${colorClass(p.unrealized_pnl_pct)}`}>
                        {pct(p.unrealized_pnl_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
