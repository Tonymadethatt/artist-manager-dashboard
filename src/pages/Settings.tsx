import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useProfileFieldPresets } from '@/hooks/useProfileFieldPresets'
import { FieldWithPresets } from '@/components/settings/FieldWithPresets'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { isIcsDevToolEnabled, sendDevIcsTestEmail } from '@/lib/dev/icsDevTest'
import { cn } from '@/lib/utils'
import type { ArtistProfile, ProfileFieldPresetKey } from '@/types'

type FormState = {
  artist_name: string
  artist_email: string
  manager_name: string
  manager_title: string
  manager_email: string
  from_email: string
  company_name: string
  website: string
  phone: string
  social_handle: string
  tagline: string
  reply_to_email: string
}

type FormKey = keyof FormState

const EMPTY_FORM: FormState = {
  artist_name: '',
  artist_email: '',
  manager_name: '',
  manager_title: '',
  manager_email: '',
  from_email: '',
  company_name: '',
  website: '',
  phone: '',
  social_handle: '',
  tagline: '',
  reply_to_email: '',
}

function formFromProfile(p: ArtistProfile): FormState {
  return {
    artist_name: p.artist_name,
    artist_email: p.artist_email,
    manager_name: p.manager_name ?? '',
    manager_title: p.manager_title ?? '',
    manager_email: p.manager_email ?? '',
    from_email: p.from_email,
    company_name: p.company_name ?? '',
    website: p.website ?? '',
    phone: p.phone ?? '',
    social_handle: p.social_handle ?? '',
    tagline: p.tagline ?? '',
    reply_to_email: p.reply_to_email ?? '',
  }
}

/** Single-field payload matching `updateProfile` / DB shape. */
function buildPartial(key: FormKey, f: FormState): Partial<Omit<ArtistProfile, 'user_id' | 'created_at' | 'updated_at'>> {
  const t = (s: string) => s.trim()
  switch (key) {
    case 'artist_name':
      return { artist_name: t(f.artist_name) }
    case 'artist_email':
      return { artist_email: t(f.artist_email) }
    case 'from_email':
      return { from_email: t(f.from_email) }
    case 'manager_name':
      return { manager_name: t(f.manager_name) || null }
    case 'manager_title':
      return { manager_title: t(f.manager_title) || null }
    case 'manager_email':
      return { manager_email: t(f.manager_email) || null }
    case 'company_name':
      return { company_name: t(f.company_name) || null }
    case 'website':
      return { website: t(f.website) || null }
    case 'phone':
      return { phone: t(f.phone) || null }
    case 'social_handle':
      return { social_handle: t(f.social_handle) || null }
    case 'tagline':
      return { tagline: t(f.tagline) || null }
    case 'reply_to_email':
      return { reply_to_email: t(f.reply_to_email) || null }
  }
}

function norm(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function fieldMatchesProfile(key: FormKey, f: FormState, p: ArtistProfile): boolean {
  const partial = buildPartial(key, f)
  const k = Object.keys(partial)[0] as keyof typeof partial
  return norm(partial[k]) === norm(p[k as keyof ArtistProfile])
}

function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'bg-neutral-900 border border-neutral-800 rounded-lg p-4 sm:p-5 md:p-6 space-y-4 md:space-y-5',
        className
      )}
    >
      <header className="space-y-1 border-b border-neutral-800/80 pb-3 md:pb-4">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-100">{title}</h2>
        <p className="text-xs text-neutral-500 leading-relaxed max-w-prose">{description}</p>
      </header>
      {children}
    </section>
  )
}

export default function Settings() {
  const { profile, loading, updateProfile } = useArtistProfile()
  const { presetsFor, addPreset, deletePreset } = useProfileFieldPresets(profile?.user_id ?? null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const lastHydratedUserId = useRef<string | null>(null)
  const savingRef = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [icsTestSending, setIcsTestSending] = useState(false)

  const showToast = useCallback((msg: string, type: 'ok' | 'err') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    if (!profile) {
      lastHydratedUserId.current = null
      return
    }
    if (lastHydratedUserId.current === profile.user_id) return
    setForm(formFromProfile(profile))
    lastHydratedUserId.current = profile.user_id
  }, [profile])

  const setField = (key: FormKey, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const saveField = useCallback(
    async (key: FormKey, state: FormState) => {
      if (!profile || savingRef.current) return
      if (fieldMatchesProfile(key, state, profile)) return
      savingRef.current = true
      const partial = buildPartial(key, state)
      const result = await updateProfile(partial)
      savingRef.current = false
      if (result && 'error' in result && result.error) {
        showToast(result.error.message || 'Could not save. Try again.', 'err')
        return
      }
      const pk = Object.keys(partial)[0] as keyof typeof partial
      const stored = partial[pk] as string | null | undefined
      const presetKey = key as ProfileFieldPresetKey
      const presetRes = await addPreset(presetKey, stored)
      if (!presetRes.ok && 'error' in presetRes && presetRes.error) {
        console.warn('profile_field_preset insert failed', presetRes.error)
      }
      showToast('Saved', 'ok')
    },
    [profile, updateProfile, showToast, addPreset]
  )

  const handleFieldBlur = useCallback(
    (key: FormKey) => () => {
      void saveField(key, form)
    },
    [saveField, form]
  )

  const applyPreset = useCallback(
    (key: FormKey, value: string) => {
      setForm(prev => {
        const next = { ...prev, [key]: value }
        void saveField(key, next)
        return next
      })
    },
    [saveField]
  )

  const handleDeletePreset = useCallback(
    async (id: string) => {
      const res = await deletePreset(id)
      if ('error' in res && res.error) {
        showToast(res.error.message || 'Could not remove saved value.', 'err')
      }
    },
    [deletePreset, showToast]
  )

  const presetControls = (key: FormKey) => ({
    presets: presetsFor(key as ProfileFieldPresetKey),
    onApplyPreset: (v: string) => applyPreset(key, v),
    onDeletePreset: handleDeletePreset,
  })

  const sendDevIcsTest = useCallback(async () => {
    setIcsTestSending(true)
    try {
      const { ok, message } = await sendDevIcsTestEmail()
      showToast(message, ok ? 'ok' : 'err')
    } catch {
      showToast('Network error. Try again.', 'err')
    } finally {
      setIcsTestSending(false)
    }
  }, [showToast])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
      </div>
    )
  }

  const fieldGrid = 'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 md:gap-y-4'
  const fieldFull = 'sm:col-span-2'
  const hint = 'text-xs text-neutral-600 leading-snug'
  const blur = (key: FormKey) => handleFieldBlur(key)

  return (
    <div className="max-w-5xl mx-auto">
      {toast && (
        <div
          className={cn(
            'fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg border',
            toast.type === 'ok'
              ? 'bg-neutral-900 border-emerald-500/30 text-emerald-400'
              : 'bg-neutral-900 border-red-500/30 text-red-400'
          )}
          role="status"
        >
          {toast.msg}
        </div>
      )}

      <p className="text-xs text-neutral-500 mb-5 md:mb-6 max-w-2xl leading-relaxed">
        Artist details, outbound email identity, and report defaults. Each field saves when you leave it (click outside or tab away).
      </p>

      <div className="grid grid-cols-1 gap-y-6 md:gap-y-8 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-8 lg:items-start">
        <SectionCard
          title="Artist profile"
          description="Used throughout the dashboard and in generated reports."
          className="lg:col-start-1 lg:row-start-1"
        >
          <div className={fieldGrid}>
            <div className="space-y-1">
              <Label>Artist name</Label>
              <FieldWithPresets
                value={form.artist_name}
                onChange={v => setField('artist_name', v)}
                onBlur={blur('artist_name')}
                placeholder="DJ Luijay"
                {...presetControls('artist_name')}
              />
            </div>
            <div className="space-y-1">
              <Label>Artist email</Label>
              <FieldWithPresets
                type="email"
                value={form.artist_email}
                onChange={v => setField('artist_email', v)}
                onBlur={blur('artist_email')}
                placeholder="artist@example.com"
                {...presetControls('artist_email')}
              />
            </div>
            <p className={cn(hint, fieldFull)}>
              Reports are sent to the artist email.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Brand identity"
          description="Used in automated emails sent to venues and contacts on behalf of the artist."
          className="lg:col-start-2 lg:row-start-1 lg:row-span-2"
        >
          <div className={fieldGrid}>
            <div className="space-y-1">
              <Label>Company name</Label>
              <FieldWithPresets
                value={form.company_name}
                onChange={v => setField('company_name', v)}
                onBlur={blur('company_name')}
                placeholder="DJ Luijay LLC"
                {...presetControls('company_name')}
              />
              <p className={hint}>Sender name in venue emails. Defaults to artist name if blank.</p>
            </div>
            <div className="space-y-1">
              <Label>Reply-to email</Label>
              <FieldWithPresets
                type="email"
                value={form.reply_to_email}
                onChange={v => setField('reply_to_email', v)}
                onBlur={blur('reply_to_email')}
                placeholder="management@djluijay.live"
                {...presetControls('reply_to_email')}
              />
              <p className={hint}>Real inbox for replies — not the automated send address.</p>
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <FieldWithPresets
                value={form.website}
                onChange={v => setField('website', v)}
                onBlur={blur('website')}
                placeholder="https://djluijay.com"
                {...presetControls('website')}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <FieldWithPresets
                value={form.phone}
                onChange={v => setField('phone', v)}
                onBlur={blur('phone')}
                placeholder="+1 (555) 000-0000"
                {...presetControls('phone')}
              />
            </div>
            <div className={cn('space-y-1', fieldFull)}>
              <Label>Social handle</Label>
              <FieldWithPresets
                value={form.social_handle}
                onChange={v => setField('social_handle', v)}
                onBlur={blur('social_handle')}
                placeholder="@djluijay"
                {...presetControls('social_handle')}
              />
            </div>
            <div className={cn('space-y-1', fieldFull)}>
              <Label>Tagline</Label>
              <FieldWithPresets
                multiline
                rows={2}
                value={form.tagline}
                onChange={v => setField('tagline', v)}
                onBlur={blur('tagline')}
                placeholder="DJ and Producer"
                {...presetControls('tagline')}
              />
              <p className={hint}>Short line under the brand name in email headers.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Report settings"
          description="Used in management reports sent to the artist."
          className="lg:col-start-1 lg:row-start-2"
        >
          <div className={fieldGrid}>
            <div className="space-y-1">
              <Label>Your name (manager)</Label>
              <FieldWithPresets
                value={form.manager_name}
                onChange={v => setField('manager_name', v)}
                onBlur={blur('manager_name')}
                placeholder="Your name"
                {...presetControls('manager_name')}
              />
            </div>
            <div className="space-y-1">
              <Label>Your title</Label>
              <FieldWithPresets
                value={form.manager_title}
                onChange={v => setField('manager_title', v)}
                onBlur={blur('manager_title')}
                placeholder="Artist Manager"
                {...presetControls('manager_title')}
              />
              <p className={hint}>Shown in email footers with your name so recipients know who they are talking to.</p>
            </div>
            <div className="space-y-1">
              <Label>Your email (manager)</Label>
              <FieldWithPresets
                type="email"
                value={form.manager_email}
                onChange={v => setField('manager_email', v)}
                onBlur={blur('manager_email')}
                placeholder="you@example.com"
                {...presetControls('manager_email')}
              />
            </div>
            <p className={cn(hint, fieldFull)}>Used for CC on reports and test sends.</p>
            <div className={cn('space-y-1', fieldFull)}>
              <Label>Send reports from</Label>
              <FieldWithPresets
                type="email"
                value={form.from_email}
                onChange={v => setField('from_email', v)}
                onBlur={blur('from_email')}
                placeholder="management@updates.djluijay.live"
                {...presetControls('from_email')}
              />
              <p className={hint}>
                Must be a verified sender on Resend. Used for all outgoing email.
              </p>
            </div>
          </div>
        </SectionCard>

        {isIcsDevToolEnabled() && (
          <SectionCard
            title="Developer (ICS test)"
            description="Internal / experimental. Sends a sample calendar file to your manager email for validating Add to calendar on a real device. Requires manager email (or artist email) and a verified Send from address in Report settings."
            className="lg:col-span-2"
          >
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={icsTestSending}
              onClick={() => void sendDevIcsTest()}
            >
              {icsTestSending ? 'Sending…' : 'Send test .ics to manager email'}
            </Button>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
