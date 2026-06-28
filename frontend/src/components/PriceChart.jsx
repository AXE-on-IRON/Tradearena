import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts'
import axios from 'axios'

const PERIODS = [
  { label: '1D', period: '1d', interval: '15m' },   // FIX: 5m was too slow/throttled by Yahoo, 15m is much faster
  { label: '5D', period: '5d', interval: '30m' },   // FIX: 15m -> 30m, fewer candles to fetch
  { label: '1M', period: '1mo', interval: '1d' },
  { label: '3M', period: '3mo', interval: '1d' },
  { label: '1Y', period: '1y', interval: '1d' },
  { label: '5Y', period: '5y', interval: '1wk' },
]

export default function PriceChart({ symbol }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const [activePeriod, setActivePeriod] = useState(PERIODS[4])
  const [loading, setLoading] = useState(false)
  const [chartType, setChartType] = useState('candle')
  const requestIdRef = useRef(0)   // FIX: guards against stale slow responses overwriting newer ones

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#161b22' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#21262d' },
      timeScale: {
        borderColor: '#21262d',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    const handleResize = () => {
      chart.applyOptions({ width: containerRef.current.clientWidth })
    }
    window.addEventListener('resize', handleResize)
    chartRef.current = chart

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [symbol, activePeriod, chartType])

  const loadData = async () => {
    if (!chartRef.current || !symbol) return

    const myRequestId = ++requestIdRef.current
    setLoading(true)

    try {
      const { data } = await axios.get(
        `/api/market/history/${symbol}?period=${activePeriod.period}&interval=${activePeriod.interval}`
      )

      // FIX: if a newer request started while this one was in flight, drop this stale result
      if (myRequestId !== requestIdRef.current) return
      if (!chartRef.current) return

      const candles = data.candles || []

      // FIX: reuse the existing series instead of removing/re-adding every time —
      // removing+recreating a series on every click is what caused the visible "stuck" delay
      const needsNewSeriesType =
        !seriesRef.current || seriesRef.current._chartType !== chartType

      if (needsNewSeriesType) {
        if (seriesRef.current) {
          try { chartRef.current.removeSeries(seriesRef.current) } catch {}
        }
        if (chartType === 'candle') {
          seriesRef.current = chartRef.current.addCandlestickSeries({
            upColor: '#00e5a0',
            downColor: '#f85149',
            borderVisible: false,
            wickUpColor: '#00e5a0',
            wickDownColor: '#f85149',
          })
        } else {
          seriesRef.current = chartRef.current.addAreaSeries({
            lineColor: '#00e5a0',
            topColor: 'rgba(0,229,160,0.25)',
            bottomColor: 'rgba(0,229,160,0)',
            lineWidth: 2,
          })
        }
        seriesRef.current._chartType = chartType
      }

      if (chartType === 'candle') {
        seriesRef.current.setData(candles)
      } else {
        seriesRef.current.setData(candles.map(c => ({ time: c.time, value: c.close })))
      }

      chartRef.current.timeScale().fitContent()
    } catch (e) {
      console.error('Chart error', e)
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => setActivePeriod(p)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                activePeriod.label === p.label
                  ? 'bg-accent text-surface font-semibold'
                  : 'text-muted hover:text-text'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {['candle', 'line'].map(t => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${
                chartType === t ? 'bg-accent text-surface font-semibold' : 'text-muted hover:text-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative flex-1 min-h-0">
        {loading && (
          // FIX: small corner spinner instead of a full-screen blocking overlay —
          // the chart now stays visible/interactive while new data loads
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-panel/90 border border-border rounded px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-accent text-xs font-mono">loading…</span>
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
