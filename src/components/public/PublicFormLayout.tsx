import type { CSSProperties, ReactNode } from 'react'
import {
  publicFormBrandPrimaryLine,
  publicFormBrandSecondaryLine,
  publicFormReplyAddress,
  type PublicFormBranding,
} from '@/lib/publicFormBranding'
import { FORM_CTA_PROGRESS_GRADIENT } from '@/lib/email/venueEmailCtaStyles'
import { cn } from '@/lib/utils'

function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

function igHref(handle: string): string {
  const h = handle.replace(/^@/, '').trim()
  return `https://instagram.com/${encodeURIComponent(h)}`
}

export interface PublicFormLayoutProps {
  branding: PublicFormBranding
  title: string
  descriptor: string
  /** 0–100 */
  progress: number
  /** Brief green success state on the progress track */
  progressSuccessFlash?: boolean
  venueContext?: ReactNode
  children: ReactNode
  rootClassName?: string
  mainClassName?: string
  /** When false, hide progress bar (e.g. loading). */
  showProgress?: boolean
}

export function PublicFormLayout({
  branding,
  title,
  descriptor,
  progress,
  progressSuccessFlash = false,
  venueContext,
  children,
  rootClassName,
  mainClassName,
  showProgress = true,
}: PublicFormLayoutProps) {
  const primary = publicFormBrandPrimaryLine(branding)
  const secondary = publicFormBrandSecondaryLine(branding)
  const websiteUrl = normalizeWebsiteUrl(branding.website)
  const handle = branding.social_handle?.replace(/^@/, '').trim() || ''
  const phone = branding.phone?.trim() || ''
  const replyAddr = publicFormReplyAddress(branding)
  const mailtoHref = replyAddr
    ? `mailto:${replyAddr}?subject=${encodeURIComponent('Re: Form response')}`
    : null

  const pct = Math.max(0, Math.min(100, progress))
  const fillStyle: CSSProperties =
    progressSuccessFlash
      ? { width: `${pct}%`, background: 'linear-gradient(90deg, #34d399, #10b981)' }
      : { width: `${pct}%`, background: FORM_CTA_PROGRESS_GRADIENT }

  const linkBits: { key: string; el: ReactNode }[] = []
  if (websiteUrl) {
    const label = websiteUrl.replace(/^https?:\/\//i, '')
    linkBits.push({
      key: 'web',
      el: (
        <a href={websiteUrl} className="text-neutral-500 hover:text-neutral-300 underline-offset-2 hover:underline text-[11px] break-all">
          {label}
        </a>
      ),
    })
  }
  if (handle) {
    linkBits.push({
      key: 'ig',
      el: (
        <a href={igHref(handle)} className="text-neutral-500 hover:text-neutral-300 underline-offset-2 hover:underline text-[11px]">
          @{handle}
        </a>
      ),
    })
  }
  if (phone) {
    linkBits.push({
      key: 'ph',
      el: (
        <span className="text-[11px] text-neutral-500">{phone}</span>
      ),
    })
  }

  return (
    <div className={cn('flex min-h-screen flex-col', rootClassName ?? 'bg-neutral-950 text-neutral-100')}>
      <div className="shrink-0 border-b border-neutral-800/80 px-4 pt-5 pb-3">
        <div className="mx-auto flex max-w-lg items-start gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <img src="/dj-luijay-logo.png" alt="" className="mt-0.5 h-8 w-auto shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-snug text-white">{primary}</p>
              <p className="mt-0.5 text-[10px] font-medium leading-snug text-neutral-500">{secondary}</p>
            </div>
          </div>
          <div className="min-w-0 flex-[1.4] px-1 text-center">
            <h1 className="text-base font-semibold leading-snug text-white">{title}</h1>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-neutral-500">{descriptor}</p>
          </div>
          <div className="min-w-0 flex-1 shrink-0" aria-hidden />
        </div>

        {venueContext ? (
          <div className="mx-auto mt-3 max-w-lg border-t border-neutral-800/80 pt-3">{venueContext}</div>
        ) : null}

        {showProgress ? (
          <div
            className={cn(
              'mx-auto mt-3 h-1.5 w-full max-w-lg overflow-hidden rounded-full bg-neutral-800',
              '[@media(prefers-reduced-motion:reduce)]:[&_*]:!transition-none',
            )}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
          >
            <div
              className={cn('h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none')}
              style={fillStyle}
            />
          </div>
        ) : null}
      </div>

      <main className={cn('mx-auto flex w-full max-w-lg flex-1 flex-col px-4', mainClassName)}>{children}</main>

      <footer className="mt-auto shrink-0 border-t border-neutral-800 bg-[#0a0a0a] px-4 py-5">
        <div className="mx-auto max-w-lg space-y-3 text-center sm:text-left">
          {(branding.manager_name || branding.manager_title) ? (
            <div>
              {branding.manager_name ? (
                <p className="text-xs font-semibold text-neutral-200">{branding.manager_name}</p>
              ) : null}
              {branding.manager_title ? (
                <p className="mt-0.5 text-[11px] text-neutral-500">{branding.manager_title}</p>
              ) : null}
            </div>
          ) : null}

          {linkBits.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
              {linkBits.map((b, i) => (
                <span key={b.key} className="inline-flex items-center gap-2">
                  {i > 0 ? <span className="text-neutral-600">|</span> : null}
                  {b.el}
                </span>
              ))}
            </div>
          ) : null}

          {mailtoHref ? (
            <div>
              <a
                href={mailtoHref}
                className="inline-block rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800"
              >
                Reply
              </a>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-neutral-500 sm:justify-start">
            <a href="/terms" className="hover:text-neutral-300 underline-offset-2 hover:underline">
              Terms
            </a>
            <a href="/privacy" className="hover:text-neutral-300 underline-offset-2 hover:underline">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
