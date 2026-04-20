import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Mail,
  MapPin,
  Phone,
  PhoneForwarded,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useColdCalls } from '@/hooks/useColdCalls'
import type { ColdCallRow } from '@/hooks/useColdCalls'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  COLD_CALL_HOW_FOUND_LABELS,
  COLD_CALL_NEXT_ACTION_LABELS,
  COLD_CALL_OUTCOME_LABELS,
  COLD_CALL_PITCH_REASON_CHIPS,
  COLD_CALL_PURPOSE_LABELS,
  COLD_CALL_REJECTION_LABELS,
  COLD_CALL_TEMPERATURE_META,
  parseColdCallData,
  type ColdCallDataV1,
  type ColdCallNextActionKey,
  type ColdCallSessionMode,
  type ColdCallTemperature,
} from '@/lib/coldCall/coldCallPayload'
import {
  ASK_FOLLOWUP_WHEN_OPTIONS,
  ASK_RESPONSE_OPTIONS,
  BEST_TIME_OPTIONS,
  BOOKING_PROCESS_OPTIONS,
  BUDGET_RANGE_OPTIONS,
  CAPACITY_OPTIONS,
  DURATION_OPTIONS,
  GATEKEEPER_RESULT_OPTIONS,
  INITIAL_REACTION_OPTIONS,
  PARKING_OPTIONS,
  PIVOT_OPTIONS,
  PRICE_PRIMARY_OPTIONS,
  PRICE_TRIAL_OPTIONS,
  SEND_TO_OPTIONS,
  VENUE_TYPE_CONFIRM_OPTIONS,
  WHO_ANSWERED_OPTIONS,
} from '@/pages/cold-call/liveFieldOptions'
import { CONTACT_TITLE_LABELS, type ContactTitleKey } from '@/lib/contacts/contactTitles'

const SESSION_LABEL: Record<ColdCallSessionMode, string> = {
  pre_call: 'Pre-call',
  live_call: 'Live call',
  post_call: 'Post-call',
}

const CALLBACK_EXPECTED_LABEL: Record<Exclude<ColdCallDataV1['callback_expected'], ''>, string> = {
  yes: 'Callback expected',
  no_retry: 'You’ll retry — no callback promised',
}

const VM_FOLLOWUP_LABEL: Record<Exclude<ColdCallDataV1['voicemail_followup_timing'], ''>, string> = {
  tomorrow: 'Retry tomorrow',
  few_days: 'Retry in a few days',
  next_week: 'Retry next week',
  dont_retry: 'No retry',
}

const NO_ANSWER_RETRY_LABEL: Record<Exclude<ColdCallDataV1['no_answer_retry_timing'], ''>, string> = {
  later_today: 'Try again later today',
  tomorrow: 'Try again tomorrow',
  next_week: 'Try again next week',
  remove: 'Drop this lead',
}

const NEXT_ACTION_KEYS = new Set<string>(Object.keys(COLD_CALL_NEXT_ACTION_LABELS))

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ')
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function pickLabel(options: { id: string; label: string }[], id: string): string {
  if (!id) return '—'
  return options.find(o => o.id === id)?.label ?? id.replace(/_/g, ' ')
}

function tempLabel(t: string): string {
  if (!t) return '—'
  const m = COLD_CALL_TEMPERATURE_META[t as Exclude<ColdCallTemperature, ''>]
  return m ? `${m.emoji} ${m.label}` : t
}

function outcomeLabel(outcome: string): string {
  if (!outcome) return '—'
  const o = outcome as keyof typeof COLD_CALL_OUTCOME_LABELS
  return COLD_CALL_OUTCOME_LABELS[o] ?? outcome.replace(/_/g, ' ')
}

function purposeLabel(purpose: string): string {
  if (!purpose) return '—'
  const p = purpose as keyof typeof COLD_CALL_PURPOSE_LABELS
  return COLD_CALL_PURPOSE_LABELS[p] ?? purpose.replace(/_/g, ' ')
}

function rejectionLabel(reason: string | null): string {
  if (!reason) return '—'
  const r = reason as keyof typeof COLD_CALL_REJECTION_LABELS
  return COLD_CALL_REJECTION_LABELS[r] ?? reason.replace(/_/g, ' ')
}

function titleKeyLabel(key: string): string {
  if (!key) return ''
  return key in CONTACT_TITLE_LABELS ? CONTACT_TITLE_LABELS[key as ContactTitleKey] : key.replace(/_/g, ' ')
}

function parseRowNextActions(raw: unknown): ColdCallNextActionKey[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is ColdCallNextActionKey => typeof x === 'string' && NEXT_ACTION_KEYS.has(x))
}

function pitchSummary(data: ColdCallDataV1): string | null {
  const parts: string[] = []
  const chip = data.pitch_reason_chip?.trim()
  if (chip && COLD_CALL_PITCH_REASON_CHIPS[chip]) parts.push(COLD_CALL_PITCH_REASON_CHIPS[chip].label)
  const custom = data.pitch_reason_custom?.trim()
  if (custom) parts.push(custom)
  const legacy = data.pitch_angle?.trim()
  if (legacy) parts.push(legacy)
  return parts.length ? [...new Set(parts)].join(' · ') : null
}

function sessionPhaseHint(mode: ColdCallSessionMode, outcome: string): string {
  if (mode === 'pre_call') {
    return 'Dialing prep: confirm the venue, the contact, and your angle before you open the workspace.'
  }
  if (mode === 'live_call') {
    return 'You’re mid-call in the script — this panel is your at-a-glance map; run the actual flow in the workspace.'
  }
  if (outcome) {
    return 'Post-call snapshot: what they said, what you promised, and what to do next.'
  }
  return 'Post-call: set the outcome and your follow-ups so this lead doesn’t go cold by accident.'
}

function PreviewSection({
  title,
  eyebrow,
  children,
  className,
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-neutral-800/90 bg-neutral-900/30 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] sm:p-5',
        className,
      )}
    >
      {eyebrow ? <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500 mb-1">{eyebrow}</p> : null}
      <h3 className="text-xs font-semibold text-neutral-200 tracking-tight mb-3">{title}</h3>
      {children}
    </section>
  )
}

function ColdCallHubPreview({ row, data }: { row: ColdCallRow; data: ColdCallDataV1 }) {
  const locationLine = [data.city?.trim(), data.state_region?.trim()].filter(Boolean).join(', ')
  const venueName = data.venue_name?.trim()
  const targetName = data.target_name?.trim()
  const targetTitle = data.target_title_key ? titleKeyLabel(data.target_title_key) : ''
  const noteText = (row.notes?.trim() || data.call_notes?.trim() || '').trim()
  const purpose = (row.call_purpose || data.call_purpose || '').trim()
  const who = (row.who_answered || data.who_answered || '').trim()
  const outcome = (row.outcome || data.outcome || '').trim()
  const durationId = (row.duration_feel || data.call_duration_feel || '').trim()
  const pitchLine = pitchSummary(data)
  const nextKeys = parseRowNextActions(row.next_actions)
  const followUpIso = (row.follow_up_date || data.follow_up_date || '').trim()
  const followUpNotes = data.follow_up_notes?.trim()
  const howFound = data.how_found?.trim()
  const initialReaction = data.initial_reaction?.trim()
  const pivot = data.pivot_response?.trim()
  const parking = data.parking_result?.trim()
  const sendTo = data.send_to?.trim()
  const askResponse = data.ask_response?.trim()
  const askWhen = data.ask_followup_when?.trim()
  const gatekeeperResult = data.gatekeeper_result?.trim()
  const dmName = data.decision_maker_name?.trim()
  const dmTitle = data.decision_maker_title_key ? titleKeyLabel(data.decision_maker_title_key) : ''
  const otherDm = data.other_dm_name?.trim()
  const bookingProcess = data.booking_process?.trim()
  const budget = data.budget_range?.trim()
  const rateReact = data.rate_reaction?.trim()
  const pricePrimary = data.price_primary_reaction?.trim()
  const priceTrial = data.price_trial_reaction?.trim()
  const capacity = data.capacity_range?.trim()
  const venueTypeConfirm = data.venue_type_confirm?.trim()
  const bestTime = data.best_time?.trim()
  const bestTimeSpecific = data.best_time_specific?.trim()
  const knownEvents = data.known_events?.trim()
  const nightNote = data.night_details_note?.trim()
  const vibeNote = data.venue_vibe?.trim()
  const eventNights = (data.event_nights ?? []).filter(Boolean)

  const phone = data.target_phone?.trim()
  const email = data.target_email?.trim()
  const dmPhone = data.decision_maker_direct_phone?.trim()
  const dmEmail = data.decision_maker_direct_email?.trim()

  const flagEntries = Object.entries(data.flag_captures ?? {}).filter(([, v]) => String(v ?? '').trim())

  const dealSignals = Boolean(
    budget ||
      rateReact ||
      pricePrimary ||
      priceTrial ||
      capacity ||
      venueTypeConfirm ||
      eventNights.length,
  )

  const voicemailPlan =
    who === 'voicemail' && data.voicemail_followup_timing
      ? VM_FOLLOWUP_LABEL[data.voicemail_followup_timing]
      : null
  const noAnswerPlan =
    who === 'no_answer' && data.no_answer_retry_timing ? NO_ANSWER_RETRY_LABEL[data.no_answer_retry_timing] : null

  const pipelineBits: string[] = []
  if (row.venue_id) pipelineBits.push('Venue linked')
  if (row.save_to_pipeline) pipelineBits.push('Save to pipeline')

  const metaFooterParts: string[] = []
  if (row.call_date) metaFooterParts.push(`Call date ${fmtDate(row.call_date)}`)
  metaFooterParts.push(`Updated ${fmtDateTime(row.updated_at)}`)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-800/80 bg-gradient-to-br from-neutral-900/60 to-neutral-950/40 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-white/10 bg-neutral-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                {SESSION_LABEL[data.session_mode] ?? data.session_mode}
              </span>
              {durationId ? (
                <span className="text-[11px] text-neutral-500">{pickLabel(DURATION_OPTIONS, durationId)}</span>
              ) : null}
              {typeof data.temperature_score === 'number' && data.temperature_score > 0 && !data.temperature_manual_lock ? (
                <span className="text-[11px] text-neutral-600">Score {data.temperature_score}</span>
              ) : null}
            </div>
            <p className="text-sm text-neutral-300 leading-snug max-w-3xl">{sessionPhaseHint(data.session_mode, outcome)}</p>
          </div>
          {row.call_date ? (
            <div className="flex items-center gap-2 shrink-0 text-xs text-neutral-500 lg:text-right">
              <CalendarDays className="h-4 w-4 text-neutral-600" />
              <span>{fmtDate(row.call_date)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5 lg:items-start">
        <PreviewSection title="Who you’re calling" eyebrow="Target">
          {venueName ? <p className="text-base font-semibold text-neutral-50 leading-snug">{venueName}</p> : (
            <p className="text-sm text-neutral-500">Add a venue name in the workspace.</p>
          )}
          {locationLine ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-neutral-400">
              <MapPin className="h-4 w-4 shrink-0 text-neutral-600 mt-0.5" />
              <span>{locationLine}</span>
            </p>
          ) : null}
          {(data.social_handle?.trim() || data.website?.trim()) ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
              {data.social_handle?.trim() ? <span>@{data.social_handle.replace(/^@+/, '')}</span> : null}
              {data.website?.trim() ? (
                <a
                  href={data.website.trim().startsWith('http') ? data.website.trim() : `https://${data.website.trim()}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
                >
                  Website
                </a>
              ) : null}
            </div>
          ) : null}
          {howFound && howFound in COLD_CALL_HOW_FOUND_LABELS ? (
            <p className="mt-3 text-xs text-neutral-500">
              Found via <span className="text-neutral-400">{COLD_CALL_HOW_FOUND_LABELS[howFound as keyof typeof COLD_CALL_HOW_FOUND_LABELS]}</span>
            </p>
          ) : null}

          {(targetName || targetTitle) ? (
            <div className="mt-4 border-t border-neutral-800/70 pt-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 mb-1">Contact on file</p>
              <p className="text-sm font-medium text-neutral-100">
                {targetName || '—'}
                {targetTitle ? <span className="font-normal text-neutral-400"> · {targetTitle}</span> : null}
              </p>
              {(phone || email) ? (
                <div className="mt-2 space-y-1.5">
                  {phone ? (
                    <a
                      href={`tel:${phone.replace(/\s/g, '')}`}
                      className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white"
                    >
                      <Phone className="h-3.5 w-3.5 text-neutral-600" />
                      {phone}
                    </a>
                  ) : null}
                  {email ? (
                    <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white break-all">
                      <Mail className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                      {email}
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-neutral-600">No phone or email captured yet.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-xs text-neutral-600 border-t border-neutral-800/70 pt-4">Add a contact in pre-call or live capture.</p>
          )}
        </PreviewSection>

        <PreviewSection title="What happened" eyebrow="Call result">
          {outcome ? (
            <p className="rounded-lg border border-neutral-800/80 bg-neutral-950/50 px-3 py-2.5 text-sm font-medium text-neutral-100 leading-snug">
              {outcomeLabel(outcome)}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">No outcome logged yet — finish post-call in the workspace.</p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {purpose ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-0.5">Purpose</p>
                <p className="text-sm text-neutral-200">{purposeLabel(purpose)}</p>
              </div>
            ) : null}
            {who ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-0.5">Who answered</p>
                <p className="text-sm text-neutral-200">{pickLabel(WHO_ANSWERED_OPTIONS, who)}</p>
              </div>
            ) : null}
          </div>

          {(initialReaction || pivot || parking) ? (
            <div className="mt-4 space-y-2 border-t border-neutral-800/60 pt-4 text-sm text-neutral-300">
              {initialReaction ? (
                <p>
                  <span className="text-neutral-500">Their tone: </span>
                  {pickLabel(INITIAL_REACTION_OPTIONS, initialReaction)}
                </p>
              ) : null}
              {pivot ? (
                <p>
                  <span className="text-neutral-500">Pivot: </span>
                  {pickLabel(PIVOT_OPTIONS, pivot)}
                </p>
              ) : null}
              {parking ? (
                <p>
                  <span className="text-neutral-500">Parking: </span>
                  {pickLabel(PARKING_OPTIONS, parking)}
                </p>
              ) : null}
            </div>
          ) : null}

          {who === 'wrong_person' && (gatekeeperResult || data.gatekeeper_name?.trim()) ? (
            <div className="mt-4 border-t border-neutral-800/60 pt-4 text-sm text-neutral-300 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-1">Gatekeeper</p>
              {data.gatekeeper_name?.trim() ? <p>{data.gatekeeper_name.trim()}</p> : null}
              {gatekeeperResult ? <p>{pickLabel(GATEKEEPER_RESULT_OPTIONS, gatekeeperResult)}</p> : null}
            </div>
          ) : null}

          {(row.rejection_reason || data.rejection_reason) ? (
            <p className="mt-4 text-sm text-red-300/90">
              <span className="text-red-400/70">Rejection: </span>
              {rejectionLabel(row.rejection_reason ?? data.rejection_reason)}
            </p>
          ) : null}

          {(dmName || dmPhone || dmEmail || otherDm) ? (
            <div className="mt-4 border-t border-neutral-800/60 pt-4">
              <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-2">Decision-maker capture</p>
              {dmName ? (
                <p className="text-sm text-neutral-200">
                  {dmName}
                  {dmTitle ? <span className="text-neutral-500"> · {dmTitle}</span> : null}
                </p>
              ) : null}
              {otherDm ? <p className="text-sm text-neutral-400 mt-1">Also: {otherDm}</p> : null}
              <div className="mt-2 space-y-1.5">
                {dmPhone ? (
                  <a href={`tel:${dmPhone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white">
                    <Phone className="h-3.5 w-3.5 text-neutral-600" />
                    {dmPhone}
                  </a>
                ) : null}
                {dmEmail ? (
                  <a href={`mailto:${dmEmail}`} className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white break-all">
                    <Mail className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                    {dmEmail}
                  </a>
                ) : null}
              </div>
              {data.callback_expected ? (
                <p className="mt-2 text-xs text-neutral-500">{CALLBACK_EXPECTED_LABEL[data.callback_expected]}</p>
              ) : null}
              {bestTime ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Best time: {pickLabel(BEST_TIME_OPTIONS, bestTime)}
                  {bestTime === 'specific' && bestTimeSpecific ? ` (${bestTimeSpecific})` : ''}
                </p>
              ) : null}
            </div>
          ) : data.callback_expected ? (
            <p className="mt-4 text-xs text-neutral-500 border-t border-neutral-800/60 pt-4">{CALLBACK_EXPECTED_LABEL[data.callback_expected]}</p>
          ) : null}

          {bookingProcess ? (
            <p className="mt-3 text-xs text-neutral-500">
              Booking process: {pickLabel(BOOKING_PROCESS_OPTIONS, bookingProcess)}
            </p>
          ) : null}
        </PreviewSection>
      </div>

      {(pitchLine || knownEvents || vibeNote || nightNote || eventNights.length > 0) ? (
        <PreviewSection title="Context for the conversation" eyebrow="Research">
          {pitchLine ? (
            <div className="flex gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-neutral-500 mt-0.5" />
              <p className="text-sm text-neutral-200 leading-relaxed">{pitchLine}</p>
            </div>
          ) : null}
          {(knownEvents || nightNote || eventNights.length) ? (
            <div className={cn('space-y-2 text-sm text-neutral-400', pitchLine ? 'mt-4' : '')}>
              {eventNights.length ? <p>Nights: {eventNights.join(', ')}</p> : null}
              {knownEvents ? <p>{knownEvents}</p> : null}
              {nightNote ? <p className="text-neutral-500">{nightNote}</p> : null}
            </div>
          ) : null}
          {vibeNote ? <p className={cn('text-sm text-neutral-500', pitchLine || knownEvents ? 'mt-3' : '')}>{vibeNote}</p> : null}
        </PreviewSection>
      ) : null}

      <PreviewSection
        title="Your next move"
        eyebrow="Follow-through"
        className="border-emerald-950/40 bg-emerald-950/[0.07]"
      >
        <div className="space-y-4">
          {nextKeys.length > 0 ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-emerald-200/50 mb-2">Committed actions</p>
              <ul className="flex flex-wrap gap-2">
                {nextKeys.map(key => (
                  <li
                    key={key}
                    className="rounded-full border border-emerald-900/35 bg-emerald-950/25 px-3 py-1 text-xs text-emerald-100/95"
                  >
                    {COLD_CALL_NEXT_ACTION_LABELS[key]}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No checklist items yet — add what you owe them in post-call.</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {followUpIso ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-0.5">Follow-up date</p>
                <p className="text-sm font-medium text-neutral-100">{fmtDate(followUpIso)}</p>
              </div>
            ) : null}
            {sendTo ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-0.5">Send channel</p>
                <p className="text-sm text-neutral-200">{pickLabel(SEND_TO_OPTIONS, sendTo)}</p>
              </div>
            ) : null}
            {askResponse ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-0.5">Ask response</p>
                <p className="text-sm text-neutral-200">{pickLabel(ASK_RESPONSE_OPTIONS, askResponse)}</p>
              </div>
            ) : null}
            {askWhen ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-0.5">Their timing</p>
                <p className="text-sm text-neutral-200">{pickLabel(ASK_FOLLOWUP_WHEN_OPTIONS, askWhen)}</p>
              </div>
            ) : null}
          </div>

          {(voicemailPlan || noAnswerPlan) ? (
            <p className="text-sm text-neutral-400">
              <span className="text-neutral-500">Retry plan: </span>
              {voicemailPlan || noAnswerPlan}
            </p>
          ) : null}

          {followUpNotes ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-1">Follow-up note</p>
              <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">{followUpNotes}</p>
            </div>
          ) : null}
        </div>
      </PreviewSection>

      {dealSignals ? (
        <PreviewSection title="Deal signals" eyebrow="If they shared numbers">
          <div className="flex flex-wrap gap-2">
            {eventNights.length > 0 ? (
              <span className="rounded-md border border-neutral-800 bg-neutral-950/40 px-2.5 py-1 text-xs text-neutral-300">
                Event nights: {eventNights.join(', ')}
              </span>
            ) : null}
            {pricePrimary ? (
              <span className="rounded-md border border-neutral-800 bg-neutral-950/40 px-2.5 py-1 text-xs text-neutral-300">
                Rate reaction: {pickLabel(PRICE_PRIMARY_OPTIONS, pricePrimary)}
              </span>
            ) : null}
            {priceTrial ? (
              <span className="rounded-md border border-neutral-800 bg-neutral-950/40 px-2.5 py-1 text-xs text-neutral-300">
                Trial: {pickLabel(PRICE_TRIAL_OPTIONS, priceTrial)}
              </span>
            ) : null}
            {budget && !pricePrimary ? (
              <span className="rounded-md border border-neutral-800 bg-neutral-950/40 px-2.5 py-1 text-xs text-neutral-300">
                Budget: {pickLabel(BUDGET_RANGE_OPTIONS, budget)}
              </span>
            ) : null}
            {rateReact && !pricePrimary ? (
              <span className="rounded-md border border-neutral-800 bg-neutral-950/40 px-2.5 py-1 text-xs text-neutral-300">
                Rate (legacy): {rateReact}
              </span>
            ) : null}
            {capacity ? (
              <span className="rounded-md border border-neutral-800 bg-neutral-950/40 px-2.5 py-1 text-xs text-neutral-300">
                Capacity: {pickLabel(CAPACITY_OPTIONS, capacity)}
              </span>
            ) : null}
            {venueTypeConfirm ? (
              <span className="rounded-md border border-neutral-800 bg-neutral-950/40 px-2.5 py-1 text-xs text-neutral-300">
                Venue type: {pickLabel(VENUE_TYPE_CONFIRM_OPTIONS, venueTypeConfirm)}
              </span>
            ) : null}
          </div>
        </PreviewSection>
      ) : null}

      {flagEntries.length > 0 ? (
        <PreviewSection title="Captured later" eyebrow="Flags">
          <ul className="space-y-2 text-sm text-neutral-300">
            {flagEntries.map(([k, v]) => (
              <li key={k} className="flex gap-2">
                <span className="shrink-0 text-neutral-500 font-mono text-xs">{k}</span>
                <span className="min-w-0 whitespace-pre-wrap">{String(v)}</span>
              </li>
            ))}
          </ul>
        </PreviewSection>
      ) : null}

      {noteText ? (
        <PreviewSection title="Scratch notes" eyebrow="Your words">
          <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">{noteText}</p>
        </PreviewSection>
      ) : null}

      {pipelineBits.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {pipelineBits.map(bit => (
            <span
              key={bit}
              className={cn(
                'rounded-md border px-2.5 py-1',
                bit === 'Save to pipeline'
                  ? 'border-emerald-900/40 text-emerald-300/90 bg-emerald-950/20'
                  : 'border-neutral-800 text-neutral-400 bg-neutral-900/30',
              )}
            >
              {bit}
            </span>
          ))}
        </div>
      ) : null}

      <p className="text-[10px] text-neutral-600 px-0.5">{metaFooterParts.join(' · ')}</p>
    </div>
  )
}

export default function ColdCallsHubPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const cold = useColdCalls()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rows = useMemo(() => cold.calls, [cold.calls])

  useEffect(() => {
    if (cold.loading || rows.length === 0) return
    setSelectedId(prev => {
      if (prev && rows.some(r => r.id === prev)) return prev
      return rows[0]?.id ?? null
    })
  }, [cold.loading, rows])

  const selected = useMemo(() => rows.find(r => r.id === selectedId) ?? null, [rows, selectedId])

  const parsedData = useMemo(() => {
    if (!selected) return null
    try {
      return parseColdCallData(selected.call_data)
    } catch {
      return null
    }
  }, [selected])

  const openCallWorkspace = useCallback(
    (id: string) => {
      navigate(`/forms/cold-call?callId=${encodeURIComponent(id)}`)
    },
    [navigate],
  )

  const openPrepWorkspace = useCallback(
    (id: string) => {
      navigate(`/forms/cold-call?callId=${encodeURIComponent(id)}&prep=1`)
    },
    [navigate],
  )

  const handleNew = async () => {
    const row = await cold.createColdCall()
    if (row) openCallWorkspace(row.id)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this cold call? This cannot be undone.')) return
    await cold.deleteColdCall(id)
    setSelectedId(null)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (cold.loading && rows.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="h-14 border-b border-neutral-800 flex items-center gap-4 px-4 sm:px-6 shrink-0 bg-neutral-950/95 backdrop-blur-sm z-10">
        <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 -ml-1 shrink-0" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-neutral-100 tracking-tight">Cold calls</h1>
          <p className="text-[11px] text-neutral-500 truncate">Outbound venue outreach — pre-call research through post-call</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1.5 shrink-0 bg-neutral-100 text-neutral-950 hover:bg-white"
          onClick={() => void handleNew()}
        >
          <Plus className="h-4 w-4" />
          New cold call
        </Button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <aside className="lg:w-[320px] lg:min-w-[280px] lg:max-w-[360px] border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col min-h-0 bg-neutral-950">
          <div className="p-3 sm:p-4 border-b border-neutral-800/80 shrink-0">
            {cold.error ? <p className="text-xs text-red-400">{cold.error}</p> : null}
          </div>
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5">
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-700 p-6 text-center">
                <PhoneForwarded className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-sm text-neutral-400 mb-3">No cold calls yet.</p>
                <Button type="button" size="sm" variant="outline" className="border-neutral-600" onClick={() => void handleNew()}>
                  Start one
                </Button>
              </div>
            ) : (
              rows.map(row => {
                const active = row.id === selectedId
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-neutral-200 bg-neutral-900/80 shadow-sm'
                        : 'border-white/[0.06] bg-neutral-900/20 hover:border-white/10 hover:bg-neutral-900/40',
                    )}
                  >
                    <div className="text-sm font-medium text-neutral-100 line-clamp-2 leading-snug">{row.title || 'Untitled'}</div>
                    <div className="mt-1.5 text-xs text-neutral-400">{tempLabel(row.temperature)}</div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {!selected ? (
            <p className="text-sm text-neutral-500">Select a cold call or create a new one.</p>
          ) : parsedData ? (
            <div className="mx-auto max-w-5xl space-y-5">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/35 p-4 sm:p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <h2 className="text-lg font-semibold tracking-tight text-neutral-100 leading-snug">{selected.title || 'Untitled'}</h2>
                    <p className="text-sm text-neutral-400">{tempLabel(selected.temperature)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 items-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 min-w-[7.25rem] px-3 border-neutral-600 text-neutral-100 hover:bg-neutral-800"
                      onClick={() => openPrepWorkspace(selected.id)}
                    >
                      Edit prep
                    </Button>
                    <Button
                      type="button"
                      className="h-9 min-w-[7.25rem] px-3 bg-neutral-100 text-neutral-950 hover:bg-white"
                      onClick={() => openCallWorkspace(selected.id)}
                    >
                      Open call
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-red-900/50 text-red-300 hover:bg-red-950/40 hover:text-red-200"
                      onClick={() => void handleDelete(selected.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>

              <ColdCallHubPreview row={selected} data={parsedData} />

              {selected.converted_to_intake_id ? (
                <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100/90">
                  Converted to booking intake —{' '}
                  <Link
                    to={`/forms/intake?intakeId=${encodeURIComponent(selected.converted_to_intake_id)}`}
                    className="font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                  >
                    Open intake
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              <p className="text-sm text-amber-400/90">Could not read call details for this record.</p>
              <div className="flex flex-wrap gap-2 items-center">
                <Button type="button" variant="outline" className="border-neutral-600" onClick={() => openPrepWorkspace(selected.id)}>
                  Edit prep
                </Button>
                <Button type="button" className="bg-neutral-100 text-neutral-950 hover:bg-white" onClick={() => openCallWorkspace(selected.id)}>
                  Open call
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-900/50 text-red-300"
                  onClick={() => void handleDelete(selected.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
