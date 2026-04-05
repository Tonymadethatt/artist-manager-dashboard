import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Settings() {
  const { profile, loading, updateProfile } = useArtistProfile()
  const [form, setForm] = useState({
    artist_name: '',
    artist_email: '',
    manager_name: '',
    from_email: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        artist_name: profile.artist_name,
        artist_email: profile.artist_email,
        manager_name: profile.manager_name ?? '',
        from_email: profile.from_email,
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
      from_email: form.from_email,
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

      {/* Manager / report settings */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Report settings</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Used in the email signature and as the sender address.</p>
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
            <Label>Send reports from</Label>
            <Input
              type="email"
              value={form.from_email}
              onChange={e => setField('from_email', e.target.value)}
              placeholder="management@djluijay.live"
            />
            <p className="text-xs text-neutral-600">Must be a verified sender address on your Resend account.</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {saved && <span className="text-xs text-green-400">Saved.</span>}
      </div>
    </div>
  )
}
