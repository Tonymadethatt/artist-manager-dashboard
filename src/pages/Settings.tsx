import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useProfileFieldPresets } from '@/hooks/useProfileFieldPresets'
import { FieldWithPresets } from '@/components/settings/FieldWithPresets'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  EMAIL_QUEUE_BUFFER_OPTIONS,
  clampEmailQueueBufferMinutes,
  type EmailQueueBufferMinutes,
} from '@/lib/emailQueueBuffer'
import { GoogleCalendarSettingsCard } from '@/components/settings/GoogleCalendarSettingsCard'
import type { ArtistProfile, ProfileFieldPresetKey } from '@/types'

type FormState = {
  artist_name: string
  artist_email: string
  manager_name: string
  manager_title: string
  manager_email: string
  manager_phone: string
  from_email: string
  company_name: string
  website: string
  phone: string
  social_handle: string
  tagline: string
  reply_to_email: string
  email_test_artist_inbox: string
  email_test_client_inbox: string
}

type FormKey = keyof FormState

const EMPTY_FORM: FormState = {
  artist_name: '',
  artist_email: '',
  manager_name: '',
  manager_title: '',
  manager_email: '',
  manager_phone: '',
  from_email: '',
  company_name: '',
  website: '',
  phone: '',
  social_handle: '',
  tagline: '',
  reply_to_email: '',
  email_test_artist_inbox: '',
  email_test_client_inbox: '',
}

function formFromProfile(p: ArtistProfile): FormState {
  return {
    artist_name: p.artist_name,
    artist_email: p.artist_email,
    manager_name: p.manager_name ?? '',
    manager_title: p.manager_title ?? '',
    manager_email: p.manager_email ?? '',
    manager_phone: p.manager_phone ?? '',
    from_email: p.from_email,
    company_name: p.company_name ?? '',
    website: p.website ?? '',
    phone: p.phone ?? '',
    social_handle: p.social_handle ?? '',
    tagline: p.tagline ?? '',
    reply_to_email: p.reply_to_email ?? '',
    email_test_artist_inbox: p.email_test_artist_inbox ?? '',
    email_test_client_inbox: p.email_test_client_inbox ?? '',
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
    case 'manager_phone':
      return { manager_phone: t(f.manager_phone) || null }
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
    case 'email_test_artist_inbox':
      return { email_test_artist_inbox: t(f.email_test_artist_inbox) || null }
    case 'email_test_client_inbox':
      return { email_test_client_inbox: t(f.email_test_client_inbox) || null }
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
  const { user } = useAuth()
  const { profile, loading, updateProfile } = useArtistProfile()
  const { presetsFor, addPreset, deletePreset } = useProfileFieldPresets(profile?.user_id ?? null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const lastHydratedUserId = useRef<string | null>(null)
  const savingRef = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [bufferSaving, setBufferSaving] = useState(false)

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
      if (key !== 'email_test_artist_inbox' && key !== 'email_test_client_inbox') {
        const presetKey = key as ProfileFieldPresetKey
        const presetRes = await addPreset(presetKey, stored)
        if (!presetRes.ok && 'error' in presetRes && presetRes.error) {
          console.warn('profile_field_preset insert failed', presetRes.error)
        }
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

  const handleEmailQueueBufferChange = useCallback(
    async (value: string) => {
      const n = parseInt(value, 10) as EmailQueueBufferMinutes
      if (!EMAIL_QUEUE_BUFFER_OPTIONS.includes(n) || !profile) return
      setBufferSaving(true)
      const result = await updateProfile({ email_queue_buffer_minutes: n })
      setBufferSaving(false)
      if (result && 'error' in result && result.error) {
        showToast(result.error.message || 'Could not save.', 'err')
        return
      }
      showToast('Saved', 'ok')
    },
    [profile, updateProfile, showToast]
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
      </div>
    )
  }

  const emailQueueBufferMinutes = profile
    ? clampEmailQueueBufferMinutes(profile.email_queue_buffer_minutes)
    : EMAIL_QUEUE_BUFFER_OPTIONS[1]

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
            <div className="space-y-1">
              <Label>Your phone (manager)</Label>
              <FieldWithPresets
                value={form.manager_phone}
                onChange={v => setField('manager_phone', v)}
                onBlur={blur('manager_phone')}
                placeholder="+1 (555) 000-0000"
                {...presetControls('manager_phone')}
              />
              <p className={hint}>Used in agreements as the manager phone merge field.</p>
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

        <GoogleCalendarSettingsCard userId={user?.id ?? null} showToast={showToast} />

        <SectionCard
          title="Email test mode"
          description="When test mode is on (toggle in the sidebar), every outbound send is delivered only to these two addresses—never to real venue contacts or the artist inbox. Use safe mailboxes you control. Subjects are prefixed with [TEST]."
          className="lg:col-span-2"
        >
          <div className={fieldGrid}>
            <div className="space-y-1">
              <Label htmlFor="test-artist-inbox">Artist-facing test inbox</Label>
              <Input
                id="test-artist-inbox"
                type="email"
                autoComplete="email"
                className="h-9 text-sm bg-neutral-950 border-neutral-700"
                value={form.email_test_artist_inbox}
                onChange={e => setField('email_test_artist_inbox', e.target.value)}
                onBlur={blur('email_test_artist_inbox')}
                placeholder="you+test-artist@example.com"
              />
              <p className={hint}>Receives reports, gig calendar, performance form links, retainers, etc.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="test-client-inbox">Client / venue test inbox</Label>
              <Input
                id="test-client-inbox"
                type="email"
                autoComplete="email"
                className="h-9 text-sm bg-neutral-950 border-neutral-700"
                value={form.email_test_client_inbox}
                onChange={e => setField('email_test_client_inbox', e.target.value)}
                onBlur={blur('email_test_client_inbox')}
                placeholder="you+test-venue@example.com"
              />
              <p className={hint}>Receives outreach, agreements, invoices, and other venue-targeted mail.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Email queue"
          description="How long venue-targeted emails wait in the queue before the automated sender picks them up. Artist and gig automations (reminders, booked-gig notices, digest, custom artist templates, etc.) are not governed by this—they send on the next queue run or at their scheduled time."
          className="lg:col-span-2"
        >
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div className="space-y-1">
              <Label htmlFor="email-queue-buffer">Delay for venue outreach (minutes)</Label>
              <Select
                value={String(emailQueueBufferMinutes)}
                onValueChange={handleEmailQueueBufferChange}
                disabled={bufferSaving || !profile}
              >
                <SelectTrigger
                  id="email-queue-buffer"
                  className="w-[140px] h-9 text-sm bg-neutral-950 border-neutral-700"
                  aria-label="Minutes to wait after queue before auto-sending venue emails"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_QUEUE_BUFFER_OPTIONS.map(m => (
                    <SelectItem key={m} value={String(m)} className="text-sm">
                      {m} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className={cn(hint, 'sm:pb-1 flex-1 max-w-xl')}>
              Use this when you want a short pause to cancel mistaken venue sends. Open Email queue to see pending rows; the list refreshes about every 30 seconds while the Queue tab is open.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
