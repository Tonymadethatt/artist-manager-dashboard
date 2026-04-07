import { useState, useRef, useEffect } from 'react'
import {
  X, Pencil, Trash2, Plus, Star, Send, Phone, Mail, User,
  ChevronDown, ChevronRight, DollarSign, Calendar, Clock, MailCheck, MailPlus,
  ClipboardList, CheckCircle2, AlertTriangle
} from 'lucide-react'
import { useVenueDetail } from '@/hooks/useVenues'
import { useVenueEmails } from '@/hooks/useVenueEmails'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { usePerformanceReports } from '@/hooks/usePerformanceReports'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { StatusBadge } from './StatusBadge'
import { VenueDialog } from './VenueDialog'
import { SendVenueEmailModal } from '@/components/emails/SendVenueEmailModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { Venue, OutreachStatus, OutreachTrack, Contact, DealTerms } from '@/types'
import { OUTREACH_STATUS_LABELS, OUTREACH_STATUS_ORDER, OUTREACH_TRACK_LABELS, OUTREACH_TRACK_ORDER } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  venue: Venue
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Omit<Venue, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<{ data?: Venue; error?: unknown }>
  onDelete: (id: string) => Promise<void>
}

export function VenueDetailPanel({ venue, onClose, onUpdate, onDelete }: Props) {
  const { contacts, notes, loading, addContact, updateContact, deleteContact, addNote } = useVenueDetail(venue.id)
  const { queueEmail } = useVenueEmails()
  const { templates, applyTemplate } = useTaskTemplates()
  const { reports: perfReports, createReport } = usePerformanceReports()
  const { profile } = useArtistProfile()
  const [editOpen, setEditOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [showContacts, setShowContacts] = useState(true)
  const [showDealTerms, setShowDealTerms] = useState(venue.status === 'booked')
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [dealTerms, setDealTerms] = useState<DealTerms>(venue.deal_terms ?? {})
  const [savingDeal, setSavingDeal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sendEmailOpen, setSendEmailOpen] = useState(false)
  const [sendEmailType, setSendEmailType] = useState<'booking_confirmation' | 'follow_up'>('booking_confirmation')
  const [queuedFollowUp, setQueuedFollowUp] = useState(false)
  const [queuingFollowUp, setQueuingFollowUp] = useState(false)
  const [autoApplyMsg, setAutoApplyMsg] = useState<string | null>(null)
  const [showPerfReports, setShowPerfReports] = useState(false)
  const [sendingPerfForm, setSendingPerfForm] = useState(false)
  const [perfFormMsg, setPerfFormMsg] = useState<string | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const venueReports = perfReports.filter(r => r.venue_id === venue.id)
  const showSendFormBtn = ['booked','performed','post_follow_up','rebooking'].includes(venue.status)

  const handleSendPerfForm = async () => {
    if (!profile) return
    setSendingPerfForm(true)
    const eventDate = venue.deal_terms?.event_date ?? null
    const { error } = await createReport(venue.id, null, profile, venue.name, eventDate)
    setSendingPerfForm(false)
    setPerfFormMsg(error && !error.includes('email failed') ? `Error: ${error}` : 'Performance form sent to artist.')
    setTimeout(() => setPerfFormMsg(null), 3000)
  }

  const primaryContact = contacts.find(c => c.email) ?? null
  const today = new Date().toISOString().split('T')[0]
  const followUpPast = !!venue.follow_up_date && venue.follow_up_date <= today
  const isOpenStatus = venue.status === 'reached_out' || venue.status === 'in_discussion'

  const handleQueueFollowUp = async () => {
    if (!primaryContact?.email) return
    setQueuingFollowUp(true)
    await queueEmail({
      venue_id: venue.id,
      email_type: 'follow_up',
      recipient_email: primaryContact.email,
      subject: `Following Up - ${venue.name}`,
      notes: `Queued from outreach panel for ${venue.name}`,
    })
    setQueuingFollowUp(false)
    setQueuedFollowUp(true)
  }

  useEffect(() => {
    setDealTerms(venue.deal_terms ?? {})
    setShowDealTerms(venue.status === 'booked')
  }, [venue])

  const handleStatusChange = async (status: OutreachStatus) => {
    await onUpdate(venue.id, { status })
    // Auto-apply any template that triggers on this status
    const matching = templates.filter(t => t.trigger_status === status)
    if (matching.length > 0) {
      let totalTasks = 0
      let emailsQueued = 0
      for (const t of matching) {
        const { count, emailsQueued: q } = await applyTemplate(t.id, venue.id)
        totalTasks += count
        emailsQueued += q ?? 0
      }
      if (totalTasks > 0) {
        const emailPart = emailsQueued > 0 ? ` · ${emailsQueued} email${emailsQueued !== 1 ? 's' : ''} queued` : ''
        setAutoApplyMsg(`${totalTasks} task${totalTasks !== 1 ? 's' : ''} created for "${OUTREACH_STATUS_LABELS[status]}"${emailPart}`)
        setTimeout(() => setAutoApplyMsg(null), 4000)
      }
    }
  }

  const handleFollowUpChange = async (date: string) => {
    await onUpdate(venue.id, { follow_up_date: date || null })
  }

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    await addNote(venue.id, noteText.trim())
    setNoteText('')
    setAddingNote(false)
  }

  const handleSaveDeal = async () => {
    setSavingDeal(true)
    await onUpdate(venue.id, { deal_terms: dealTerms })
    setSavingDeal(false)
  }

  const fmt = (d: string) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-neutral-900 border-l border-neutral-800 flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-800">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-neutral-100 text-base truncate">{venue.name}</h2>
              <StatusBadge status={venue.status} />
            </div>
            {(venue.city || venue.location) && (
              <p className="text-xs text-neutral-400 mt-0.5">
                {[venue.city, venue.location].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-3 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmDelete(true)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Status + Quick fields */}
          <div className="px-5 py-4 space-y-3 border-b border-neutral-800">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={venue.status} onValueChange={handleStatusChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTREACH_STATUS_ORDER.map(s => (
                      <SelectItem key={s} value={s}>{OUTREACH_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Track</Label>
                <Select
                  value={venue.outreach_track ?? 'pipeline'}
                  onValueChange={v => onUpdate(venue.id, { outreach_track: v as OutreachTrack })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTREACH_TRACK_ORDER.map(t => (
                      <SelectItem key={t} value={t}>{OUTREACH_TRACK_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Follow-up date</Label>
              <Input
                type="date"
                value={venue.follow_up_date ?? ''}
                onChange={e => handleFollowUpChange(e.target.value)}
              />
            </div>

            {/* Auto-apply template toast */}
            {autoApplyMsg && (
              <div className="flex items-center gap-2 bg-green-950/60 border border-green-800 rounded px-3 py-2">
                <span className="text-xs text-green-400">{autoApplyMsg}</span>
              </div>
            )}

            {/* Priority stars */}
            <div className="space-y-1">
              <Label>Priority</Label>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => onUpdate(venue.id, { priority: i + 1 })}
                    className="p-0.5 rounded hover:scale-110 transition-transform"
                  >
                    <Star
                      className={cn(
                        'h-5 w-5 transition-colors',
                        i < venue.priority ? 'fill-neutral-400 text-neutral-400' : 'text-neutral-700 hover:text-neutral-500'
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Email action buttons */}
          {(venue.status === 'booked' || (followUpPast && isOpenStatus)) && (
            <div className="px-5 py-3 border-b border-neutral-800 flex flex-wrap gap-2">
              {venue.status === 'booked' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSendEmailType('booking_confirmation'); setSendEmailOpen(true) }}
                  className="gap-1.5"
                >
                  <MailCheck className="h-3.5 w-3.5" />
                  Send booking confirmation
                </Button>
              )}
              {followUpPast && isOpenStatus && !queuedFollowUp && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleQueueFollowUp}
                  disabled={queuingFollowUp || !primaryContact?.email}
                  className="gap-1.5"
                  title={!primaryContact?.email ? 'Add a contact email first to queue a follow-up' : undefined}
                >
                  <MailPlus className="h-3.5 w-3.5" />
                  {queuingFollowUp ? 'Queuing…' : 'Queue follow-up email'}
                </Button>
              )}
              {queuedFollowUp && (
                <span className="text-xs text-green-400 self-center">Follow-up queued in Email Queue.</span>
              )}
              {followUpPast && isOpenStatus && !primaryContact?.email && (
                <span className="text-xs text-neutral-600 self-center">Add a contact email to enable follow-up queuing.</span>
              )}
            </div>
          )}

          {/* Deal terms (expandable) */}
          <div className="border-b border-neutral-800">
            <button
              className="flex items-center justify-between w-full px-5 py-3 text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
              onClick={() => setShowDealTerms(v => !v)}
            >
              <span className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-neutral-400" />
                Deal terms
              </span>
              <ChevronDown className={cn('h-4 w-4 text-neutral-400 transition-transform', showDealTerms && 'rotate-180')} />
            </button>

            {showDealTerms && (
              <div className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Event date</Label>
                    <Input
                      type="date"
                      value={dealTerms.event_date ?? ''}
                      onChange={e => setDealTerms(d => ({ ...d, event_date: e.target.value || undefined }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> Pay ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={dealTerms.pay ?? ''}
                      onChange={e => setDealTerms(d => ({ ...d, pay: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Set length</Label>
                    <Input
                      value={dealTerms.set_length ?? ''}
                      onChange={e => setDealTerms(d => ({ ...d, set_length: e.target.value || undefined }))}
                      placeholder="45 min"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Load-in time</Label>
                    <Input
                      value={dealTerms.load_in_time ?? ''}
                      onChange={e => setDealTerms(d => ({ ...d, load_in_time: e.target.value || undefined }))}
                      placeholder="6:00 PM"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea
                    value={dealTerms.notes ?? ''}
                    onChange={e => setDealTerms(d => ({ ...d, notes: e.target.value || undefined }))}
                    placeholder="Any additional deal notes…"
                    className="min-h-[60px]"
                  />
                </div>
                <Button size="sm" onClick={handleSaveDeal} disabled={savingDeal}>
                  {savingDeal ? 'Saving…' : 'Save deal terms'}
                </Button>
              </div>
            )}
          </div>

          {/* Contacts (expandable) */}
          <div className="border-b border-neutral-800">
            <button
              className="flex items-center justify-between w-full px-5 py-3 text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
              onClick={() => setShowContacts(v => !v)}
            >
              <span className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-neutral-400" />
                Contacts ({contacts.length})
              </span>
              <ChevronDown className={cn('h-4 w-4 text-neutral-400 transition-transform', showContacts && 'rotate-180')} />
            </button>

            {showContacts && (
              <div className="px-5 pb-4 space-y-3">
                {contacts.length === 0 ? (
                  <p className="text-xs text-neutral-400">No contacts added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {contacts.map(c => (
                      <ContactRow
                        key={c.id}
                        contact={c}
                        onEdit={() => setEditingContact(c)}
                        onDelete={() => deleteContact(c.id)}
                      />
                    ))}
                  </div>
                )}

                {addContactOpen || editingContact ? (
                  <ContactForm
                    initial={editingContact}
                    onSave={async data => {
                      if (editingContact) {
                        await updateContact(editingContact.id, data)
                        setEditingContact(null)
                      } else {
                        await addContact({ ...data, venue_id: venue.id })
                        setAddContactOpen(false)
                      }
                    }}
                    onCancel={() => { setAddContactOpen(false); setEditingContact(null) }}
                  />
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setAddContactOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add contact
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Performance Reports section */}
          {(venueReports.length > 0 || showSendFormBtn) && (
            <div className="px-5 py-4 border-t border-neutral-800">
              <button
                onClick={() => setShowPerfReports(p => !p)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-sm font-medium text-neutral-300">Show Reports</span>
                  {venueReports.length > 0 && (
                    <span className="text-xs text-neutral-500">({venueReports.length})</span>
                  )}
                </div>
                {showPerfReports ? <ChevronDown className="h-3.5 w-3.5 text-neutral-600" /> : <ChevronRight className="h-3.5 w-3.5 text-neutral-600" />}
              </button>

              {showPerfReports && (
                <div className="mt-3 space-y-2">
                  {perfFormMsg && (
                    <p className="text-xs text-emerald-400 mb-2">{perfFormMsg}</p>
                  )}
                  {venueReports.length === 0 ? (
                    <p className="text-xs text-neutral-500">No reports submitted yet.</p>
                  ) : (
                    venueReports.map(r => (
                      <div key={r.id} className={`flex items-center gap-2 rounded border px-3 py-2 text-xs ${r.submitted ? 'border-neutral-700 bg-neutral-800/30' : 'border-neutral-800 bg-neutral-900/30'}`}>
                        {r.submitted
                          ? <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                          : <Clock className="h-3 w-3 text-neutral-600 shrink-0" />}
                        <span className="text-neutral-400 flex-1">
                          {r.submitted ? `Submitted ${r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}` : 'Pending submission'}
                        </span>
                        {r.commission_flagged && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" aria-label="Commission flagged" />}
                        {r.event_rating && <span className="text-neutral-500">{r.event_rating}/5</span>}
                      </div>
                    ))
                  )}

                  {showSendFormBtn && (
                    <button
                      onClick={handleSendPerfForm}
                      disabled={sendingPerfForm}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-neutral-300 transition-all mt-2 disabled:opacity-40"
                    >
                      <ClipboardList className="h-3 w-3" />
                      {sendingPerfForm ? 'Sending...' : 'Send Report Form'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes log */}
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-neutral-300 mb-3">Activity log</p>

            <div className="flex gap-2 mb-4">
              <Textarea
                ref={noteRef}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add a note about this venue…"
                className="min-h-[64px] text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote()
                }}
              />
              <Button
                size="icon"
                onClick={handleAddNote}
                disabled={!noteText.trim() || addingNote}
                className="shrink-0 self-end"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>

            {loading ? (
              <div className="text-xs text-neutral-400">Loading…</div>
            ) : notes.length === 0 ? (
              <p className="text-xs text-neutral-400">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="space-y-0.5">
                    <p className="text-xs text-neutral-400">{fmt(n.created_at)}</p>
                    <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">{n.note}</p>
                    <Separator className="mt-3" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      <VenueDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={async data => {
          const result = await onUpdate(venue.id, data)
          setEditOpen(false)
          return result
        }}
        initialData={venue}
      />

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(false)} />
          <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-100 mb-2">Delete venue?</h3>
            <p className="text-sm text-neutral-500 mb-4">
              This will permanently delete <strong>{venue.name}</strong> and all associated contacts, notes, and linked files.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => onDelete(venue.id)}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      <SendVenueEmailModal
        open={sendEmailOpen}
        onClose={() => setSendEmailOpen(false)}
        defaultType={sendEmailType}
        venue={{ id: venue.id, name: venue.name, city: venue.city ?? null, location: venue.location ?? null }}
        venueId={venue.id}
        recipientEmail={primaryContact?.email ?? ''}
        recipientName={primaryContact?.name ?? ''}
        contactId={primaryContact?.id ?? null}
      />
    </>
  )
}

function ContactRow({ contact, onEdit, onDelete }: { contact: Contact; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded border border-neutral-800 bg-neutral-800/50 px-3 py-2.5">
      <div className="min-w-0">
        <div className="font-medium text-sm text-neutral-200">{contact.name}</div>
        {contact.company && <div className="text-xs text-neutral-400">{contact.company}</div>}
        {contact.role && <div className="text-xs text-neutral-500">{contact.role}</div>}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300">
              <Mail className="h-3 w-3" />{contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300">
              <Phone className="h-3 w-3" />{contact.phone}
            </a>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

function ContactForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Contact | null
  onSave: (data: Omit<Contact, 'id' | 'created_at' | 'venue_id' | 'user_id'>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    company: initial?.company ?? '',
    role: initial?.role ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      name: initial?.name ?? '',
      company: initial?.company ?? '',
      role: initial?.role ?? '',
      email: initial?.email ?? '',
      phone: initial?.phone ?? '',
    })
  }, [initial])

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({
      name: form.name.trim(),
      company: form.company.trim() || null,
      role: form.role || null,
      email: form.email || null,
      phone: form.phone || null,
    })
    setSaving(false)
  }

  return (
    <div className="rounded border border-neutral-700 p-3 space-y-2.5 bg-neutral-800/50">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Name *</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" autoFocus />
        </div>
        <div className="space-y-1">
          <Label>Company</Label>
          <Input
            value={form.company}
            onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
            placeholder="Promoter / venue LLC"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Role</Label>
          <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Booker" />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@venue.com" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Phone</Label>
        <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
          {saving ? 'Saving…' : initial ? 'Save' : 'Add contact'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
