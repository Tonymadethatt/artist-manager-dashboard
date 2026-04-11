# Document template v1 — JSON import interchange spec

**Purpose:** Canonical reference for generating JSON that the Artist Manager app accepts via **Documents → Import JSON**. Give this file (and the paired example JSON) to an AI or external tool as the single source of truth so imports validate on first try and render correctly in **File Builder** (HTML preview and PDF).

**Paired file:** `document-template.v1.example.json` — download from the import dialog (**Spec** / **Example** buttons), or open `/reference/document-template.v1.example.json` on your deployed site. The example is a **maximal** illustration: header + multiple body sections + a **`signatures`** execution block + footer, rich formatting, every merge token category, an intentional `<h1>` to demonstrate heading normalization, and a two-column signature table with `{{artist_name}}` / `{{venue_name}}`.

---

## Name of this format

- **Type:** Document template import **v1** (not stored as `v` on the `templates` table row — `v` is **only** for interchange validation).
- **Storage:** `templates` (`name`, `type`, `sections` JSONB) per authenticated user.
- **Import behavior:** Creates a **new** template row after confirm. Existing templates are not modified.

---

## Hard requirements (import will fail)

| Rule | Detail |
|------|--------|
| **Valid JSON** | Must parse with `JSON.parse`. |
| **Root object** | Top-level value must be a plain object (not an array). |
| **`v` field** | Must be exactly **`1`** (number). Any other value → error. |
| **`name`** | Non-empty string after trim. |
| **`type`** | Exactly **`"agreement"`** or **`"invoice"`** (string). |
| **`sections`** | Non-empty array; every element must be an object (not an array). |
| **Body / signatures labels** | Each section with `section_kind` **`body`** or **`signatures`** (or omitted, defaulting to body) must have a **non-empty** `label` (trimmed). Shown as a section title in PDF/HTML (body uses the standard section heading style; signatures use a formal execution-block title style). |
| **`section_kind`** | If present, must be **`"header"`**, **`"body"`**, **`"footer"`**, or **`"signatures"`**. Invalid string → error. Omitted → **`"body"`**. |
| **`content`** | If present, must be a **string** (may be empty). |
| **`label`** | If present, must be a **string**. |
| **`header_logo_url`** | On **header** sections only: must be `null`, omitted, or a **string**. If non-empty, must be `https://`, `http://`, or `data:image/…` (same rules as the in-app logo field). |

**CamelCase aliases (optional):** `sectionKind` is accepted as an alias for `section_kind`; `headerLogoUrl` for `header_logo_url`.

---

## Root document shape

```json
{
  "v": 1,
  "name": "Standard performance agreement",
  "type": "agreement",
  "sections": [ /* TemplateSection[] */ ]
}
```

| Field | Required | Type | Notes |
|-------|----------|------|--------|
| `v` | yes | number | Must be `1`. |
| `name` | yes | string | Trimmed; must not be empty. |
| `type` | yes | string | `agreement` or `invoice` (drives badge + semantics in app; rendering pipeline is the same). |
| `sections` | yes | array | At least one section object. |

---

## Section object

| Field | Required | Type | Default / notes |
|-------|----------|------|------------------|
| `id` | recommended | string | Stable id helps you diff re-imports; if missing or duplicate, a new id is generated. |
| `label` | yes for body / signatures | string | **Header/footer:** may be empty (internal only, not shown as a big section title). **Body / signatures:** must be non-empty — becomes the section title above that block (e.g. “Signatures” or “Execution”). |
| `section_kind` | no | string | `header` \| `body` \| `footer` \| `signatures`. Omitted → `body`. |
| `content` | no | string | HTML fragment and/or plain text (see below). Omitted → `""`. |
| `header_logo_url` | no | string \| null | Only meaningful when `section_kind` is `header`. For other kinds, coerced to `null` on import. |

**Ordering:** Preserved. Render pipeline order: **headers** (under logo) → **bodies** → **signatures** → **footer** sections → generated timestamp line.

**Layout split:** If **any** section has `section_kind` other than **`body`** (i.e. `header`, `footer`, or `signatures`), the app partitions sections: all headers first (in order), then bodies, then signatures, then footers. If **every** section is body (or `section_kind` omitted), **legacy behavior** applies: every section is treated as **body** (all get titled with their labels).

---

## Signatures (`section_kind: "signatures"`)

Use this for a **professional execution block** at the end of the agreement (signature lines, printed names, dates, titles). It is **not** the same as **footer**: footers are small-print / boilerplate above the “Generated …” line; **signatures** is a full-width block with its own typography (top rule, subdued title, two-column table layout for print).

**Label:** Required, non-empty — shown as the section title above the block (e.g. `Signatures`, `Execution`, `Counterparts`).

**Content:** HTML (or plain text coerced to paragraphs) — typically:

- A short **witness** line (`<em>IN WITNESS WHEREOF</em>, …`).
- A **two-column `<table>`**: Artist / Performer vs Venue / Authorized representative, underscore lines for wet signatures, `{{artist_name}}`, `{{venue_name}}`, date lines, and optional “By:” / “Title:” lines for the venue side.

The in-app template editor seeds this layout when you add or switch a section to **Signatures**; you can replace it entirely or merge extra tokens (e.g. `{{contact_name}}`).

**Styling:** The PDF/HTML stylesheet applies `.signatures-sec` rules: top border, restrained title, borderless two-column table, monospace-style underscore line for the first line in each cell. Inner markup is still run through the same sanitizer as body content.

---

## `content`: HTML vs plain text

1. **HTML detection** aligns with the app: if the string matches the internal HTML heuristic (e.g. contains tags like `<p>`, `<ul>`, `<strong>`, `<h3>`, etc.), it is treated as **HTML**.
2. Otherwise the string is treated as **plain text**: paragraphs split on **blank lines** (`\n\n`+), each paragraph wrapped in `<p>…</p>`, single newlines inside a paragraph become `<br>`.

**Bold / italic:** Use `<strong>…</strong>` or `<b>…</b>`; `<em>…</em>` or `<i>…</i>`.

**Subheadings:** Prefer `<h3>` and `<h4>` in HTML. TipTap’s toolbar emits `<h3>` for “subheading.”

**Lists:** `<ul><li>…</li></ul>`, `<ol><li>…</li></ol>`.

**Tables:** `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` (optional `<tfoot>`). Use `colspan` / `rowspan` attributes if needed (allowed through sanitization).

**Other allowed tags** (survive PDF sanitization): `p`, `br`, `hr`, `div`, `span`, `u`, `s`, `blockquote`, `pre`, `code`.

**Disallowed / stripped:** Tags not in the allowlist (e.g. `<script>`, `<img>`, `<a>`, `<h5>`) are removed by the sanitizer at render time. Do not rely on them.

---

## Heading normalization on import

`<h1>` and `<h2>` in imported HTML are rewritten to **`<h3>`** (open and close tags) so they survive DOMPurify’s allowlist and match print styles. After import, stored content uses `<h3>`. The paired example JSON includes an `<h1>` line to verify this behavior.

---

## Merge tokens (variables)

**Syntax:** `{{token_name}}` where `token_name` matches `/^\w+$/` (letters, digits, underscore only). **No hyphens.**

**Discovery:** File Builder scans template `content` for `{{…}}` and lists those keys. The slash-menu also offers the **canonical catalog** below plus any extra keys found in the template.

**Filling:** When you pick a venue, deal (optional), and contact (optional), the app builds a key→string map (`buildAgreementPrefill`):

- **Venue** fields populate venue group tokens.
- **Artist profile** (Settings) populates artist group tokens.
- **Deal** populates deal group tokens; some override venue dates/amounts where applicable.
- **Selected contact** populates contact tokens; may also set `company_name` when the artist company in Settings is empty.

**Rendering:**

- **HTML / PDF:** Values are **HTML-escaped** when substituted, so user data cannot inject markup. **Exception:** `{{pricing_fee_transparency_table_html}}` is app-generated markup only; it is passed through **DOMPurify** with the same allowlist as body HTML (including `<table>`), not character-escaped. If a key is missing from the map, the literal **`[token_name]`** is inserted for `{{token_name}}` placeholders (after escape, it still displays as bracketed text).
- **Bracket tokens:** For **catalog** variable names only, `[token_name]` in section HTML is also replaced when that key exists in the merge map (helps AI exports that used square brackets). Keys outside the catalog are left unchanged.
- **Import:** JSON import rewrites known **`[catalog_token]`** segments to **`{{catalog_token}}`** so merges run consistently.
- **Plain-text export path** (if used): same `[token_name]` fallback for missing `{{}}` keys; catalog bracket substitution applies when the key is present in the map.

**Cancellation / full fee:** Use `{{full_fee_display}}` (or `{{cancellation_full_fee_display}}`) inside your clause text, e.g. `Full fee ({{full_fee_display}}) is due, as the Artist will have turned down other bookings to hold this date.`

**Fee transparency:** Near the payment schedule, add `{{pricing_fee_transparency_table_html}}` for a compact table (performance & agreed scope, bundled production/scheduling/compliance line when applicable, contract total). Optional: `{{pricing_fee_breakdown_note}}` when the deal gross was adjusted after the quote. Requires a deal with pricing snapshot; catalog loaded in File Builder fills scope/bundle rows.

---

## Header vs footer vs body in the rendered PDF/HTML

The print layout (`renderAgreementHtmlDocument`) uses:

1. **Top header band:** Optional **logo** (uploaded header `header_logo_url`, else default site logo), then **header sections** merged as **inline blocks** (no extra `<h2>` per section — only your HTML inside `content` shows).
2. **Company line:** `company_name` from Settings, else `artist_name`.
3. **Tagline:** profile tagline when set.
4. **Body sections:** Each body section’s **`label`** is rendered as an **`<h2>`** (uppercase styling in CSS), then sanitized `content` in a `.body` div.
5. **Signatures sections:** After all body sections, each **signatures** section’s **`label`** and **`content`** are rendered inside **`<section class="sec signatures-sec">`** with dedicated CSS (formal agreement look).
6. **Footer:** Footer sections (inline, like headers), then a generated **timestamp** line (`Generated …`).

So: **body and signatures labels are customer-facing section titles**; **header/footer labels are internal** and not printed as those big section headings.

---

## Canonical variable catalog

Each row: **Token**, **Meaning**, **Primary data source**, **Example value** (illustrative), **Example rendered** (what appears in the document when that value is substituted — HTML escaping turns `<` in data into text, etc.).

### Venue (`venues` + `deal_terms` on venue)

| Token | Meaning | Source | Example value | Rendered example |
|-------|---------|--------|---------------|------------------|
| `venue_name` | Venue name | `venues.name` | Blue Room | Blue Room |
| `city` | City | `venues.city` | Los Angeles | Los Angeles |
| `location` | Street line 1 | `venues.location` | 100 Main St | 100 Main St |
| `venue_type` | Venue type slug | `venues.venue_type` | `club` | club |
| `venue_type_label` | Human venue type | Map: bar→Bar, club→Club, festival→Festival, theater→Theater, lounge→Lounge, other→Other | Club | Club |
| `event_date` | Event date | `venue.deal_terms.event_date` if set; **overridden** by deal’s `event_date` when a deal is selected | 2026-06-15 | 2026-06-15 |
| `artist_pay` | Pay as raw string/number text | `deal_terms.pay` | 3500 | 3500 |
| `artist_pay_display` | Pay USD formatted | `Intl.NumberFormat` USD on `deal_terms.pay` | $3,500.00 | $3,500.00 |
| `set_length` | Set length | `deal_terms.set_length` | 90 min | 90 min |
| `load_in_time` | Load-in | `deal_terms.load_in_time` | 5:00 PM | 5:00 PM |
| `notes` | Venue terms notes | `deal_terms.notes` | Parking rear | Parking rear |
| `venue_capacity` | Capacity (flex text) | `venues.capacity` | 500 | 500 |

### Deal (`deals` row when selected in File Builder)

| Token | Meaning | Source | Example value | Rendered example |
|-------|---------|--------|---------------|------------------|
| `deal_description` | Deal title/description | `deals.description` | June 15 — Blue Room | June 15 — Blue Room |
| `event_name` | Same as deal description | `deals.description` | June 15 — Blue Room | June 15 — Blue Room |
| `deal_event_date` | Deal event date | `deals.event_date` | 2026-06-15 | 2026-06-15 |
| `event_start_time` | Event start (Pacific time) | `deals.event_start_at` | 21:00 | 9:00 PM |
| `event_end_time` | Event end (Pacific time) | `deals.event_end_at` | 02:00 | 2:00 AM |
| `event_date_display` | Event date (deal date or Pacific date) | `deals.event_date` or wall from `event_start_at` | 2026-06-15 | 2026-06-15 |
| `event_window_display` | Date + start–end times | derived | — | 2026-06-15 9:00 PM–2:00 AM |
| `performance_genre` | Set / performance genre | `deals.performance_genre` | House | House |
| `performance_start_time` | Set start (Pacific) | `deals.performance_start_at` | 22:00 | 10:00 PM |
| `performance_end_time` | Set end (Pacific) | `deals.performance_end_at` | 01:00 | 1:00 AM |
| `performance_date_display` | Set date display | deal `event_date` or wall from performance start | 2026-06-15 | 2026-06-15 |
| `performance_window_display` | Set date + times | derived | — | 2026-06-15 10:00 PM–1:00 AM |
| `onsite_contact_name` | On-site contact | `contacts` via `deals.onsite_contact_id` | Pat Lee | Pat Lee |
| `onsite_contact_role` | On-site role | `contacts.role` | Production | Production |
| `onsite_contact_email` | On-site email | `contacts.email` | pat@… | pat@… |
| `onsite_contact_phone` | On-site phone | `contacts.phone` | 555-0142 | 555-0142 |
| `onsite_contact_company` | On-site company | `contacts.company` | Venue LLC | Venue LLC |
| `gross_amount` | Gross (raw) | `deals.gross_amount` | 5000 | 5000 |
| `gross_amount_display` | Gross USD | formatted | $5,000.00 | $5,000.00 |
| `commission_rate` | Commission % for display | `deals.commission_rate` fraction × 100 + `%` | 20% | 20% |
| `commission_rate_fraction` | Stored fraction | `deals.commission_rate` | 0.2 | 0.2 |
| `commission_amount` | Commission dollars raw | `deals.commission_amount` | 1000 | 1000 |
| `commission_amount_display` | Commission USD | formatted | $1,000.00 | $1,000.00 |
| `commission_tier` | Tier label | Map: new_doors→New Doors, kept_doors→Kept Doors, bigger_doors→Bigger Doors, artist_network→Artist network | New Doors | New Doors |
| `payment_due_date` | Due date | `deals.payment_due_date` | 2026-06-01 | 2026-06-01 |
| `agreement_url` | Agreement URL | `deals.agreement_url` | https://… | https://… |
| `deal_notes` | Deal notes | `deals.notes` | Wire net 30 | Wire net 30 |
| `pricing_summary_text` | Multi-line pricing summary | Built from `deals.pricing_snapshot` when present (v1 snapshot): lines for total, optional tax, deposit, basis | *(multi-line)* | Quote total: $4,200\nTax: … |
| `pricing_total_display` | Snapshot total USD | `pricing_snapshot.total` | $4,200 | $4,200 |
| `pricing_deposit_display` | Snapshot deposit USD | `pricing_snapshot.depositDue` | $2,100 | $2,100 |

If no deal is selected, deal-group tokens are empty → **`[token]`** in output unless filled manually in File Builder.

If no pricing snapshot on the deal, `pricing_summary_text`, `pricing_total_display`, and `pricing_deposit_display` are empty / `[token]`.

### Contact (selected venue contact in File Builder)

| Token | Meaning | Source | Example value | Rendered example |
|-------|---------|--------|---------------|------------------|
| `contact_name` | Name | `contacts.name` | Jane Promoter | Jane Promoter |
| `contact_role` | Role | `contacts.role` | Talent buyer | Talent buyer |
| `contact_email` | Email | `contacts.email` | jane@venue.com | jane@venue.com |
| `contact_phone` | Phone | `contacts.phone` | 555-0100 | 555-0100 |
| `contact_company` | Company | `contacts.company` | Blue Room LLC | Blue Room LLC |

**`company_name` interaction:** `company_name` is primarily **artist** company from Settings. If that is empty and the contact has `company`, prefill copies contact company into `company_name` so counterparty lines read correctly.

### Artist / manager (Settings profile)

| Token | Meaning | Source | Example value | Rendered example |
|-------|---------|--------|---------------|------------------|
| `artist_name` | Artist name | `artist_profiles.artist_name` | DJ Example | DJ Example |
| `company_name` | Company | `artist_profiles.company_name` (or contact company fallback) | Example Music LLC | Example Music LLC |
| `tagline` | Tagline | `artist_profiles.tagline` | Live electronic | Live electronic |
| `website` | Website | `artist_profiles.website` | https://artist.example | https://artist.example |
| `phone` | Phone | `artist_profiles.phone` | 555-0199 | 555-0199 |
| `social_handle` | Social | `artist_profiles.social_handle` | @djexample | @djexample |
| `reply_to_email` | Reply-to | `artist_profiles.reply_to_email` | bookings@… | bookings@… |
| `artist_email` | Artist email | `artist_profiles.artist_email` | artist@… | artist@… |
| `manager_name` | Manager name | `artist_profiles.manager_name` | Alex Manager | Alex Manager |
| `manager_email` | Manager email | `artist_profiles.manager_email` | alex@… | alex@… |
| `from_email` | From email | `artist_profiles.from_email` | noreply@… | noreply@… |

---

## Custom tokens

Any `{{my_custom_field}}` **will** round-trip in the template and appear in File Builder for **manual** entry if not in the prefill map. Use **snake_case** and ASCII letters/numbers/underscore for compatibility with the extractor.

---

## Minimum viable template

```json
{
  "v": 1,
  "name": "Minimal agreement",
  "type": "agreement",
  "sections": [
    {
      "label": "Terms",
      "section_kind": "body",
      "content": "<p>Artist {{artist_name}} performs at {{venue_name}}.</p>"
    }
  ]
}
```

`section_kind` may be omitted on the section (defaults to `body`). `id` may be omitted.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Import says invalid `section_kind` | Value not `header` / `body` / `footer`. |
| Body / signatures label error | Empty `label` on a body or signatures section. |
| Headings missing in PDF | Used `<h1>`/`<h2>` without re-import — re-import normalizes; or used unsupported heading levels (`h5+`). |
| `[token]` in output | No value in prefill (no venue/deal/profile data); fill in File Builder or fix selection. |
| Logo not in PDF | `header_logo_url` not https/http/data image, or CORS blocked fetch — use public https URL or upload in editor after import. |

---

## Versioning

- **v1** (this document): initial interchange.
- Future versions may add optional fields; `v` must still be honored.
