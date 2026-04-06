/** Placeholders for performance report request subject/body copy. Used by preview and should match send-performance-form. */
export function applyPerformanceReportPlaceholders(
  text: string,
  venueName: string,
  artistFullName: string,
): string {
  const first = artistFullName.split(/\s+/)[0] || artistFullName
  return text
    .replace(/\{venue\}/g, venueName)
    .replace(/\{artist\}/g, first)
}
