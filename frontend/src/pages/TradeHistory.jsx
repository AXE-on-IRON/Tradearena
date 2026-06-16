import { useEffect, useState } from 'react'
import { useTradingStore } from '../store/tradingStore'
import { usd, pct, colorClass, datetime } from '../utils/format'
import { Clock, TrendingUp, TrendingDown, Filter } from 'lucide-react'

export default function TradeHistory() {
  const { trades, orders, fetchTrades, fetchOrders } = useTradingStore()
  const [view, setView] = useState('trades')  // trades | orders
  const [filter, setFilter] = useState('all') // all | buy | sell
  const [assetFilter, setAssetFilter] = useState('all')

  useEffect(() => {
    fetchTrades()
    fetchOrders()
  }, [])

  const filteredTrades = trades.filter(t => {
    if (filter !== 'all' && t.side !== filter) return false
    if (assetFilter !== 'all' && t.asset_class !== assetFilter) return false
    return true
  })

  const filteredOrders = orders.filter(o => {
    if (filter !== 'all' && o.side !== filter) return false
    if (assetFilter !== 'all' && o.asset_class !== assetFilter) return false
    return true
  })

  // Stats
  const closedTrades = trades.filter(t => t.pnl != null)
  const totalRealizedPnl = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0)
  const winners = closedTrades.filter(t => t.pnl > 0)
  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0
  const totalVolume = trades.reduce((s, t) => s + (t.total_value || 0), 0)

  const assetClasses = [...new Set(trades.map(t => t.asset_class))].filter(Boolean)

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-panel">
        <h1 className="text-text font-semibold text-lg flex items-center gap-2">
          <Clock size={18} className="text-accent" />
          Trade History
        </h1>
        <p className="text-muted text-xs mt-0.5">All executed trades and orders</p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card px-4 py-3">
            <div className="text-muted text-xs mb-1">Total Trades</div>
            <div className="font-mono font-semibold text-lg text-text">{trades.length}</div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-muted text-xs mb-1">Realized P&L</div>
            <div className={`font-mono font-semibold text-lg ${colorClass(totalRealizedPnl)}`}>
              {usd(totalRealizedPnl)}
            </div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-muted text-xs mb-1">Win Rate</div>
            <div className={`font-mono font-semibold text-lg ${winRate >= 50 ? 'text-accent' : 'text-danger'}`}>
              {closedTrades.length > 0 ? `${winRate.toFixed(1)}%` : '—'}
            </div>
            <div className="text-muted text-xs">{winners.length} / {closedTrades.length} closed</div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-muted text-xs mb-1">Total Volume</div>
            <div className="font-mono font-semibold text-lg text-text">{usd(totalVolume)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-md overflow-hidden border border-border">
            {['trades', 'orders'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                  view === v ? 'bg-accent text-surface' : 'text-muted hover:text-text bg-panel'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Side filter */}
          <div className="flex gap-1">
            {['all', 'buy', 'sell'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs capitalize transition-colors ${
                  filter === f ? 'bg-accent text-surface font-semibold' : 'btn-ghost py-1'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Asset class filter */}
          {assetClasses.length > 0 && (
            <div className="flex gap-1">
              <button
                onClick={() => setAssetFilter('all')}
                className={`px-3 py-1 rounded text-xs transition-colors ${assetFilter === 'all' ? 'bg-border text-text' : 'text-muted hover:text-text'}`}
              >
                All assets
              </button>
              {assetClasses.map(ac => (
                <button
                  key={ac}
                  onClick={() => setAssetFilter(ac)}
                  className={`px-3 py-1 rounded text-xs capitalize transition-colors ${assetFilter === ac ? 'bg-border text-text' : 'text-muted hover:text-text'}`}
                >
                  {ac}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Trades table */}
        {view === 'trades' && (
          <div className="card">
            <div className="px-4 py-3 border-b border-border text-sm font-semibold text-text">
              Executed Trades ({filteredTrades.length})
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="px-4 py-2.5 text-left">Time</th>
                    <th className="px-4 py-2.5 text-left">Symbol</th>
                    <th className="px-4 py-2.5 text-left">Asset</th>
                    <th className="px-4 py-2.5 text-center">Side</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Price</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                    <th className="px-4 py-2.5 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-muted">
                        No trades yet. Start trading in Markets!
                      </td>
                    </tr>
                  )}
                  {filteredTrades.map(t => (
                    <tr key={t.id} className="border-b border-border/40 hover:bg-border/20">
                      <td className="px-4 py-2.5 text-muted font-mono">{datetime(t.executed_at)}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-accent font-semibold">{t.symbol}</span>
                        {t.name && t.name !== t.symbol && (
                          <div className="text-muted truncate max-w-[100px]">{t.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted capitalize">{t.asset_class}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          t.side === 'buy' ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger'
                        }`}>
                          {t.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-text">
                        {t.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-text">{usd(t.price, 4)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-text">{usd(t.total_value)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
                        t.pnl != null ? colorClass(t.pnl) : 'text-muted'
                      }`}>
                        {t.pnl != null ? (t.pnl >= 0 ? '+' : '') + usd(t.pnl) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Orders table */}
        {view === 'orders' && (
          <div className="card">
            <div className="px-4 py-3 border-b border-border text-sm font-semibold text-text">
              Order Log ({filteredOrders.length})
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="px-4 py-2.5 text-left">Time</th>
                    <th className="px-4 py-2.5 text-left">Symbol</th>
                    <th className="px-4 py-2.5 text-center">Side</th>
                    <th className="px-4 py-2.5 text-center">Type</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Limit Px</th>
                    <th className="px-4 py-2.5 text-right">Fill Px</th>
                    <th className="px-4 py-2.5 text-right">Leverage</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-muted">No orders yet.</td>
                    </tr>
                  )}
                  {filteredOrders.map(o => (
                    <tr key={o.id} className="border-b border-border/40 hover:bg-border/20">
                      <td className="px-4 py-2.5 text-muted font-mono">{datetime(o.created_at)}</td>
                      <td className="px-4 py-2.5 font-mono text-accent font-semibold">{o.symbol}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          o.side === 'buy' ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger'
                        }`}>
                          {o.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-muted capitalize">{o.order_type}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-text">{o.quantity}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted">
                        {o.limit_price != null ? usd(o.limit_price, 4) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-text">
                        {o.filled_price != null ? usd(o.filled_price, 4) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted">{o.leverage}x</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          o.status === 'filled' ? 'bg-accent/15 text-accent' :
                          o.status === 'pending' ? 'bg-warning/15 text-warning' :
                          'bg-danger/15 text-danger'
                        }`}>
                          {o.status}
                        </span>
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
