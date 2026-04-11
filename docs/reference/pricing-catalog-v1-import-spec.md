# Pricing catalog v1 — import interchange spec

**Purpose:** Canonical reference for generating JSON that the Artist Manager app accepts via **Earnings → Pricing & fees → Import**. Use this document (and the paired example file) as the single source of truth for another AI or tooling.

**Paired file:** [`pricing-catalog.v1.example.json`](./pricing-catalog.v1.example.json) — a **maximal, valid** illustration (all addon `priceType` variants, mixed services, surcharges, discounts).

---

## Name of this format

- **Type:** `PricingCatalogDoc` v1  
- **Storage:** `user_pricing_catalog.doc` (JSONB, one row per manager)  
- **Import behavior:** **Full replace** of the catalog after confirm — not a merge.

---

## Hard requirements (import will fail)

| Rule | Detail |
|------|--------|
| **Valid JSON** | Must parse with `JSON.parse`. |
| **Root object** | Top-level value must be a plain object. |
| **`v` field** | Must be exactly **`1`** (number). Any other value → error, no import. |

---

## Minimum viable document

If you only need defaults for policies and empty lists:

```json
{
  "v": 1
}
```

The importer **coerces** missing pieces:

- Missing `policies` → defaults: `defaultDepositPercent` **50**, `salesTaxPercent` **0**, `minimumBillableHours` **0**.
- Missing or non-array `packages`, `services`, `addons`, `discounts`, `surcharges` → **[]**.

To **log deals**, the product expects at least one **package** or **service** in practice; an empty catalog is valid JSON but blocks deal logging in the UI.

---

## Policies (`policies`)

| Field | Type | Coercion / limits |
|-------|------|-------------------|
| `defaultDepositPercent` | number | Clamped **0–100**. Non-finite → fallback (default **50** if entire `policies` missing; else field default from same object). |
| `salesTaxPercent` | number | Clamped **0–100**. |
| `minimumBillableHours` | number | **≥ 0**, not capped (fractions allowed). |

**Nuances:** Values are **not** restricted to integers; decimals are fine for tax. Deposit is a **percent**, not dollars.

---

## Packages (`packages`)

Array of objects. **Non-objects are skipped** (silent). Order is preserved.

| Field | Required | Type | Coercion / limits |
|-------|----------|------|-------------------|
| `id` | Recommended | string | If missing or blank, a new id is generated. **Duplicate ids within `packages`** → later duplicates get new ids. **Keep stable ids** when re-importing so existing `deals.pricing_snapshot` references stay valid. |
| `name` | Implicit | string | Non-string → fallback `Package {index}`. |
| `price` | Implicit | number | **Whole dollars** after import: `Math.max(0, Math.round(...))`. |
| `hoursIncluded` | Implicit | number | Non-negative integer (floored). |
| `bullets` | Implicit | string[] | Non-array → `[]`. Elements coerced to trimmed strings; empty strings dropped. |

**How far you can go:** No hard max on array length or bullet count; keep JSON reasonably sized for paste/file UX.

---

## Services (`services`) — hourly / flat

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Same id rules as packages (dedupe within `services`). |
| `name` | string | Fallback `Service {index}`. |
| `category` | string optional | Omitted if null/empty after coerce. |
| `price` | number | Non-negative, **rounded to whole dollars**. |
| `priceType` | string | **Only** `"per_hour"` or `"flat_rate"`. Anything else → **`"per_hour"`**. |
| `dayType` | string | **Only** `"weekday"`, `"weekend"`, or `"any"`. Invalid/missing → **`"any"`**. |

**Weekend rule in the app:** “Weekend” is Fri–Sun for rate picking from the event date (`computeDealPrice` / `pickDefaultServiceId`).

---

## Add-ons (`addons`)

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Dedupe within `addons`. |
| `name` | string | Fallback `Add-on {index}`. |
| `category` | string optional | |
| `price` | number | Non-negative whole dollars after round. |
| `priceType` | string | **Must be one of:** `"flat_fee"`, `"per_event"`, `"per_artist"`, `"per_sq_ft"`, `"per_effect"`, `"per_setup"`. Invalid → **`"flat_fee"`**. |
| `unitLabel` | string optional | UI-only hint (e.g. `"sq ft"` for `per_sq_ft`). |

---

## Discounts (`discounts`)

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Dedupe within `discounts`. |
| `name` | string | Fallback `Discount {index}`. |
| `clientType` | string optional | Free-form label (e.g. `"returning"`). |
| `percent` | number | Clamped **0–100** (percent off, not decimal0.1). |

---

## Surcharges (`surcharges`)

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Dedupe within `surcharges`. |
| `name` | string | Fallback `Surcharge {index}`. |
| `multiplier` | number | **≥ 1** after coerce. Example: `1.35` = +35% on subtotal after add-ons (per app pricing order). |

---

## Limitations the importer does **not** solve

- **Deal snapshots:** `deals.pricing_snapshot` stores `packageId`, `serviceId`, `addonQuantities` keys, etc. If you **change or remove** catalog line ids, old deals may not line up until terms are recalculated. Prefer **export → edit → import** while **preserving `id` strings**.
- **No partial merge:** Import replaces the **entire** catalog document.
- **No CSV:** Only JSON is supported.
- **Version:** Only **`v: 1`** is accepted today.

---

## Verification checklist (for generated files)

1. `v === 1` (number).  
2. All enums exactly as spelled above (case-sensitive).  
3. Prefer explicit **`id`** on every line item you care to reference from deals.  
4. Run **Review import** in the app before **Confirm replace**.  
5. Optional: compare shape to [`pricing-catalog.v1.example.json`](./pricing-catalog.v1.example.json).

---

## Migrations / database

This format is **application-level JSON** only. **`user_pricing_catalog`** is created in migration `045_user_pricing_catalog_and_deals_pricing.sql`; importing does not require new migrations.
