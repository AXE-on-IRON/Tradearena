import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts'
import axios from 'axios'

const PERIODS = [
  { label: '1D', period: '1d', interval: '5m' },
  { label: '5D', period: '5d', interval: '15m' },
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
  const [chartType, setChartType] = useState('candle')  // candle | line

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
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [symbol, activePeriod, chartType])

  const loadData = async () => {
    if (!chartRef.current || !symbol) return
    setLoading(true)

    try {
      const { data } = await axios.get(
        `/api/market/history/${symbol}?period=${activePeriod.period}&interval=${activePeriod.interval}`
      )
      const candles = data.candles || []

      // Remove existing series
      if (seriesRef.current) {
        try { chartRef.current.removeSeries(seriesRef.current) } catch {}
      }

      if (chartType === 'candle') {
        const series = chartRef.current.addCandlestickSeries({
          upColor: '#00e5a0',
          downColor: '#f85149',
          borderVisible: false,
          wickUpColor: '#00e5a0',
          wickDownColor: '#f85149',
        })
        series.setData(candles)
        seriesRef.current = series
      } else {
        const series = chartRef.current.addAreaSeries({
          lineColor: '#00e5a0',
          topColor: 'rgba(0,229,160,0.25)',
          bottomColor: 'rgba(0,229,160,0)',
          lineWidth: 2,
        })
        series.setData(candles.map(c => ({ time: c.time, value: c.close })))
        seriesRef.current = series
      }

      chartRef.current.timeScale().fitContent()
    } catch (e) {
      console.error('Chart error', e)
    } finally {
      setLoading(false)
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
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-panel/60">
            <div className="text-accent text-sm font-mono animate-pulse">Loading chart…</div>
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
