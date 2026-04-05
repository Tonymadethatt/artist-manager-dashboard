import { useState } from 'react'
import { Pencil, RotateCcw, Check } from 'lucide-react'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'

const EMAIL_TYPE_DESCRIPTIONS: Record<VenueEmailType, string> = {
  booking_confirmation: 'Sent when a deal is created. Confirms the booking details and mentions that a formal agreement will follow.',
  booking_confirmed: 'Sent when a booking is fully confirmed. Final notice with event details and what comes next.',
  agreement_ready: 'Sent when the agreement is ready. Includes a link to the document for the venue to review.',
  payment_reminder: 'Sent when payment is approaching or overdue. A friendly reminder about the outstanding amount.',
  payment_receipt: 'Sent when payment is received. Confirms the payment and thanks the venue.',
  follow_up: 'Sent as a check-in to venues that have not responded. Keeps the conversation going.',
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

interface EditDialogState {
  emailType: VenueEmailType
  subject: string
  intro: string
}

export default function EmailTemplates() {
  const { loading, upsertTemplate, resetTemplate, getTemplate } = useEmailTemplates()
  const [editState, setEditState] = useState<EditDialogState | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetConfirm, setResetConfirm] = useState<VenueEmailType | null>(null)

  const openEdit = (emailType: VenueEmailType) => {
    const tmpl = getTemplate(emailType)
    setEditState({
      emailType,
      subject: tmpl?.custom_subject ?? '',
      intro: tmpl?.custom_intro ?? '',
    })
  }

  const handleSave = async () => {
    if (!editState) return
    setSaving(true)
    await upsertTemplate(editState.emailType, {
      custom_subject: editState.subject.trim() || null,
      custom_intro: editState.intro.trim() || null,
    })
    setSaving(false)
    setEditState(null)
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
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-base font-semibold text-white">Email Templates</h1>
        <p className="text-xs text-neutral-500 mt-1">
          Customize the subject line and opening paragraph for each email type. Leave blank to use the default copy.
        </p>
      </div>

      <div className="space-y-3">
        {EMAIL_TYPE_ORDER.map(emailType => {
          const tmpl = getTemplate(emailType)
          const hasCustom = !!(tmpl?.custom_subject || tmpl?.custom_intro)

          return (
            <div
              key={emailType}
              className="bg-neutral-900 border border-neutral-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-neutral-200">
                      {VENUE_EMAIL_TYPE_LABELS[emailType]}
                    </span>
                    {hasCustom && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/60 text-blue-400 border border-blue-800 font-medium">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    {EMAIL_TYPE_DESCRIPTIONS[emailType]}
                  </p>
                  {tmpl?.custom_subject && (
                    <p className="text-xs text-neutral-400 mt-2 font-mono truncate">
                      Subject: {tmpl.custom_subject}
                    </p>
                  )}
                  {tmpl?.custom_intro && (
                    <p className="text-xs text-neutral-600 mt-1 truncate italic">
                      Intro: {tmpl.custom_intro}
                    </p>
                  )}
                  {!hasCustom && (
                    <p className="text-[11px] text-neutral-600 mt-2">
                      Using default: <span className="italic">{DEFAULT_SUBJECTS[emailType]}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasCustom && (
                    <button
                      onClick={() => setResetConfirm(emailType)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-500 transition-colors"
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(emailType)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editState} onOpenChange={v => !v && setEditState(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit - {editState ? VENUE_EMAIL_TYPE_LABELS[editState.emailType] : ''}
            </DialogTitle>
          </DialogHeader>

          {editState && (
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label>Subject line</Label>
                <Input
                  value={editState.subject}
                  onChange={e => setEditState(s => s ? { ...s, subject: e.target.value } : null)}
                  placeholder={DEFAULT_SUBJECTS[editState.emailType]}
                />
                <p className="text-[11px] text-neutral-600">
                  Leave blank to use the default subject.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Opening paragraph</Label>
                <textarea
                  value={editState.intro}
                  onChange={e => setEditState(s => s ? { ...s, intro: e.target.value } : null)}
                  placeholder="Write a custom intro paragraph that appears at the top of the email body..."
                  rows={5}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none"
                />
                <p className="text-[11px] text-neutral-600">
                  Leave blank to use the default intro. The type-specific details (deal info, agreement link, etc.) always appear below.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditState(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Check className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation dialog */}
      <Dialog open={!!resetConfirm} onOpenChange={v => !v && setResetConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset to default?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400">
            Your custom subject and intro for{' '}
            <span className="text-neutral-200">{resetConfirm ? VENUE_EMAIL_TYPE_LABELS[resetConfirm] : ''}</span>{' '}
            will be cleared. The default copy will be used instead.
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
