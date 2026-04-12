# Booking intake live steps — field audit (v3 UX rebuild)

Implementation target: compact desktop UI, Script | Capture tabs, Select for non-binary lists, Yes/No toggles for binary, compact chips for multi-select, accordions for conditional branches, `max-w-xl` shell.

| Section | Field(s) | Widget (new) | Schema / notes |
| ------- | -------- | ------------ | -------------- |
| 1A | `confirmed_contact` | Yes/No toggle | |
| 1A | `contact_mismatch_context`, `contact_mismatch_note` | Branch panel; Select + Textarea; note required if not right person | `contact_mismatch_note` on `venue_data` |
| 1A | `call_vibe` | Select | Expanded `Phase1CallVibeV3` |
| 1B | `contact_phone`, `contact_email`, `contact_company` | Always-visible Inputs | |
| 1B | `phone_confirmed`, `email_confirmed`, `company_confirmed` | Status Select below each field | |
| 1B | `preferred_email_channel` | Select | |
| 2A | same-for-all | Compact two-option control | |
| 2A | `event_type`, `venue_type` | Select (unchanged) | |
| 2A | `setting`, `event_name_flag` | Select | |
| 2A | `event_archetype` | Select | Replaces chip wall |
| 2B–2D | schedules, venue flags, capacity | Select where enum; compact chips only where multi | |
| 3A–3C | performance, genres, lineup | Select / compact `IdChipRow` | |
| 4A–4E | equipment, onsite, load-in, parking, travel | Select for enums; compact chips for capability tags | |
| 5A–5E | pricing, invoice | Select / compact toggles | |
| 6A | promise lines | Compact option rows | |
| 7A–7C | close, follow-ups | Select / compact chips for `close_artifact_tags` | |
| 8A–8C | post-call | Unchanged pattern; 8A still surfaces gaps | |

Soft advance nudge in `handleLiveNext` when 1A mismatch fields empty (non-blocking).

## Implemented (session summary)

- `docs/` audit + [`intakeLivePrimitives.tsx`](src/pages/booking-intake/intakeLivePrimitives.tsx): Script | Capture tabs, Yes/No pair, compact dual, branch panel, compact chips.
- [`intakePayloadV3.ts`](src/lib/intake/intakePayloadV3.ts): `CALL_VIBE_*`, `contact_mismatch_note`, substantive lines.
- [`BookingIntakePage.tsx`](src/pages/BookingIntakePage.tsx): `max-w-xl`, live Script tab (`liveScriptParagraph`), 1A/1B/2A–2C/3c/4B/7C refactors, compact `ToggleN`, post-call card width, 8A note field.
