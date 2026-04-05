import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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

  return (
    <div className="max-w-lg space-y-8">

      {/* Artist profile */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Artist profile</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Used throughout the dashboard and in generated reports.</p>
        </div>
        <div className="space-y-3">
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
            <p className="text-xs text-neutral-600">Reports are sent to this address.</p>
          </div>
        </div>
      </section>

      {/* DJ Luijay brand identity */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Brand identity</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Used in automated emails sent to venues and contacts on behalf of the artist.</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Company name</Label>
            <Input
              value={form.company_name}
              onChange={e => setField('company_name', e.target.value)}
              placeholder="DJ Luijay LLC"
            />
            <p className="text-xs text-neutral-600">Appears as the sender name in venue emails. Defaults to the artist name if left blank.</p>
          </div>
          <div className="space-y-1">
            <Label>Reply-to email</Label>
            <Input
              type="email"
              value={form.reply_to_email}
              onChange={e => setField('reply_to_email', e.target.value)}
              placeholder="management@djluijay.live"
            />
            <p className="text-xs text-neutral-600">Venues will reply to this address. Use your real inbox, not the no-reply send address.</p>
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
          <div className="space-y-1">
            <Label>Social handle</Label>
            <Input
              value={form.social_handle}
              onChange={e => setField('social_handle', e.target.value)}
              placeholder="@djluijay"
            />
          </div>
          <div className="space-y-1">
            <Label>Tagline</Label>
            <Textarea
              value={form.tagline}
              onChange={e => setField('tagline', e.target.value)}
              placeholder="DJ and Producer"
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-neutral-600">Short line shown under the brand name in email headers.</p>
          </div>
        </div>
      </section>

      {/* Manager / report settings */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Report settings</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Used in management reports sent to the artist.</p>
        </div>
        <div className="space-y-3">
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
            <p className="text-xs text-neutral-600">Used for CC on reports and test sends.</p>
          </div>
          <div className="space-y-1">
            <Label>Send reports from</Label>
            <Input
              type="email"
              value={form.from_email}
              onChange={e => setField('from_email', e.target.value)}
              placeholder="management@updates.djluijay.live"
            />
            <p className="text-xs text-neutral-600">Must be a verified sender address on your Resend account. Used for all outgoing emails.</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
        {saved && <span className="text-xs text-green-400">Saved.</span>}
      </div>
    </div>
  )
}
