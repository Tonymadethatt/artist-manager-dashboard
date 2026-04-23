# Lead intake — mass import interchange spec

**Purpose:** Single source of truth for JSON (or line-oriented text) that the Artist Manager app accepts in **Forms → Lead Intake → Import leads**. Use this file with the paired example JSON when asking an AI to generate a bulk import so rows validate and import on the first try.

**Paired file:** `lead-intake-mass-import.example.json` — download from the import dialog (**Spec** / **Example**), or open `/reference/lead-intake-mass-import.example.json` on your deployed site.

**Parser:** `src/lib/leadIntake/parseLeadResearchImport.ts` (`parseLeadResearchImportText`). Field names are stable; behavior below matches production.

---

## Formats the app accepts

| Format | Description |
|--------|-------------|
| **JSON array** | Top-level `[ … ]` — each element is one lead. **Best for mass import.** |
| **JSON object** | Top-level `{ … }` — a single lead. |
| **Line-oriented** | `key: value` lines (YAML-ish). Multiple records separated by a line of `---` or a new block starting with `venue_name:`. Not recommended for very large pastes; prefer JSON array. |

All input must be **UTF-8** text. The import dialog also accepts a **file** (`.json`, `.txt`, `.md`).

---

## Hard requirements (row is skipped if missing)

For each lead row, these three fields must be **non-empty** after trim, or the row is **not imported** (shown as “skipped” in the preview):

| Field | Notes |
|-------|--------|
| `venue_name` | Venue or brand name. |
| `instagram_handle` | Without `@` prefix is fine; a leading `@` is stripped on import. |
| `genre` | Genre or format description. |

Rows may still be **imported without** `contact_email`; those leads are stored but are **not sendable** until an email is added (marked as non-sendable in the parser).

---

## Field reference (per lead object or line block)

| Key | Type | Required for import | Notes |
|-----|------|---------------------|--------|
| `venue_name` | string | **yes** (vitals) | |
| `instagram_handle` | string | **yes** (vitals) | `@` stripped. |
| `genre` | string | **yes** (vitals) | |
| `event_name` | string | no | |
| `crowd_type` | string | no | e.g. age range, vibe. |
| `resident_dj` | string | no | |
| `city` | string | no | |
| `contact_email` | string | no* | *Required only if you want the lead to be mailable. |
| `contact_phone` | string | no | |
| `website` | string | no | Venue or booking URL. |
| `notes` | string | no | **Alias** for research notes. |
| `research_notes` | string | no | Same as `notes` if both present, `notes` is preferred when coerced from objects (see parser: `notes ?? research_notes`). |

**CamelCase / extra keys:** Unknown keys in JSON are **ignored** by the picker (`pickFromRecord` only reads the keys above).

---

## JSON shape

### Array (preferred for many leads)

```json
[
  {
    "venue_name": "Example Room",
    "instagram_handle": "example_room",
    "genre": "House",
    "city": "Austin",
    "contact_email": "bookings@example.com"
  }
]
```

### Single object (one lead)

```json
{
  "venue_name": "Example Room",
  "instagram_handle": "example_room",
  "genre": "House"
}
```

---

## Line-oriented shape (alternative)

```text
venue_name: The Cellar
instagram_handle: cellar_live
genre: Indie / alt
city: Portland
contact_email: ops@cellar.example
notes: Follow up on booking window Q3.
```

Multiple blocks: separate with `---` on its own line, or start a new block with `venue_name:`.

---

## After import

- New leads are added to the **Not contacted** (default) folder the app uses for bulk import (see Lead Intake behavior).
- Skipped rows never partially insert; only rows passing vitals are inserted.

---

## Version

- **Spec version:** 1 (describes interchange only; there is no `v` field in the JSON for leads today).
