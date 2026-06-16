import { useEffect, useRef } from 'react'
import { useTradingStore } from '../store/tradingStore'

const WS_URL = 'ws://localhost:8000/ws/prices'

export function useLivePrices(symbols = []) {
  const ws = useRef(null)
  const updatePrice = useTradingStore(s => s.updatePrice)

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(WS_URL)

      ws.current.onopen = () => {
        if (symbols.length > 0) {
          ws.current.send(JSON.stringify({ subscribe: symbols }))
        }
      }

      ws.current.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'price' && msg.data?.symbol) {
            updatePrice(msg.data.symbol, msg.data)
          }
        } catch { /* ignore */ }
      }

      ws.current.onclose = () => {
        setTimeout(connect, 3000)  // auto-reconnect
      }
    }

    connect()
    return () => ws.current?.close()
  }, [])

  // Update subscriptions when symbols change
  useEffect(() => {
    if (ws.current?.readyState === WebSocket.OPEN && symbols.length > 0) {
      ws.current.send(JSON.stringify({ subscribe: symbols }))
    }
  }, [symbols.join(',')])
}
