import type { ScheduleWhenStack } from '../calendar/pacificWallTime'
import { escapeHtmlPlain } from './appendBlocksHtml'
import { EMAIL_LABEL } from './emailDarkSurfacePalette'

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
  const set = stack.setTimeLine?.trim()
  const setHtml = set
    ? `<div style="margin:9px 0 0;padding:9px 0 0;border-top:1px solid rgba(255,255,255,0.12);">`
      + `<div style="margin:0;padding:0;font-size:${Math.round(basePx * 0.65 * 10) / 10}px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL_LABEL};line-height:1.2;">Your set</div>`
      + `<div style="margin:3px 0 0;padding:0;font-weight:500;opacity:0.92;">${e(set)}</div>`
      + `</div>`
    : ''
  return (
    `<div style="font-size:${fs};line-height:1.18;letter-spacing:-0.04em;color:${color};white-space:normal;text-align:inherit;">`
    + `<div style="margin:0;padding:0;font-weight:600;">${e(stack.dayLine)}</div>`
    + `<div style="margin:0;padding:0;font-weight:600;">${e(stack.dateLine)}</div>`
    + `<div style="margin:0;padding:0;font-weight:500;opacity:0.92;">${e(stack.timeLine)}</div>`
    + setHtml
    + `</div>`
  )
}
