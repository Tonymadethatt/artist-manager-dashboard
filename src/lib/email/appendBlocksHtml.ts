import type { EmailTemplateAppendBlock } from '@/lib/emailLayout'

export function escapeHtmlPlain(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function nlToBr(s: string): string {
  return escapeHtmlPlain(s).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>')
}

function card(title: string, content: string, accentColor = '#60a5fa'): string {
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:16px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid #2a2a2a;"><span style="display:inline-block;width:6px;height:6px;background:${accentColor};border-radius:50%;margin-right:8px;vertical-align:middle;"></span><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#888888;vertical-align:middle;">${title}</span></div><div style="padding:2px 18px 6px;">${content}</div></div>`
}

export function renderAppendBlocksHtml(blocks: EmailTemplateAppendBlock[] | undefined): string {
  if (!blocks?.length) return ''
  return blocks.map(b => {
    if (b.kind === 'prose_card') {
      const title = (b.title?.trim() || 'Note').toUpperCase()
      const inner = `<p style="font-size:13px;color:#d1d1d1;line-height:1.7;margin:0;">${nlToBr(b.body.trim() || '')}</p>`
      return card(title, inner, '#60a5fa')
    }
    const title = (b.title?.trim() || 'Details').toUpperCase()
    const lis = b.items
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => `<li style="margin-bottom:8px;">${nlToBr(t)}</li>`)
      .join('')
    const inner = `<ul style="font-size:13px;color:#d1d1d1;line-height:1.7;padding-left:16px;margin:0;">${lis}</ul>`
    return card(title, inner, '#22c55e')
  }).join('')
}
