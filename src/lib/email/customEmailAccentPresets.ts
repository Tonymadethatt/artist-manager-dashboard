/** Hex accents for custom email block headers (inline email HTML + editor dot). */
export const CUSTOM_EMAIL_ACCENT_PRESETS = [
  { id: 'blue', label: 'Blue', hex: '#60a5fa' },
  { id: 'green', label: 'Green', hex: '#22c55e' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'violet', label: 'Violet', hex: '#a78bfa' },
  { id: 'cyan', label: 'Cyan', hex: '#22d3ee' },
  { id: 'orange', label: 'Orange', hex: '#fb923c' },
  { id: 'neutral', label: 'Neutral', hex: '#a3a3a3' },
] as const

export const CUSTOM_EMAIL_ACCENT_DEFAULT_PROSE = '#60a5fa'
export const CUSTOM_EMAIL_ACCENT_DEFAULT_BULLET = '#22c55e'

/** Allowlisted hex from API/user JSON. */
export function parseAccentColorHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return null
  return s
}

export function defaultAccentForBlockKind(kind: 'prose' | 'bullet_list' | 'key_value' | 'table'): string {
  return kind === 'bullet_list' ? CUSTOM_EMAIL_ACCENT_DEFAULT_BULLET : CUSTOM_EMAIL_ACCENT_DEFAULT_PROSE
}
