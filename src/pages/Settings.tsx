import { useState, useEffect, type ReactNode } from 'react'
import { Save } from 'lucide-react'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

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
  const [form, setForm] = useState({
    artist_name: '',
    artist_email: '',
    manager_name: '',
    manager_email: '',
    from_email: '',
    company_name: '',
    website: '',
    phone: '',
    social_handle: '',
    tagline: '',
    reply_to_email: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        artist_name: profile.artist_name,
        artist_email: profile.artist_email,
        manager_name: profile.manager_name ?? '',
        manager_email: profile.manager_email ?? '',
        from_email: profile.from_email,
        company_name: profile.company_name ?? '',
        website: profile.website ?? '',
        phone: profile.phone ?? '',
        social_handle: profile.social_handle ?? '',
        tagline: profile.tagline ?? '',
        reply_to_email: profile.reply_to_email ?? '',
      })
    }
  }, [profile])

  const setField = (key: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({
      artist_name: form.artist_name,
      artist_email: form.artist_email,
      manager_name: form.manager_name || null,
      manager_email: form.manager_email || null,
      from_email: form.from_email,
      company_name: form.company_name || null,
      website: form.website || null,
      phone: form.phone || null,
      social_handle: form.social_handle || null,
      tagline: form.tagline || null,
      reply_to_email: form.reply_to_email || null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

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

  return (
    <div className="max-w-5xl mx-auto">
      <p className="text-xs text-neutral-500 mb-5 md:mb-6 max-w-2xl leading-relaxed">
        Artist details, outbound email identity, and report defaults. Changes apply across the dashboard and emails.
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
              <Input
                value={form.artist_name}
                onChange={e => setField('artist_name', e.target.value)}
                placeholder="DJ Luijay"
              />
            </div>
            <div className="space-y-1">
              <Label>Artist email</Label>
              <Input
                type="email"
                value={form.artist_email}
                onChange={e => setField('artist_email', e.target.value)}
                placeholder="artist@example.com"
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
              <Input
                value={form.company_name}
                onChange={e => setField('company_name', e.target.value)}
                placeholder="DJ Luijay LLC"
              />
              <p className={hint}>Sender name in venue emails. Defaults to artist name if blank.</p>
            </div>
            <div className="space-y-1">
              <Label>Reply-to email</Label>
              <Input
                type="email"
                value={form.reply_to_email}
                onChange={e => setField('reply_to_email', e.target.value)}
                placeholder="management@djluijay.live"
              />
              <p className={hint}>Real inbox for replies — not the automated send address.</p>
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={e => setField('website', e.target.value)}
                placeholder="https://djluijay.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={e => setField('phone', e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className={cn('space-y-1', fieldFull)}>
              <Label>Social handle</Label>
              <Input
                value={form.social_handle}
                onChange={e => setField('social_handle', e.target.value)}
                placeholder="@djluijay"
              />
            </div>
            <div className={cn('space-y-1', fieldFull)}>
              <Label>Tagline</Label>
              <Textarea
                value={form.tagline}
                onChange={e => setField('tagline', e.target.value)}
                placeholder="DJ and Producer"
                rows={2}
                className="resize-none min-h-[4.5rem]"
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
              <Input
                value={form.manager_name}
                onChange={e => setField('manager_name', e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1">
              <Label>Your email (manager)</Label>
              <Input
                type="email"
                value={form.manager_email}
                onChange={e => setField('manager_email', e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <p className={cn(hint, fieldFull)}>Used for CC on reports and test sends.</p>
            <div className={cn('space-y-1', fieldFull)}>
              <Label>Send reports from</Label>
              <Input
                type="email"
                value={form.from_email}
                onChange={e => setField('from_email', e.target.value)}
                placeholder="management@updates.djluijay.live"
              />
              <p className={hint}>
                Must be a verified sender on Resend. Used for all outgoing email.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-8 lg:mt-10 flex flex-col sm:flex-row sm:items-center gap-3 pt-6 border-t border-neutral-800/90">
        <Button onClick={handleSave} disabled={saving} className="sm:w-auto w-full sm:min-w-[140px]">
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
        {saved && <span className="text-xs text-green-400">Saved.</span>}
      </div>
    </div>
  )
}
