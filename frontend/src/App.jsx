import { useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { useTradingStore } from './store/tradingStore'
import { useLivePrices } from './hooks/useWebSocket'
import Dashboard from './pages/Dashboard'
import Markets from './pages/Markets'
import Portfolio from './pages/Portfolio'
import TradeHistory from './pages/TradeHistory'
import Research from './pages/Research'
import Notification from './components/Notification'
import {
  LayoutDashboard, Globe, Briefcase, Clock, BarChart2, RefreshCw
} from 'lucide-react'

const NAV = [
  { to: '/',          label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/markets',   label: 'Markets',    icon: Globe },
  { to: '/portfolio', label: 'Portfolio',  icon: Briefcase },
  { to: '/history',   label: 'History',    icon: Clock },
  { to: '/research',  label: 'Research',   icon: BarChart2 },
]

export default function App() {
  const { fetchPortfolio, fetchPerformance, fetchTrades, fetchOrders,
          portfolio, resetPortfolio, notify, notification } = useTradingStore()

  // Default symbols to keep streaming
  useLivePrices([
    'AAPL','TSLA','NVDA','AMZN','MSFT','META','GOOGL',
    'EURUSD=X','GBPUSD=X','USDJPY=X','USDHKD=X',
    'GC=F','CL=F','BTC-USD','ETH-USD',
    '0700.HK','^HSI','^GSPC','^N225'
  ])

  useEffect(() => {
    fetchPortfolio()
    fetchPerformance()
    fetchTrades()
    fetchOrders()
    // Refresh performance every 30s
    const id = setInterval(() => fetchPerformance(), 30000)
    return () => clearInterval(id)
  }, [])

  const handleReset = async () => {
    if (!confirm('Reset portfolio to $100,000? All positions and trades will be cleared.')) return
    await resetPortfolio()
    notify('Portfolio reset to $100,000', 'success')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-panel border-r border-border flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            <div>
              <div className="text-text font-bold text-base leading-tight">TradeArena</div>
              <div className="text-muted text-xs">Simulation Platform</div>
            </div>
          </div>
        </div>

        {/* Balance summary */}
        {portfolio && (
          <div className="px-4 py-3 border-b border-border">
            <div className="text-muted text-xs mb-1">Cash Balance</div>
            <div className="font-mono text-accent text-lg font-semibold">
              ${portfolio.cash_balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium border border-accent/20'
                    : 'text-muted hover:text-text hover:bg-border/50'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Reset button */}
        <div className="px-3 py-4 border-t border-border">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <RefreshCw size={13} />
            Reset Portfolio
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/markets"   element={<Markets />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/history"   element={<TradeHistory />} />
          <Route path="/research"  element={<Research />} />
        </Routes>
      </main>

      {/* Toast notification */}
      {notification && <Notification {...notification} />}
    </div>
  )
}
