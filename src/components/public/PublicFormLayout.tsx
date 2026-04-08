import type { CSSProperties, ReactNode } from 'react'
import {
  publicFormBrandPrimaryLine,
  publicFormBrandSecondaryLine,
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
  children,
  rootClassName,
  mainClassName,
  showProgress = true,
}: PublicFormLayoutProps) {
  const primary = publicFormBrandPrimaryLine(branding)
  const secondary = publicFormBrandSecondaryLine(branding)
  const logoAlt = primary
  const websiteUrl = normalizeWebsiteUrl(branding.website)
  const handle = branding.social_handle?.replace(/^@/, '').trim() || ''
  const phone = branding.phone?.trim() || ''

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
        <a
          href={websiteUrl}
          className="text-[12px] font-medium text-neutral-200 underline-offset-2 hover:text-white hover:underline break-all"
        >
          {label}
        </a>
      ),
    })
  }
  if (handle) {
    linkBits.push({
      key: 'ig',
      el: (
        <a
          href={igHref(handle)}
          className="text-[12px] font-medium text-neutral-200 underline-offset-2 hover:text-white hover:underline"
        >
          @{handle}
        </a>
      ),
    })
  }
  if (phone) {
    linkBits.push({
      key: 'ph',
      el: <span className="text-[12px] font-medium text-neutral-200 tabular-nums">{phone}</span>,
    })
  }

  const hasPersona = Boolean(branding.manager_name?.trim() || branding.manager_title?.trim())
  const hasLinks = linkBits.length > 0
  const showUpper = hasPersona || hasLinks

  return (
    <div className={cn('flex min-h-screen flex-col', rootClassName ?? 'bg-black text-neutral-50 antialiased')}>
      <header
        className={cn('shrink-0', !showProgress && 'border-b border-neutral-700')}
      >
        <div className="mx-auto max-w-lg px-4 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <img
              src="/dj-luijay-logo.png"
              alt={logoAlt}
              className="h-9 w-auto shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] font-semibold leading-snug tracking-tight text-white">{primary}</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-300">{secondary}</p>
            </div>
          </div>
        </div>

        {showProgress ? (
          <div
            className={cn(
              'h-1.5 w-full overflow-hidden bg-neutral-800',
              '[@media(prefers-reduced-motion:reduce)]:[&_*]:!transition-none',
            )}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
          >
            <div
              className={cn('h-full transition-[width] duration-300 ease-out motion-reduce:transition-none')}
              style={fillStyle}
            />
          </div>
        ) : null}

        <div className="mx-auto max-w-lg px-4 pb-4 pt-5 text-center">
          <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-white sm:text-lg">{title}</h1>
          {descriptor ? (
            <p className="mx-auto mt-2 max-w-md text-[12px] font-medium leading-snug text-neutral-200">{descriptor}</p>
          ) : null}
        </div>
      </header>

      <main className={cn('mx-auto flex w-full max-w-lg flex-1 flex-col px-4', mainClassName)}>{children}</main>

      <footer className="mt-auto shrink-0 border-t border-neutral-700 bg-black">
        <div className="mx-auto max-w-lg px-4 py-3">
          {showUpper ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] leading-snug">
              {hasPersona ? (
                <>
                  {branding.manager_name?.trim() ? (
                    <span className="font-semibold text-white">{branding.manager_name.trim()}</span>
                  ) : null}
                  {branding.manager_title?.trim() ? (
                    <span className="text-neutral-300">{branding.manager_title.trim()}</span>
                  ) : null}
                </>
              ) : null}
              {hasPersona && hasLinks ? (
                <span className="text-neutral-600 select-none max-[359px]:hidden" aria-hidden>
                  ·
                </span>
              ) : null}
              {hasLinks ? (
                <span className="inline-flex flex-wrap items-center gap-x-0 gap-y-0.5 text-left">
                  {linkBits.map((b, i) => (
                    <span key={b.key} className="inline-flex max-w-full items-center">
                      {i > 0 ? (
                        <span className="mx-1.5 text-neutral-600 select-none" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      <span className="min-w-0">{b.el}</span>
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}

          <div
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]',
              showUpper ? 'mt-2 border-t border-neutral-800 pt-2' : '',
            )}
          >
            <a
              href="/terms"
              className="font-medium text-neutral-200 underline-offset-2 hover:text-white hover:underline"
            >
              Terms
            </a>
            <span className="text-neutral-600 select-none" aria-hidden>
              ·
            </span>
            <a
              href="/privacy"
              className="font-medium text-neutral-200 underline-offset-2 hover:text-white hover:underline"
            >
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
