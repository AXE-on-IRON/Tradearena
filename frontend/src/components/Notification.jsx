import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function Notification({ msg, type }) {
  const styles = {
    success: 'border-accent text-accent bg-accent/10',
    error:   'border-danger text-danger bg-danger/10',
    warn:    'border-warning text-warning bg-warning/10',
  }
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : AlertCircle

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border font-medium text-sm shadow-lg transition-all ${styles[type] || styles.success}`}>
      <Icon size={16} />
      {msg}
    </div>
  )
}
