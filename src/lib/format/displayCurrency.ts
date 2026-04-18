/**
 * User-facing USD only: whole dollars, rounding **up** for non-negative amounts.
 * Does not change stored numeric precision — use only for display strings.
 */
const usdCeilFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatUsdDisplayCeil(n: number): string {
  if (!Number.isFinite(n)) return usdCeilFormatter.format(0)
  if (n < 0) {
    const floored = Math.floor(n)
    return usdCeilFormatter.format(floored)
  }
  return usdCeilFormatter.format(Math.ceil(n))
}
