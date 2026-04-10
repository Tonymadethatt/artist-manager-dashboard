import type { ScheduleWhenStack } from '../calendar/pacificWallTime'
import { escapeHtmlPlain } from './appendBlocksHtml'

/**
 * 3-line "when" block for narrow email table columns: weekday / date / time (or "All day").
 * ~15% smaller than body table font, tighter letter-spacing for readability on mobile.
 */
export function stackedScheduleWhenCellHtml(
  stack: ScheduleWhenStack,
  color: string,
  mode: 'compact' | 'digest',
): string {
  const basePx = mode === 'digest' ? 13 : 12
  const fs = `${Math.round(basePx * 0.85 * 10) / 10}px`
  const e = escapeHtmlPlain
  return (
    `<div style="font-size:${fs};line-height:1.18;letter-spacing:-0.04em;color:${color};white-space:normal;text-align:inherit;">`
    + `<div style="margin:0;padding:0;font-weight:600;">${e(stack.dayLine)}</div>`
    + `<div style="margin:0;padding:0;font-weight:600;">${e(stack.dateLine)}</div>`
    + `<div style="margin:0;padding:0;font-weight:500;opacity:0.92;">${e(stack.timeLine)}</div>`
    + `</div>`
  )
}
