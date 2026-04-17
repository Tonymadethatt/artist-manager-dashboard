import { useEffect, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BookingIntakeShowRow } from '@/hooks/useBookingIntakes'
import {
  type BookingIntakeShowDataV3,
  type BookingIntakeVenueDataV3,
  type VenueBoothMonitorV3,
  type VenueDeckTypeV3,
  type VenueLaptopConnectionV3,
  type VenueMixerBrandV3,
  type VenueProDjLinkV3,
  type VenueUsbFormatV3,
  type TechSetupAccessV3,
} from '@/lib/intake/intakePayloadV3'
import { parseShowDataV3 } from '@/lib/intake/intakePayloadV3'
import { GEAR_MODEL_OTHER_ID, listDecksForKind, listMixersForBrand, type MixerBrandKeyV3 } from '@/lib/gear/djGearCatalog'
import {
  computeGearTechFollowupNeeded,
  gearPhaseADetailEligible,
} from '@/lib/gear/gearIntakeDerived'
import { IntakeGearSearchPick } from '@/pages/booking-intake/IntakeGearSearchPick'
import { IntakeInlineScriptBlock } from '@/pages/booking-intake/intakeLivePrimitives'
import { IntakeQuarterHourTimeField } from '@/pages/booking-intake/IntakeQuarterHourTimeField'
import { cn } from '@/lib/utils'

const STEP = { equipment_intake_flow_version: 2 as const }

function techNeedsT1(sd: BookingIntakeShowDataV3): boolean {
  const dt = sd.venue_deck_type
  if (dt === 'not_sure' || !dt.trim()) return true
  if (!sd.venue_deck_model_id.trim()) return true
  if (sd.venue_deck_model_id === GEAR_MODEL_OTHER_ID && !sd.venue_deck_other_notes.trim()) return true
  return false
}

function techNeedsT2(sd: BookingIntakeShowDataV3): boolean {
  const mb = sd.venue_mixer_brand
  if (mb === 'not_sure' || !mb.trim()) return true
  if (mb === 'other') return !sd.venue_mixer_other_notes.trim()
  if (mb === 'built_in') return false
  if (!sd.venue_mixer_model_id.trim()) return true
  if (sd.venue_mixer_model_id === GEAR_MODEL_OTHER_ID && !sd.venue_mixer_other_notes.trim()) return true
  return false
}

function techNeedsT3(sd: BookingIntakeShowDataV3): boolean {
  if (!gearPhaseADetailEligible(sd)) return false
  return sd.venue_laptop_connection === 'not_sure' || !sd.venue_laptop_connection.trim()
}

function techNeedsT3bProLink(sd: BookingIntakeShowDataV3): boolean {
  if (sd.venue_deck_type !== 'cdj') return false
  if (!gearPhaseADetailEligible(sd)) return false
  return sd.venue_pro_dj_link === 'not_sure' || !sd.venue_pro_dj_link.trim()
}

function techNeedsT4(sd: BookingIntakeShowDataV3): boolean {
  return sd.venue_booth_monitor === 'not_sure' || !sd.venue_booth_monitor.trim()
}

function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | ''
  options: readonly { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-neutral-400 text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {options.map(o => {
          const on = value === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={cn(
                'min-h-[32px] px-2 text-xs font-medium rounded-md border transition-colors leading-tight text-left max-w-full',
                on
                  ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                  : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TechGearFollowUpSection({
  showRow,
  venueData,
  applyShowPost,
}: {
  showRow: BookingIntakeShowRow
  venueData: BookingIntakeVenueDataV3
  applyShowPost: (showId: string, partial: Partial<BookingIntakeShowDataV3>) => void
}) {
  const sd = useMemo(
    () => parseShowDataV3(showRow.show_data, showRow.sort_order),
    [showRow.show_data, showRow.sort_order],
  )

  const followup = computeGearTechFollowupNeeded(sd)

  const showLabel =
    showRow.label.trim() ||
    (sd.event_date.trim() ? sd.event_date.trim() : `Show ${showRow.sort_order + 1}`)

  const deckKind =
    sd.venue_deck_type === 'cdj'
      ? ('cdj' as const)
      : sd.venue_deck_type === 'controller'
        ? ('controller' as const)
        : sd.venue_deck_type === 'turntable'
          ? ('turntable' as const)
          : sd.venue_deck_type === 'all_in_one'
            ? ('all_in_one' as const)
            : null

  const deckRows = deckKind ? listDecksForKind(deckKind) : []
  const mixerBrandKey: MixerBrandKeyV3 | null =
    sd.venue_mixer_brand === 'pioneer_djm' ||
    sd.venue_mixer_brand === 'rane' ||
    sd.venue_mixer_brand === 'allen_heath'
      ? sd.venue_mixer_brand
      : null
  const mixerRows = mixerBrandKey ? listMixersForBrand(mixerBrandKey) : []

  const patch = (p: Partial<BookingIntakeShowDataV3>) => applyShowPost(showRow.id, { ...STEP, ...p })

  useEffect(() => {
    if (!followup && sd.gear_tech_call_active) {
      applyShowPost(showRow.id, { ...STEP, gear_tech_call_active: false })
    }
  }, [followup, sd.gear_tech_call_active, showRow.id, applyShowPost])

  const n1 = techNeedsT1(sd)
  const n2 = techNeedsT2(sd)
  const n3 = techNeedsT3(sd)
  const n3b = techNeedsT3bProLink(sd)
  const n4 = techNeedsT4(sd)

  if (!followup && !sd.gear_tech_call_active) return null

  const onsiteName = venueData.onsite_contact_name.trim()
  const onsitePhone = venueData.onsite_contact_phone.trim()

  return (
    <div className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-3">
      <div>
        <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Tech follow-up</p>
        <p className="text-sm font-medium text-neutral-100 mt-1">{showLabel}</p>
        <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
          Gear details were incomplete on the booking call. Confirm with on-site tech before the date is final.
        </p>
      </div>

      {!sd.gear_tech_call_active ? (
        <>
          <div className="rounded-md border border-white/[0.06] bg-neutral-950/30 px-3 py-2 text-xs text-neutral-300 space-y-1">
            <p>
              <span className="text-neutral-500">On-site tech: </span>
              {onsiteName || '—'}
            </p>
            {onsitePhone ? (
              <p>
                <span className="text-neutral-500">Phone: </span>
                {onsitePhone}
              </p>
            ) : null}
            <ul className="list-disc pl-4 text-[11px] text-neutral-400 space-y-0.5 mt-2">
              {n1 ? <li>Deck type / model</li> : null}
              {n2 ? <li>Mixer</li> : null}
              {n3 || n3b ? <li>Connectivity / Pro DJ Link</li> : null}
              {n4 ? <li>Booth monitor</li> : null}
              <li>Soundcheck time (always)</li>
            </ul>
          </div>
          <Button
            type="button"
            size="lg"
            className="min-h-[52px] w-full bg-red-600 hover:bg-red-700 text-white border-0"
            onClick={() =>
              patch({
                gear_tech_call_active: true,
              })
            }
          >
            Start tech call
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          {n1 ? (
            <div className="space-y-2 rounded-lg border border-white/[0.06] p-3">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wide">T1 — Booth decks</p>
              <IntakeInlineScriptBlock>
                <p>
                  What kind of decks are running in the booth? (Pioneer CDJs, controller, turntables, all-in-one?)
                </p>
              </IntakeInlineScriptBlock>
              <ChipRow<VenueDeckTypeV3>
                label="Deck type"
                value={sd.venue_deck_type}
                options={[
                  { id: 'cdj', label: 'CDJs' },
                  { id: 'controller', label: 'Controller' },
                  { id: 'turntable', label: 'Turntables' },
                  { id: 'all_in_one', label: 'All-in-one' },
                  { id: 'not_sure', label: 'Not sure' },
                ]}
                onChange={v =>
                  patch({
                    venue_deck_type: v,
                    venue_deck_model_id: '',
                    venue_deck_other_notes: '',
                  })
                }
              />
              {sd.venue_deck_type && sd.venue_deck_type !== 'not_sure' ? (
                <div className="flex flex-wrap gap-2 items-end">
                  <IntakeGearSearchPick
                    label="Deck model"
                    placeholder="Search model…"
                    valueId={sd.venue_deck_model_id === GEAR_MODEL_OTHER_ID ? '' : sd.venue_deck_model_id}
                    rows={deckRows}
                    onPick={id => patch({ venue_deck_model_id: id, venue_deck_other_notes: '' })}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ venue_deck_model_id: GEAR_MODEL_OTHER_ID })}
                    className={cn(
                      'min-h-[44px] px-3 text-xs font-medium rounded-lg border mb-0.5',
                      sd.venue_deck_model_id === GEAR_MODEL_OTHER_ID
                        ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                        : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400',
                    )}
                  >
                    Other
                  </button>
                </div>
              ) : null}
              {sd.venue_deck_model_id === GEAR_MODEL_OTHER_ID ? (
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Describe deck (other)</Label>
                  <Textarea
                    className="min-h-[72px] border-neutral-800 bg-neutral-950/80 text-sm"
                    value={sd.venue_deck_other_notes}
                    onChange={e => patch({ venue_deck_other_notes: e.target.value })}
                    placeholder="Model / details from tech"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {n2 ? (
            <div className="space-y-2 rounded-lg border border-white/[0.06] p-3">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wide">T2 — Mixer</p>
              <IntakeInlineScriptBlock>
                <p>What mixer are you running?</p>
              </IntakeInlineScriptBlock>
              <div className="space-y-1.5">
                <Label className="text-neutral-400 text-xs">Mixer brand</Label>
                <Select
                  value={sd.venue_mixer_brand || '__none__'}
                  onValueChange={v => {
                    const val = v === '__none__' ? ('' as VenueMixerBrandV3) : (v as VenueMixerBrandV3)
                    patch({
                      venue_mixer_brand: val,
                      venue_mixer_model_id: '',
                      venue_mixer_other_notes: '',
                    })
                  }}
                >
                  <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="pioneer_djm">Pioneer DJM</SelectItem>
                    <SelectItem value="rane">Rane</SelectItem>
                    <SelectItem value="allen_heath">Allen &amp; Heath</SelectItem>
                    <SelectItem value="built_in">Built-in</SelectItem>
                    <SelectItem value="not_sure">Not sure</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mixerBrandKey ? (
                <div className="flex flex-wrap gap-2 items-end">
                  <IntakeGearSearchPick
                    label="Mixer model"
                    placeholder="Search model…"
                    valueId={sd.venue_mixer_model_id === GEAR_MODEL_OTHER_ID ? '' : sd.venue_mixer_model_id}
                    rows={mixerRows}
                    onPick={id => patch({ venue_mixer_model_id: id, venue_mixer_other_notes: '' })}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ venue_mixer_model_id: GEAR_MODEL_OTHER_ID })}
                    className={cn(
                      'min-h-[44px] px-3 text-xs font-medium rounded-lg border mb-0.5',
                      sd.venue_mixer_model_id === GEAR_MODEL_OTHER_ID
                        ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                        : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400',
                    )}
                  >
                    Other
                  </button>
                </div>
              ) : null}
              {sd.venue_mixer_brand === 'other' || sd.venue_mixer_model_id === GEAR_MODEL_OTHER_ID ? (
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Mixer details (other)</Label>
                  <Textarea
                    className="min-h-[72px] border-neutral-800 bg-neutral-950/80 text-sm"
                    value={sd.venue_mixer_other_notes}
                    onChange={e => patch({ venue_mixer_other_notes: e.target.value })}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {n3 || n3b ? (
            <div className="space-y-2 rounded-lg border border-white/[0.06] p-3">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wide">T3 — Connectivity</p>
              <IntakeInlineScriptBlock>
                <p>Laptop hookup vs USB-only? (and Pro DJ Link if CDJs)</p>
              </IntakeInlineScriptBlock>
              {n3 ? (
                <ChipRow<VenueLaptopConnectionV3>
                  label="Connection"
                  value={sd.venue_laptop_connection}
                  options={[
                    { id: 'usb_b_mixer', label: 'USB-B into mixer' },
                    { id: 'audio_interface', label: 'Audio interface' },
                    { id: 'usb_drives_only', label: 'USB drives only' },
                    { id: 'other', label: 'Other' },
                    { id: 'not_sure', label: 'Not sure' },
                  ]}
                  onChange={v =>
                    patch({
                      venue_laptop_connection: v,
                      venue_usb_format: v !== 'usb_drives_only' ? '' : sd.venue_usb_format,
                    })
                  }
                />
              ) : null}
              {sd.venue_laptop_connection === 'usb_drives_only' ? (
                <ChipRow<VenueUsbFormatV3>
                  label="USB format"
                  value={sd.venue_usb_format}
                  options={[
                    { id: 'fat32', label: 'FAT32' },
                    { id: 'exfat', label: 'exFAT' },
                    { id: 'not_sure', label: 'Not sure' },
                  ]}
                  onChange={v => patch({ venue_usb_format: v })}
                />
              ) : null}
              {n3b ? (
                <ChipRow<VenueProDjLinkV3>
                  label="Pro DJ Link"
                  value={sd.venue_pro_dj_link}
                  options={[
                    { id: 'yes', label: 'Networked' },
                    { id: 'standalone_usb', label: 'Standalone USB' },
                    { id: 'no', label: 'No' },
                    { id: 'not_sure', label: 'Not sure' },
                  ]}
                  onChange={v => patch({ venue_pro_dj_link: v })}
                />
              ) : null}
            </div>
          ) : null}

          {n4 ? (
            <div className="space-y-2 rounded-lg border border-white/[0.06] p-3">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wide">T4 — Monitor</p>
              <IntakeInlineScriptBlock>
                <p>Is there a booth monitor or foldback for the DJ?</p>
              </IntakeInlineScriptBlock>
              <ChipRow<VenueBoothMonitorV3>
                label="Booth monitor"
                value={sd.venue_booth_monitor}
                options={[
                  { id: 'yes', label: 'Yes' },
                  { id: 'no', label: 'No — need to arrange' },
                  { id: 'not_sure', label: 'Not sure' },
                ]}
                onChange={v => patch({ venue_booth_monitor: v })}
              />
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-white/[0.06] p-3">
            <p className="text-[10px] text-neutral-500 uppercase tracking-wide">T5 — Soundcheck</p>
            <IntakeInlineScriptBlock>
              <p>What time can the DJ check levels before the set?</p>
            </IntakeInlineScriptBlock>
            <IntakeQuarterHourTimeField
              id={`tech-sc-${showRow.id}`}
              label="Soundcheck time"
              value={sd.tech_soundcheck_time}
              allowClear
              onChange={v => patch({ tech_soundcheck_time: v })}
              triggerClassName="h-11"
            />
            <ChipRow<TechSetupAccessV3>
              label="Setup access"
              value={sd.tech_setup_access}
              options={[
                { id: 'before_doors', label: 'Before doors' },
                { id: 'during_event', label: 'During event' },
                { id: 'no_soundcheck', label: 'No soundcheck' },
              ]}
              onChange={v => patch({ tech_setup_access: v })}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-neutral-700"
              onClick={() => patch({ gear_tech_call_active: false })}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-neutral-100 text-neutral-950 hover:bg-white"
              onClick={() => patch({ gear_tech_call_active: false })}
            >
              Save tech answers
            </Button>
          </div>
          <p className="text-[10px] text-neutral-600">
            Saving runs normalization on the show — reopen Start tech call if anything is still incomplete.
          </p>
        </div>
      )}
    </div>
  )
}
