import { useEffect, useState } from 'react'
import { useTradingStore } from '../store/tradingStore'
import { usd, pct, colorClass, datetime } from '../utils/format'
import PriceChart from '../components/PriceChart'
import OrderPanel from '../components/OrderPanel'
import { TrendingUp, TrendingDown, Briefcase, DollarSign, BarChart2, Activity } from 'lucide-react'

function StatBox({ label, value, color = 'text-text', sub }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-muted text-xs mb-1">{label}</div>
      <div className={`font-mono font-semibold text-lg ${color}`}>{value}</div>
      {sub && <div className={`text-xs font-mono ${color}`}>{sub}</div>}
    </div>
  )
}

export default function Portfolio() {
  const { performance, fetchPerformance, selectedSymbol, selectInstrument } = useTradingStore()
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetchPerformance()
    const id = setInterval(fetchPerformance, 15000)
    return () => clearInterval(id)
  }, [])

  const perf = performance
  const positions = perf?.positions ?? []

  const handleSelectPosition = (pos) => {
    setSelected(pos)
    selectInstrument(pos.symbol, pos.symbol, pos.asset_class, pos.currency)
  }

  const totalCost = perf?.total_cost ?? 0
  const unrealizedPct = totalCost > 0 ? ((perf?.unrealized_pnl ?? 0) / totalCost) * 100 : 0

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-4 border-b border-border bg-panel">
        <h1 className="text-text font-semibold text-lg flex items-center gap-2">
          <Briefcase size={18} className="text-accent" />
          Portfolio
        </h1>
        <p className="text-muted text-xs mt-0.5">Live mark-to-market across all positions</p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatBox label="Total Equity"      value={usd(perf?.total_equity)}       color="text-accent" />
          <StatBox label="Cash Balance"      value={usd(perf?.cash_balance)}       color="text-text" />
          <StatBox
            label="Unrealized P&L"
            value={usd(perf?.unrealized_pnl)}
            sub={pct(unrealizedPct)}
            color={colorClass(perf?.unrealized_pnl ?? 0)}
          />
          <StatBox
            label="Realized P&L"
            value={usd(perf?.realized_pnl)}
            color={colorClass(perf?.realized_pnl ?? 0)}
          />
        </div>

        {/* Positions table + chart */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_600px] gap-4">
          {/* Positions list */}
          <div className="card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-text font-semibold text-sm">
                Open Positions ({positions.length})
              </span>
              <span className="text-muted text-xs">Click a row to chart it</span>
            </div>

            {positions.length === 0 ? (
              <div className="px-4 py-12 text-center text-muted text-sm">
                <Briefcase size={32} className="mx-auto mb-3 opacity-30" />
                No open positions yet. Head to <strong className="text-text">Markets</strong> to start trading.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="px-4 py-2.5 text-left">Symbol</th>
                      <th className="px-4 py-2.5 text-right">Qty</th>
                      <th className="px-4 py-2.5 text-right">Avg Cost</th>
                      <th className="px-4 py-2.5 text-right">Current Price</th>
                      <th className="px-4 py-2.5 text-right">Market Value</th>
                      <th className="px-4 py-2.5 text-right">Unreal. P&L</th>
                      <th className="px-4 py-2.5 text-right">P&L %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(pos => (
                      <tr
                        key={pos.symbol}
                        onClick={() => handleSelectPosition(pos)}
                        className={`border-b border-border/40 cursor-pointer transition-colors ${
                          selected?.symbol === pos.symbol ? 'bg-accent/5 border-l-2 border-l-accent' : 'hover:bg-border/20'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-accent font-semibold">{pos.symbol}</div>
                          <div className="text-muted capitalize">{pos.asset_class}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-text">
                          {pos.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted">
                          {usd(pos.avg_cost, 4)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-text">
                          {usd(pos.current_price, 4)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-text font-medium">
                          {usd(pos.market_value)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${colorClass(pos.unrealized_pnl)}`}>
                          {pos.unrealized_pnl >= 0 ? '+' : ''}{usd(pos.unrealized_pnl)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${colorClass(pos.unrealized_pnl_pct)}`}>
                          {pct(pos.unrealized_pnl_pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border text-text font-semibold">
                      <td colSpan={4} className="px-4 py-2.5 text-muted text-xs">TOTAL</td>
                      <td className="px-4 py-2.5 text-right font-mono">{usd(perf?.total_market_value)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${colorClass(perf?.unrealized_pnl ?? 0)}`}>
                        {usd(perf?.unrealized_pnl)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono ${colorClass(unrealizedPct)}`}>
                        {pct(unrealizedPct)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Right panel: chart + close order */}
          <div className="flex flex-col gap-4">
            {selected && (
              <div className="card overflow-hidden" style={{ height: '320px' }}>
                <div className="px-4 py-2 border-b border-border text-sm font-semibold text-text">
                  {selected.symbol} Chart
                </div>
                <div style={{ height: '276px' }}>
                  <PriceChart symbol={selected.symbol} />
                </div>
              </div>
            )}
            <OrderPanel />
          </div>
        </div>

        {/* Allocation donut (text representation) */}
        {positions.length > 0 && (
          <div className="card p-4">
            <div className="text-sm font-semibold text-text mb-3">Allocation by Asset Class</div>
            <div className="space-y-2">
              {Object.entries(
                positions.reduce((acc, p) => {
                  acc[p.asset_class] = (acc[p.asset_class] || 0) + (p.market_value || 0)
                  return acc
                }, {})
              ).map(([cls, val]) => {
                const pctVal = perf?.total_market_value ? (val / perf.total_market_value) * 100 : 0
                return (
                  <div key={cls}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted capitalize">{cls}</span>
                      <span className="font-mono text-text">{usd(val)} · {pct(pctVal, 1)}</span>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${Math.max(pctVal, 0.5)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
