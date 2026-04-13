import { Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PricingCatalogDoc } from '@/types'
import {
  EQUIPMENT_HYBRID_COVER_KEYS,
  EQUIPMENT_HYBRID_COVER_LABELS,
  EQUIPMENT_VENUE_INCLUDES_KEYS,
  EQUIPMENT_VENUE_INCLUDES_LABELS,
  resolveProductionPackageCandidates,
  resolveVenueProductionAddonCandidates,
  type BookingIntakeShowDataV3,
  type EquipmentDjPackageInterestV3,
  type EquipmentHybridAdditionsV3,
  type EquipmentMicV3,
  type EquipmentVenueIncludesIdV3,
  type Phase4EquipmentProviderV3,
} from '@/lib/intake/intakePayloadV3'
import { IntakeCompactChipRow, IntakeInlineScriptBlock } from '@/pages/booking-intake/intakeLivePrimitives'

export type EquipmentSoundTechPickOption = {
  id: string
  label: string
  contactId: string | null
  /** Snapshot for primary/on-call picks; empty when choosing a venue contact row. */
  name: string
}

function venueHasLightingEffects(includes: readonly EquipmentVenueIncludesIdV3[]): boolean {
  return includes.some(k => k === 'stage_lighting' || k === 'led_moving' || k === 'fog_haze')
}

function soundTechSelectValue(
  options: readonly EquipmentSoundTechPickOption[],
  sd: BookingIntakeShowDataV3,
): string {
  const cid = sd.equipment_sound_tech_contact_id?.trim()
  if (cid) {
    const m = options.find(o => o.contactId === cid)
    if (m) return m.id
  }
  const n = sd.equipment_sound_tech_name.trim()
  if (!n) return '__none__'
  const m2 = options.find(o => o.contactId === null && o.name === n)
  if (m2) return m2.id
  return '__other__'
}

function SingleSelectChipRow<T extends string>({
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

const STEP1_FLOW = { equipment_intake_flow_version: 2 as const }

function resetStep2Fields(): Pick<
  BookingIntakeShowDataV3,
  | 'equipment_venue_includes'
  | 'equipment_hybrid_covers'
  | 'equipment_dj_package_interest'
  | 'equipment_hybrid_additions'
  | 'equipment_revisit_production_5b'
> {
  return {
    equipment_venue_includes: [],
    equipment_hybrid_covers: [],
    equipment_dj_package_interest: '',
    equipment_hybrid_additions: '',
    equipment_revisit_production_5b: false,
  }
}

export function EquipmentIntakeFlowCapture({
  sd,
  pricingCatalog,
  soundTechPickOptions = [],
  onPatch,
}: {
  sd: BookingIntakeShowDataV3
  pricingCatalog: PricingCatalogDoc
  soundTechPickOptions?: readonly EquipmentSoundTechPickOption[]
  onPatch: (partial: Partial<BookingIntakeShowDataV3>) => void
}) {
  const pkgCand = resolveProductionPackageCandidates(pricingCatalog)
  const addonCand = resolveVenueProductionAddonCandidates(pricingCatalog)

  const step1Complete =
    !!sd.equipment_provider && !!sd.equipment_mic && !!sd.equipment_sound_tech

  const showStep2 = step1Complete

  const showStep3Packages =
    showStep2 &&
    ((sd.equipment_provider === 'dj_brings' && sd.equipment_dj_package_interest === 'yes_walkthrough') ||
      (sd.equipment_provider === 'hybrid' && sd.equipment_hybrid_additions === 'yeah_see'))

  const showStep3VenueAddons =
    showStep2 &&
    sd.equipment_provider === 'venue_provides' &&
    !venueHasLightingEffects(sd.equipment_venue_includes)

  const showStep3 = showStep3Packages || showStep3VenueAddons

  const setProvider = (v: Exclude<Phase4EquipmentProviderV3, ''>) => {
    onPatch({
      ...STEP1_FLOW,
      equipment_provider: v,
      ...resetStep2Fields(),
    })
  }

  const patchDjInterest = (v: Exclude<EquipmentDjPackageInterestV3, ''>) => {
    onPatch({
      ...STEP1_FLOW,
      equipment_dj_package_interest: v,
      equipment_revisit_production_5b: v === 'think_later',
      ...(v !== 'yes_walkthrough'
        ? { pricing_mode: 'hourly', package_id: '' }
        : {}),
    })
  }

  const patchHybridAdditions = (v: Exclude<EquipmentHybridAdditionsV3, ''>) => {
    onPatch({
      ...STEP1_FLOW,
      equipment_hybrid_additions: v,
      equipment_revisit_production_5b: v === 'maybe_later',
      ...(v !== 'yeah_see' ? { pricing_mode: 'hourly', package_id: '' } : {}),
    })
  }

  const pickPackage = (packageId: string | null) => {
    if (!packageId) {
      onPatch({ ...STEP1_FLOW, pricing_mode: 'hourly', package_id: '' })
      return
    }
    onPatch({ ...STEP1_FLOW, pricing_mode: 'package', package_id: packageId })
  }

  const bumpAddon = (addonId: string | null, qty: number) => {
    if (!addonId) return
    const next = { ...sd.addon_quantities }
    if (qty <= 0) delete next[addonId]
    else next[addonId] = qty
    onPatch({ ...STEP1_FLOW, addon_quantities: next })
  }

  const clearVenueFlowAddons = () => {
    const next = { ...sd.addon_quantities }
    for (const id of [addonCand.lighting?.id, addonCand.effects?.id, addonCand.danceFloor?.id].filter(
      Boolean,
    ) as string[]) {
      delete next[id]
    }
    onPatch({ ...STEP1_FLOW, addon_quantities: next })
  }

  const packageScriptDjHybrid =
    'So we’ve got three production packages — they include the sound, lighting, everything so the venue doesn’t have to worry about a thing.'

  const packageScriptVenueNoLight =
    'Perfect, the sound’s handled. One thing that always hits different is when the visuals match the energy — we’ve got some lighting and effects options if you want to make it more of a moment.'

  const step3Script = showStep3VenueAddons ? packageScriptVenueNoLight : packageScriptDjHybrid

  const soundTechSel = soundTechSelectValue(soundTechPickOptions, sd)

  const clearSoundTechToNo = () => {
    onPatch({
      ...STEP1_FLOW,
      equipment_sound_tech: 'no',
      equipment_sound_tech_contact_id: null,
      equipment_sound_tech_name: '',
    })
  }

  const setSoundTechYes = () => {
    onPatch({ ...STEP1_FLOW, equipment_sound_tech: 'yes' })
  }

  const setSoundTechNo = () => {
    onPatch({
      ...STEP1_FLOW,
      equipment_sound_tech: 'no',
      equipment_sound_tech_contact_id: null,
      equipment_sound_tech_name: '',
    })
  }

  const onSoundTechSelect = (v: string) => {
    if (v === '__none__') {
      onPatch({
        ...STEP1_FLOW,
        equipment_sound_tech_contact_id: null,
        equipment_sound_tech_name: '',
      })
      return
    }
    if (v === '__other__') {
      onPatch({
        ...STEP1_FLOW,
        equipment_sound_tech_contact_id: null,
        equipment_sound_tech_name: '',
      })
      return
    }
    const opt = soundTechPickOptions.find(o => o.id === v)
    if (opt) {
      onPatch({
        ...STEP1_FLOW,
        equipment_sound_tech_contact_id: opt.contactId,
        equipment_sound_tech_name: opt.name,
      })
    }
  }

  return (
    <div className="space-y-5 min-w-0">
      <div className="space-y-3">
        <SingleSelectChipRow
          label="DJ equipment"
          value={sd.equipment_provider}
          options={[
            { id: 'venue_provides', label: 'Venue provides' },
            { id: 'dj_brings', label: 'DJ brings own' },
            { id: 'hybrid', label: 'Hybrid' },
          ]}
          onChange={setProvider}
        />
        <SingleSelectChipRow
          label="Mic"
          value={sd.equipment_mic}
          options={[
            { id: 'venue_has_mic', label: 'Venue has mic' },
            { id: 'dj_brings_mic', label: 'DJ brings mic' },
            { id: 'not_discussed', label: 'Not discussed' },
          ]}
          onChange={v => onPatch({ ...STEP1_FLOW, equipment_mic: v as EquipmentMicV3 })}
        />
        <div className="space-y-1.5 min-w-0">
          <Label className="text-neutral-400 text-xs">Sound tech on site</Label>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <div
              className="inline-flex rounded-lg border border-white/[0.08] p-0.5 bg-neutral-900/50 gap-0.5 shrink-0"
              role="group"
              aria-label="Sound tech on site"
            >
              <button
                type="button"
                onClick={setSoundTechYes}
                className={cn(
                  'px-3 py-2 text-xs font-medium rounded-md transition-colors min-h-10',
                  sd.equipment_sound_tech === 'yes'
                    ? 'bg-neutral-100 text-neutral-950'
                    : 'text-neutral-400 hover:text-neutral-200',
                )}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={setSoundTechNo}
                className={cn(
                  'px-3 py-2 text-xs font-medium rounded-md transition-colors min-h-10',
                  sd.equipment_sound_tech === 'no'
                    ? 'bg-neutral-100 text-neutral-950'
                    : 'text-neutral-400 hover:text-neutral-200',
                )}
              >
                No
              </button>
            </div>
            {sd.equipment_sound_tech === 'yes' ? (
              <>
                {soundTechPickOptions.length > 0 ? (
                  <>
                    <Select value={soundTechSel} onValueChange={onSoundTechSelect}>
                      <SelectTrigger className="h-11 w-[min(100%,260px)] border-neutral-800 bg-neutral-950/80 shrink-0">
                        <SelectValue placeholder="Who is the sound tech?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {soundTechPickOptions.map(o => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="__other__">Other name…</SelectItem>
                      </SelectContent>
                    </Select>
                    {soundTechSel === '__other__' ? (
                      <div className="relative flex-1 min-w-[140px] max-w-[280px]">
                        <Input
                          className="h-11 border-neutral-800 bg-neutral-950/80 pr-10"
                          placeholder="Sound tech name"
                          value={sd.equipment_sound_tech_name}
                          onChange={e =>
                            onPatch({
                              ...STEP1_FLOW,
                              equipment_sound_tech_contact_id: null,
                              equipment_sound_tech_name: e.target.value,
                            })
                          }
                        />
                        <button
                          type="button"
                          aria-label="Mark no sound tech on site"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/80"
                          onClick={clearSoundTechToNo}
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label="Mark no sound tech on site"
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-neutral-900/50 text-neutral-500 hover:text-neutral-200 hover:border-white/20"
                        onClick={clearSoundTechToNo}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="relative flex-1 min-w-[140px] max-w-[280px]">
                    <Input
                      className="h-11 border-neutral-800 bg-neutral-950/80 pr-10"
                      placeholder="Sound tech name"
                      value={sd.equipment_sound_tech_name}
                      onChange={e =>
                        onPatch({
                          ...STEP1_FLOW,
                          equipment_sound_tech_contact_id: null,
                          equipment_sound_tech_name: e.target.value,
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Mark no sound tech on site"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/80"
                      onClick={clearSoundTechToNo}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {showStep2 && sd.equipment_provider === 'venue_provides' ? (
        <div
          className={cn(
            'space-y-3 pt-2 border-t border-white/[0.06] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
          )}
        >
          <IntakeInlineScriptBlock>
            <p>
              Nice, you’ve got the full setup. Does that include lighting effects, or is it just like the sound system?
            </p>
          </IntakeInlineScriptBlock>
          <IntakeCompactChipRow
            label="Venue setup includes"
            selected={sd.equipment_venue_includes}
            ids={EQUIPMENT_VENUE_INCLUDES_KEYS}
            labels={EQUIPMENT_VENUE_INCLUDES_LABELS}
            onChange={next => onPatch({ ...STEP1_FLOW, equipment_venue_includes: [...next] })}
          />
        </div>
      ) : null}

      {showStep2 && sd.equipment_provider === 'dj_brings' ? (
        <div
          className={cn(
            'space-y-3 pt-2 border-t border-white/[0.06] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
          )}
        >
          <IntakeInlineScriptBlock>
            <p>
              Got it — so Luijay’s handling the production. We actually have a few setups we offer depending on how
              big you want to go. Want me to walk you through the options real quick?
            </p>
          </IntakeInlineScriptBlock>
          <SingleSelectChipRow
            label="Client interested?"
            value={sd.equipment_dj_package_interest}
            options={[
              { id: 'yes_walkthrough', label: 'Yeah — walk me through it' },
              { id: 'no_simple', label: 'No — keep it simple' },
              { id: 'think_later', label: 'Let me think about it' },
            ]}
            onChange={patchDjInterest}
          />
        </div>
      ) : null}

      {showStep2 && sd.equipment_provider === 'hybrid' ? (
        <div
          className={cn(
            'space-y-3 pt-2 border-t border-white/[0.06] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
          )}
        >
          <IntakeInlineScriptBlock>
            <p>
              Okay — so the venue’s got some of it and Luijay fills in the rest. What does the venue have covered, and
              we’ll figure out what Luijay needs to bring?
            </p>
          </IntakeInlineScriptBlock>
          <IntakeCompactChipRow
            label="Venue covers"
            selected={sd.equipment_hybrid_covers}
            ids={EQUIPMENT_HYBRID_COVER_KEYS}
            labels={EQUIPMENT_HYBRID_COVER_LABELS}
            onChange={next => onPatch({ ...STEP1_FLOW, equipment_hybrid_covers: [...next] })}
          />
          <SingleSelectChipRow
            label="Want to see what Luijay can add to the production?"
            value={sd.equipment_hybrid_additions}
            options={[
              { id: 'yeah_see', label: 'Yeah — let’s see' },
              { id: 'no_good', label: 'No — we’re good' },
              { id: 'maybe_later', label: 'Maybe — revisit later' },
            ]}
            onChange={patchHybridAdditions}
          />
        </div>
      ) : null}

      {showStep3 ? (
        <div
          className={cn(
            'space-y-3 pt-2 border-t border-white/[0.06] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
          )}
        >
          <IntakeInlineScriptBlock>
            <p>{step3Script}</p>
          </IntakeInlineScriptBlock>

          {showStep3Packages ? (
            <div className="space-y-2">
              <Label className="text-neutral-400 text-xs">Production packages</Label>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { key: 'premium' as const, pkg: pkgCand.premium, blurb: 'Sound (12" tops) + console + 4 hrs' },
                    {
                      key: 'platinum' as const,
                      pkg: pkgCand.platinum,
                      blurb: 'Sound (14" + subs) + lighting + wireless mic + 4 hrs',
                    },
                    {
                      key: 'exclusive' as const,
                      pkg: pkgCand.exclusive,
                      blurb: 'Full production — sound, subs, motorized console, lighting, wireless mic + 4+ hrs',
                    },
                  ] as const
                ).map(row => {
                  const p = row.pkg
                  const selected = p && sd.pricing_mode === 'package' && sd.package_id === p.id
                  return (
                    <button
                      key={row.key}
                      type="button"
                      disabled={!p}
                      onClick={() => pickPackage(p?.id ?? null)}
                      className={cn(
                        'w-full text-left rounded-lg border px-3 py-3 transition-colors min-h-[72px]',
                        selected
                          ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                          : 'border-white/[0.08] bg-neutral-900/50 text-neutral-200 hover:border-white/20',
                        !p && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Star
                          className={cn(
                            'h-4 w-4 shrink-0 mt-0.5',
                            selected ? 'text-amber-600 fill-amber-500/25' : 'text-amber-400/90 fill-amber-400/15',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-sm font-semibold leading-snug">
                            {p ? `${p.name} — $${p.price} flat` : `${row.key} — add in Pricing catalog`}
                          </p>
                          <p className="text-[11px] text-neutral-500 leading-snug">{row.blurb}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => pickPackage(null)}
                  className={cn(
                    'w-full text-left rounded-lg border px-3 py-3 transition-colors min-h-[56px] text-sm font-medium',
                    sd.pricing_mode !== 'package' || !sd.package_id.trim()
                      ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                      : 'border-white/[0.08] bg-neutral-900/50 text-neutral-200 hover:border-white/20',
                  )}
                >
                  No package — just the base rate
                </button>
              </div>
            </div>
          ) : null}

          {showStep3VenueAddons ? (
            <div className="space-y-2">
              <Label className="text-neutral-400 text-xs">Add visual production</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: addonCand.lighting?.id ?? null,
                      title: 'Additional Lighting',
                      price: addonCand.lighting ? `$${addonCand.lighting.price} / setup` : '$350 / setup',
                      sub: 'Tower lighting, LED uplights, and moving heads — the full stage look.',
                    },
                    {
                      id: addonCand.effects?.id ?? null,
                      title: 'Visual Effects',
                      price: addonCand.effects ? `$${addonCand.effects.price} / effect` : '$400 / effect',
                      sub: 'CO2, cold sparks',
                    },
                    {
                      id: addonCand.danceFloor?.id ?? null,
                      title: 'LED Dance Floor',
                      price:
                        addonCand.danceFloor?.priceType === 'per_sq_ft'
                          ? `$${addonCand.danceFloor.price} / sq ft`
                          : '$15 / sq ft',
                      sub: '',
                    },
                  ] as const
                ).map(tile => {
                  const q = tile.id ? sd.addon_quantities[tile.id] ?? 0 : 0
                  const on = tile.id && q > 0
                  return (
                    <button
                      key={tile.title}
                      type="button"
                      disabled={!tile.id}
                      onClick={() => {
                        if (!tile.id) return
                        bumpAddon(tile.id, on ? 0 : 1)
                      }}
                      className={cn(
                        'text-left rounded-lg border px-3 py-3 transition-colors min-h-[88px]',
                        on
                          ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                          : 'border-white/[0.08] bg-neutral-900/50 text-neutral-200 hover:border-white/20',
                        !tile.id && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <p className="text-sm font-semibold">{tile.title}</p>
                      <p className="text-[11px] text-neutral-500 mt-1">{tile.price}</p>
                      {tile.sub ? <p className="text-[10px] text-neutral-600 mt-0.5">{tile.sub}</p> : null}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => clearVenueFlowAddons()}
                  className={cn(
                    'text-left rounded-lg border px-3 py-3 transition-colors min-h-[88px] text-sm font-medium',
                    !addonCand.lighting && !addonCand.effects && !addonCand.danceFloor
                      ? 'border-white/[0.08] bg-neutral-900/50 text-neutral-200'
                      : 'border-white/[0.08] bg-neutral-900/50 text-neutral-200 hover:border-white/20',
                  )}
                >
                  None — we’re good
                </button>
              </div>
              {!addonCand.lighting && !addonCand.effects && !addonCand.danceFloor ? (
                <p className="text-[11px] text-neutral-500">
                  No matching add-ons in your catalog — add lighting, effects, or dance floor items under Earnings →
                  Pricing to enable one-tap prefill here.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
