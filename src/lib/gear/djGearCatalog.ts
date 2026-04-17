/** Static DJ gear reference for intake — not a DB table. */

export type GearCompatTier = 'yes' | 'no' | 'warn'

export type DeckKindV3 = 'cdj' | 'controller' | 'turntable' | 'all_in_one'

export type MixerBrandKeyV3 = 'pioneer_djm' | 'rane' | 'allen_heath'

export const GEAR_MODEL_OTHER_ID = '__gear_other__'

export type GearDeckRow = {
  id: string
  display: string
  deckKind: DeckKindV3
  compat: GearCompatTier
}

export type GearMixerRow = {
  id: string
  display: string
  brand: MixerBrandKeyV3
  compat: GearCompatTier
}

const D: GearDeckRow[] = [
  { id: 'pioneer-cdj-3000', display: 'Pioneer CDJ-3000', deckKind: 'cdj', compat: 'yes' },
  { id: 'pioneer-cdj-2000nxs2', display: 'Pioneer CDJ-2000NXS2', deckKind: 'cdj', compat: 'yes' },
  { id: 'pioneer-cdj-2000nxs', display: 'Pioneer CDJ-2000NXS', deckKind: 'cdj', compat: 'yes' },
  { id: 'pioneer-cdj-900nxs', display: 'Pioneer CDJ-900NXS', deckKind: 'cdj', compat: 'yes' },
  { id: 'pioneer-cdj-900', display: 'Pioneer CDJ-900', deckKind: 'cdj', compat: 'warn' },
  { id: 'pioneer-cdj-850', display: 'Pioneer CDJ-850', deckKind: 'cdj', compat: 'warn' },
  { id: 'denon-sc6000', display: 'Denon SC6000', deckKind: 'cdj', compat: 'no' },
  { id: 'denon-sc6000m', display: 'Denon SC6000M', deckKind: 'cdj', compat: 'no' },
  { id: 'pioneer-ddj-1000', display: 'Pioneer DDJ-1000', deckKind: 'controller', compat: 'yes' },
  { id: 'pioneer-ddj-rev7', display: 'Pioneer DDJ-REV7', deckKind: 'controller', compat: 'yes' },
  { id: 'pioneer-xdj-xz', display: 'Pioneer XDJ-XZ', deckKind: 'controller', compat: 'yes' },
  { id: 'pioneer-ddj-flx10', display: 'Pioneer DDJ-FLX10', deckKind: 'controller', compat: 'warn' },
  { id: 'pioneer-ddj-flx6', display: 'Pioneer DDJ-FLX6', deckKind: 'controller', compat: 'warn' },
  { id: 'pioneer-ddj-sx3', display: 'Pioneer DDJ-SX3', deckKind: 'controller', compat: 'warn' },
  { id: 'pioneer-ddj-400', display: 'Pioneer DDJ-400', deckKind: 'controller', compat: 'no' },
  { id: 'pioneer-ddj-200', display: 'Pioneer DDJ-200', deckKind: 'controller', compat: 'no' },
  { id: 'pioneer-ddj-flx4', display: 'Pioneer DDJ-FLX4', deckKind: 'controller', compat: 'no' },
  { id: 'denon-sc-live-4', display: 'Denon SC Live 4', deckKind: 'controller', compat: 'no' },
  { id: 'denon-sc-live-2', display: 'Denon SC Live 2', deckKind: 'controller', compat: 'no' },
  { id: 'denon-prime-4', display: 'Denon Prime 4', deckKind: 'controller', compat: 'no' },
  { id: 'denon-prime-4-plus', display: 'Denon Prime 4+', deckKind: 'controller', compat: 'no' },
  { id: 'denon-prime-go', display: 'Denon Prime Go', deckKind: 'controller', compat: 'no' },
  { id: 'denon-prime-2', display: 'Denon Prime 2', deckKind: 'controller', compat: 'no' },
  { id: 'numark-mixtrack-pro', display: 'Numark Mixtrack Pro', deckKind: 'controller', compat: 'no' },
  { id: 'numark-mixtrack-platinum', display: 'Numark Mixtrack Platinum', deckKind: 'controller', compat: 'no' },
  { id: 'hercules-any', display: 'Hercules (any model)', deckKind: 'controller', compat: 'no' },
  { id: 'technics-sl1200', display: 'Technics SL-1200 (any variant)', deckKind: 'turntable', compat: 'yes' },
  { id: 'technics-sl1210', display: 'Technics SL-1210 (any variant)', deckKind: 'turntable', compat: 'yes' },
  { id: 'pioneer-plx-1000', display: 'Pioneer PLX-1000', deckKind: 'turntable', compat: 'yes' },
  { id: 'reloop-rp-7000', display: 'Reloop RP-7000 MK2', deckKind: 'turntable', compat: 'warn' },
  { id: 'audio-technica-lp120', display: 'Audio-Technica AT-LP120', deckKind: 'turntable', compat: 'warn' },
  { id: 'pioneer-xdj-xz-aio', display: 'Pioneer XDJ-XZ', deckKind: 'all_in_one', compat: 'yes' },
  { id: 'denon-sc-live-4-aio', display: 'Denon SC Live 4', deckKind: 'all_in_one', compat: 'no' },
  { id: 'denon-sc-live-2-aio', display: 'Denon SC Live 2', deckKind: 'all_in_one', compat: 'no' },
  { id: 'denon-prime-4-aio', display: 'Denon Prime 4', deckKind: 'all_in_one', compat: 'no' },
  { id: 'denon-prime-go-aio', display: 'Denon Prime Go', deckKind: 'all_in_one', compat: 'no' },
  { id: 'denon-prime-2-aio', display: 'Denon Prime 2', deckKind: 'all_in_one', compat: 'no' },
]

const M: GearMixerRow[] = [
  { id: 'pioneer-djm-a9', display: 'Pioneer DJM-A9', brand: 'pioneer_djm', compat: 'yes' },
  { id: 'pioneer-djm-900nxs2', display: 'Pioneer DJM-900NXS2', brand: 'pioneer_djm', compat: 'yes' },
  { id: 'pioneer-djm-900nxs', display: 'Pioneer DJM-900NXS', brand: 'pioneer_djm', compat: 'yes' },
  { id: 'pioneer-djm-s11', display: 'Pioneer DJM-S11', brand: 'pioneer_djm', compat: 'yes' },
  { id: 'pioneer-djm-s9', display: 'Pioneer DJM-S9', brand: 'pioneer_djm', compat: 'yes' },
  { id: 'pioneer-djm-750mk2', display: 'Pioneer DJM-750MK2', brand: 'pioneer_djm', compat: 'yes' },
  { id: 'pioneer-djm-450', display: 'Pioneer DJM-450', brand: 'pioneer_djm', compat: 'warn' },
  { id: 'rane-seventy-two-mkii', display: 'Rane Seventy-Two MKII', brand: 'rane', compat: 'yes' },
  { id: 'rane-72', display: 'Rane 72', brand: 'rane', compat: 'yes' },
  { id: 'rane-seventy', display: 'Rane Seventy', brand: 'rane', compat: 'yes' },
  { id: 'allen-heath-xone96', display: 'Allen & Heath Xone:96', brand: 'allen_heath', compat: 'yes' },
  { id: 'allen-heath-xone92', display: 'Allen & Heath Xone:92', brand: 'allen_heath', compat: 'yes' },
  { id: 'allen-heath-xone43c', display: 'Allen & Heath Xone:43C', brand: 'allen_heath', compat: 'warn' },
]

export const DJ_GEAR_DECKS: readonly GearDeckRow[] = D
export const DJ_GEAR_MIXERS: readonly GearMixerRow[] = M

const deckById = new Map(D.map(r => [r.id, r]))
const mixerById = new Map(M.map(r => [r.id, r]))

export function getDeckById(id: string): GearDeckRow | undefined {
  return deckById.get(id)
}

export function getMixerById(id: string): GearMixerRow | undefined {
  return mixerById.get(id)
}

export function listDecksForKind(kind: DeckKindV3): GearDeckRow[] {
  return D.filter(r => r.deckKind === kind)
}

export function listMixersForBrand(brand: MixerBrandKeyV3): GearMixerRow[] {
  return M.filter(r => r.brand === brand)
}

export function filterDecksByQuery(rows: readonly GearDeckRow[], q: string): GearDeckRow[] {
  const n = q.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!n) return [...rows]
  return rows.filter(r => r.display.toLowerCase().includes(n) || r.id.toLowerCase().includes(n))
}

export function filterMixersByQuery(rows: readonly GearMixerRow[], q: string): GearMixerRow[] {
  const n = q.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!n) return [...rows]
  return rows.filter(r => r.display.toLowerCase().includes(n) || r.id.toLowerCase().includes(n))
}

export function compatTierToBool(tier: GearCompatTier): boolean | null {
  if (tier === 'yes') return true
  if (tier === 'no') return false
  return null
}
