/** Cursor = index in `text` (0..length). Returns menu anchor if user is typing `/filter` after word boundary or start. */
export function parseSlashMenu(text: string, cursor: number): { start: number; filter: string } | null {
  const before = text.slice(0, cursor)
  const slash = before.lastIndexOf('/')
  if (slash < 0) return null
  if (slash > 0 && !/[\s\n]/.test(before[slash - 1]!)) return null
  const after = before.slice(slash + 1)
  if (!/^[\w.]*$/.test(after)) return null
  return { start: slash, filter: after }
}
