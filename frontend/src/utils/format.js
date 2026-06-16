/** Format a number as USD */
export const usd = (n, decimals = 2) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

/** Format a number as HKD */
export const hkd = (n, decimals = 2) =>
  n == null ? '—' : `HK$${Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

/** Format a percentage */
export const pct = (n, decimals = 2) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(decimals)}%`

/** Format a large number with K/M/B suffix */
export const compact = (n) => {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

/** Format a date string to readable local time */
export const datetime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong', hour12: false })
}

/** CSS class for positive/negative/zero */
export const colorClass = (n) =>
  n > 0 ? 'up' : n < 0 ? 'down' : 'flat'
