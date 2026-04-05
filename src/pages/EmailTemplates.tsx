import { useState, useMemo, useEffect } from 'react'
import { RotateCcw, Save, Monitor } from 'lucide-react'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'
import {
  buildVenueEmailHtml,
  PREVIEW_MOCK_PROFILE,
  PREVIEW_MOCK_RECIPIENT,
  PREVIEW_MOCK_VENUE,
  PREVIEW_MOCK_DEAL,
  type PreviewEmailType,
} from '@/lib/buildVenueEmailHtml'
import { cn } from '@/lib/utils'

const EMAIL_TYPE_DESCRIPTIONS: Record<VenueEmailType, string> = {
  booking_confirmation: 'Sent when a deal is created. Confirms booking details.',
  booking_confirmed: 'Final confirmed notice with event details and next steps.',
  agreement_ready: 'Notifies venue the agreement is ready, includes the link.',
  payment_reminder: 'Friendly reminder about an outstanding payment.',
  payment_receipt: 'Confirms payment has been received.',
  follow_up: 'Check-in to venues that haven\'t responded.',
}

const DEFAULT_SUBJECTS: Record<VenueEmailType, string> = {
  booking_confirmation: 'Booking Confirmation - {artist} at {venue}',
  booking_confirmed: 'Booking Confirmed - {artist} | {venue}',
  agreement_ready: 'Agreement Ready for Review - {artist}',
  payment_reminder: 'Payment Reminder - {artist}',
  payment_receipt: 'Payment Received - Thank You | {artist}',
  follow_up: 'Following Up - {artist}',
}

const EMAIL_TYPE_ORDER: VenueEmailType[] = [
  'follow_up',
  'booking_confirmation',
  'agreement_ready',
  'booking_confirmed',
  'payment_reminder',
  'payment_receipt',
]

export default function EmailTemplates() {
  const { loading, upsertTemplate, resetTemplate, getTemplate } = useEmailTemplates()
  const [selectedType, setSelectedType] = useState<VenueEmailType>('follow_up')
  const [editSubject, setEditSubject] = useState('')
  const [editIntro, setEditIntro] = useState('')
  const [saving, setSaving] = useState(false)
  const [resetConfirm, setResetConfirm] = useState<VenueEmailType | null>(null)
  const [saved, setSaved] = useState(false)

  const savedTmpl = getTemplate(selectedType)
  const hasCustom = !!(savedTmpl?.custom_subject || savedTmpl?.custom_intro)

  // Sync edit fields when selected type changes
  useEffect(() => {
    const tmpl = getTemplate(selectedType)
    setEditSubject(tmpl?.custom_subject ?? '')
    setEditIntro(tmpl?.custom_intro ?? '')
    setSaved(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType])

  // Also sync when saved template changes (after save/reset)
  useEffect(() => {
    setEditSubject(savedTmpl?.custom_subject ?? '')
    setEditIntro(savedTmpl?.custom_intro ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTmpl?.custom_subject, savedTmpl?.custom_intro])

  // Live preview HTML — rebuilds on any edit input change
  const previewHtml = useMemo(() => {
    return buildVenueEmailHtml(
      selectedType as PreviewEmailType,
      PREVIEW_MOCK_PROFILE,
      PREVIEW_MOCK_RECIPIENT,
      PREVIEW_MOCK_DEAL,
      PREVIEW_MOCK_VENUE,
      editIntro.trim() || null,
      editSubject.trim() || null,
    )
  }, [selectedType, editSubject, editIntro])

  const isDirty = (
    (editSubject.trim() || null) !== (savedTmpl?.custom_subject ?? null) ||
    (editIntro.trim() || null) !== (savedTmpl?.custom_intro ?? null)
  )

  const handleSave = async () => {
    setSaving(true)
    await upsertTemplate(selectedType, {
      custom_subject: editSubject.trim() || null,
      custom_intro: editIntro.trim() || null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async (emailType: VenueEmailType) => {
    await resetTemplate(emailType)
    setResetConfirm(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="mb-5 shrink-0">
        <h1 className="text-base font-semibold text-white">Email Templates</h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Customize the subject and opening paragraph for each email type. The preview updates live.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* Left: email type selector */}
        <div className="w-[240px] shrink-0 flex flex-col gap-1.5 overflow-y-auto">
          {EMAIL_TYPE_ORDER.map(emailType => {
            const tmpl = getTemplate(emailType)
            const isCustom = !!(tmpl?.custom_subject || tmpl?.custom_intro)
            const isSelected = selectedType === emailType

            return (
              <button
                key={emailType}
                onClick={() => setSelectedType(emailType)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg border transition-all',
                  isSelected
                    ? 'bg-neutral-800 border-neutral-600'
                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-medium truncate',
                    isSelected ? 'text-white' : 'text-neutral-300'
                  )}>
                    {VENUE_EMAIL_TYPE_LABELS[emailType]}
                  </span>
                  {isCustom && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/60 text-blue-400 border border-blue-800/60 font-medium shrink-0">
                      Custom
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-600 mt-0.5 leading-snug line-clamp-2">
                  {EMAIL_TYPE_DESCRIPTIONS[emailType]}
                </p>
              </button>
            )
          })}
        </div>

        {/* Right: preview + edit */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">

          {/* Preview frame */}
          <div className="flex-1 min-h-0 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 border-b border-neutral-800 flex items-center gap-2 shrink-0">
              <Monitor className="h-3.5 w-3.5 text-neutral-500" />
              <span className="text-xs font-medium text-neutral-400">
                Preview - {VENUE_EMAIL_TYPE_LABELS[selectedType]}
              </span>
              <span className="text-[10px] text-neutral-600 ml-auto">
                Mock data: Alex Johnson / Skyline Bar &amp; Lounge
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <iframe
                key={selectedType}
                srcDoc={previewHtml}
                title={`Email preview - ${selectedType}`}
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </div>

          {/* Edit form */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Customize
              </span>
              <div className="flex items-center gap-2">
                {hasCustom && (
                  <button
                    onClick={() => setResetConfirm(selectedType)}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-500 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to default
                  </button>
                )}
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="h-7 text-xs gap-1.5"
                >
                  <Save className="h-3 w-3" />
                  {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Subject line</Label>
                <Input
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  placeholder={DEFAULT_SUBJECTS[selectedType]}
                  className="text-sm"
                />
                <p className="text-[10px] text-neutral-600">
                  Leave blank to use the default subject.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Opening paragraph</Label>
                <textarea
                  value={editIntro}
                  onChange={e => setEditIntro(e.target.value)}
                  placeholder="Write a custom intro that appears at the top of the email..."
                  rows={3}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none"
                />
                <p className="text-[10px] text-neutral-600">
                  The type-specific content always renders below this.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset confirmation dialog */}
      <Dialog open={!!resetConfirm} onOpenChange={v => !v && setResetConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset to default?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400">
            Your custom subject and intro for{' '}
            <span className="text-neutral-200">
              {resetConfirm ? VENUE_EMAIL_TYPE_LABELS[resetConfirm] : ''}
            </span>{' '}
            will be cleared.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => resetConfirm && handleReset(resetConfirm)}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
