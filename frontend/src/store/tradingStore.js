import { create } from 'zustand'
import axios from 'axios'

const API = '/api'

export const useTradingStore = create((set, get) => ({
  // ── Portfolio ──────────────────────────────────────────────────────────────
  portfolio: null,
  performance: null,
  trades: [],
  orders: [],

  fetchPortfolio: async () => {
    const { data } = await axios.get(`${API}/portfolio`)
    set({ portfolio: data })
  },

  fetchPerformance: async () => {
    const { data } = await axios.get(`${API}/portfolio/performance`)
    set({ performance: data })
  },

  fetchTrades: async () => {
    const { data } = await axios.get(`${API}/trades`)
    set({ trades: data })
  },

  fetchOrders: async () => {
    const { data } = await axios.get(`${API}/orders`)
    set({ orders: data })
  },

  placeOrder: async (orderReq) => {
    const { data } = await axios.post(`${API}/orders`, orderReq)
    await get().fetchPortfolio()
    await get().fetchPerformance()
    await get().fetchTrades()
    return data
  },

  resetPortfolio: async () => {
    await axios.post(`${API}/portfolio/reset`)
    await get().fetchPortfolio()
    await get().fetchPerformance()
    set({ trades: [], orders: [] })
  },

  // ── Selected instrument ───────────────────────────────────────────────────
  selectedSymbol: 'AAPL',
  selectedName: 'Apple Inc.',
  selectedAssetClass: 'stock',
  selectedCurrency: 'USD',
  selectedExchange: 'NASDAQ',

  selectInstrument: (symbol, name, assetClass, currency = 'USD', exchange = '') => {
    set({
      selectedSymbol: symbol,
      selectedName: name,
      selectedAssetClass: assetClass,
      selectedCurrency: currency,
      selectedExchange: exchange,
    })
  },

  // ── Live prices (from WebSocket) ──────────────────────────────────────────
  prices: {},

  updatePrice: (symbol, priceData) => {
    set(state => ({
      prices: { ...state.prices, [symbol]: priceData }
    }))
  },

  // ── UI state ──────────────────────────────────────────────────────────────
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  notification: null,
  notify: (msg, type = 'success') => {
    set({ notification: { msg, type, id: Date.now() } })
    setTimeout(() => set({ notification: null }), 3500)
  },
}))
