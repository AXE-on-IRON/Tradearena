import { useState } from 'react'
import { useTradingStore } from '../store/tradingStore'
import { ChevronUp, ChevronDown } from 'lucide-react'

function PriceCell({ symbol, fallback }) {
  const live = useTradingStore(s => s.prices[symbol])
  const price = live?.price ?? fallback?.price
  const pct   = live?.change_pct ?? fallback?.change_pct ?? 0
  return (
    <td className="px-3 py-2.5 text-right">
      <div className="font-mono text-sm text-text">
        {price != null ? price.toLocaleString('en-US', { maximumFractionDigits: 5 }) : '—'}
      </div>
      <div className={`text-xs font-mono ${pct >= 0 ? 'up' : 'down'}`}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
      </div>
    </td>
  )
}

export default function MarketTable({ data = [], assetClass, columns = ['name','price','change'], onSelect }) {
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const selectInstrument = useTradingStore(s => s.selectInstrument)

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...data].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'string') av = av.toLowerCase()
    if (typeof bv === 'string') bv = bv.toLowerCase()
    if (av == null) return 1
    if (bv == null) return -1
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
  })

  const SortIcon = ({ col }) => sortKey === col
    ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
    : null

  const handleRowClick = (row) => {
    selectInstrument(
      row.symbol,
      row.name || row.pair || row.symbol,
      assetClass,
      row.currency || 'USD',
      row.exchange || ''
    )
    onSelect?.(row)
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-xs">
            <th
              className="px-3 py-2 text-left cursor-pointer hover:text-text select-none"
              onClick={() => handleSort('symbol')}
            >
              <span className="flex items-center gap-1">Symbol <SortIcon col="symbol" /></span>
            </th>
            <th
              className="px-3 py-2 text-left cursor-pointer hover:text-text select-none"
              onClick={() => handleSort('name')}
            >
              <span className="flex items-center gap-1">Name <SortIcon col="name" /></span>
            </th>
            <th
              className="px-3 py-2 text-right cursor-pointer hover:text-text select-none"
              onClick={() => handleSort('price')}
            >
              <span className="flex items-center justify-end gap-1">Price <SortIcon col="price" /></span>
            </th>
            <th
              className="px-3 py-2 text-right cursor-pointer hover:text-text select-none"
              onClick={() => handleSort('change_pct')}
            >
              <span className="flex items-center justify-end gap-1">24h % <SortIcon col="change_pct" /></span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.symbol}
              className="border-b border-border/40 hover:bg-border/30 cursor-pointer transition-colors"
              onClick={() => handleRowClick(row)}
            >
              <td className="px-3 py-2.5">
                <span className="font-mono text-accent text-xs font-semibold">{row.symbol}</span>
              </td>
              <td className="px-3 py-2.5 text-muted text-xs max-w-[180px] truncate">
                {row.name || row.pair || '—'}
              </td>
              <PriceCell symbol={row.symbol} fallback={row} />
              <td className="px-3 py-2.5 text-right font-mono text-xs" />
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-muted text-sm">
                Loading market data…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
