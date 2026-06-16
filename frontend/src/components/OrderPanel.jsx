import { useState } from 'react'
import { useTradingStore } from '../store/tradingStore'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

export default function OrderPanel() {
  const {
    selectedSymbol, selectedName, selectedAssetClass,
    selectedCurrency, selectedExchange,
    portfolio, prices, placeOrder, notify
  } = useTradingStore()

  const [side, setSide] = useState('buy')
  const [orderType, setOrderType] = useState('market')
  const [quantity, setQuantity] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [leverage, setLeverage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const liveData = prices[selectedSymbol]
  const currentPrice = liveData?.price ?? null

  const qty = parseFloat(quantity) || 0
  const lp  = parseFloat(limitPrice) || currentPrice || 0
  const execPrice = orderType === 'market' ? currentPrice : lp
  const total = execPrice ? (qty * execPrice) / leverage : 0
  const cashAvailable = portfolio?.cash_balance ?? 0

  const handleSubmit = async () => {
    setError('')
    if (!qty || qty <= 0) { setError('Enter a valid quantity'); return }
    if (orderType !== 'market' && !limitPrice) { setError('Enter a limit price'); return }

    setLoading(true)
    try {
      const result = await placeOrder({
        symbol: selectedSymbol,
        name: selectedName,
        asset_class: selectedAssetClass,
        side,
        order_type: orderType,
        quantity: qty,
        limit_price: orderType !== 'market' ? lp : null,
        leverage,
        exchange: selectedExchange,
        currency: selectedCurrency,
      })
      notify(
        `${side.toUpperCase()} ${qty} ${selectedSymbol} @ $${result.price?.toFixed(4) ?? '—'}`,
        'success'
      )
      setQuantity('')
      setLimitPrice('')
    } catch (e) {
      const msg = e.response?.data?.detail || 'Order failed'
      setError(msg)
      notify(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-text font-semibold text-sm">{selectedSymbol}</div>
          <div className="text-muted text-xs truncate max-w-[140px]">{selectedName}</div>
        </div>
        {currentPrice != null ? (
          <div className="text-right">
            <div className="font-mono font-semibold text-text">${currentPrice.toLocaleString()}</div>
            <div className={`text-xs font-mono ${(liveData?.change_pct ?? 0) >= 0 ? 'up' : 'down'}`}>
              {(liveData?.change_pct ?? 0) >= 0 ? '+' : ''}{(liveData?.change_pct ?? 0).toFixed(2)}%
            </div>
          </div>
        ) : (
          <div className="text-muted text-xs animate-pulse">loading…</div>
        )}
      </div>

      {/* Buy / Sell toggle */}
      <div className="grid grid-cols-2 gap-1 bg-surface rounded-md p-1">
        {['buy', 'sell'].map(s => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`py-2 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              side === s
                ? s === 'buy' ? 'bg-accent text-surface' : 'bg-danger text-white'
                : 'text-muted hover:text-text'
            }`}
          >
            {s === 'buy' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Order type */}
      <div>
        <label className="text-muted text-xs mb-1 block">Order Type</label>
        <select
          value={orderType}
          onChange={e => setOrderType(e.target.value)}
          className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
        </select>
      </div>

      {/* Quantity */}
      <div>
        <label className="text-muted text-xs mb-1 block">Quantity</label>
        <input
          type="number"
          min="0"
          step="any"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="0"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-sm font-mono text-text focus:outline-none focus:border-accent"
        />
      </div>

      {/* Limit price (conditional) */}
      {orderType !== 'market' && (
        <div>
          <label className="text-muted text-xs mb-1 block">
            {orderType === 'limit' ? 'Limit Price' : 'Stop Price'}
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={limitPrice}
            onChange={e => setLimitPrice(e.target.value)}
            placeholder={currentPrice?.toFixed(4) ?? '0.00'}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm font-mono text-text focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {/* Leverage */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-muted text-xs">Leverage</label>
          <span className="text-accent text-xs font-mono font-semibold">{leverage}x</span>
        </div>
        <input
          type="range" min="1" max="10" step="1"
          value={leverage}
          onChange={e => setLeverage(Number(e.target.value))}
          className="w-full accent-[#00e5a0]"
        />
        <div className="flex justify-between text-muted text-xs mt-1">
          <span>1x</span><span>5x</span><span>10x</span>
        </div>
        {leverage > 1 && (
          <div className="flex items-center gap-1 mt-2 text-warning text-xs">
            <AlertTriangle size={11} />
            Leveraged trading amplifies both gains and losses
          </div>
        )}
      </div>

      {/* Order summary */}
      <div className="bg-surface rounded-md p-3 text-xs space-y-1.5">
        <div className="flex justify-between">
          <span className="text-muted">Est. Price</span>
          <span className="font-mono text-text">
            {execPrice != null ? `$${execPrice.toLocaleString()}` : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Total Cost</span>
          <span className="font-mono font-semibold text-text">
            {total > 0 ? `$${total.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5">
          <span className="text-muted">Cash Available</span>
          <span className={`font-mono text-xs ${total > cashAvailable ? 'text-danger' : 'text-accent'}`}>
            ${cashAvailable.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-danger text-xs bg-danger/10 border border-danger/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || (!quantity)}
        className={`w-full py-3 rounded-md font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          side === 'buy'
            ? 'bg-accent text-surface hover:bg-accent-dim'
            : 'bg-danger text-white hover:bg-red-700'
        }`}
      >
        {loading ? 'Placing…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${selectedSymbol}`}
      </button>
    </div>
  )
}
