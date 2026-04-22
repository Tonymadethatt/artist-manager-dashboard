# Lead intake — Phase 2 data model audit

**Date:** April 22, 2026  
**Status:** Design decisions + migration `076` ready for apply (not applied in-repo until hosted project is updated).

## Summary

A lead pipeline was missing from a schema built around `venues` + `contacts` (client pipeline), `deals`, `venue_emails`, and `custom_email_templates` (audience `venue` | `artist` only). Phase 2 adds first-class `lead_folders`, `leads`, and `lead_email_events`, extends `custom_email_templates` with `audience = 'lead'`, and uses **`lead.*` merge keys in application code** (e.g. `lead.venue_name`) so lead templates do not share namespace with client/artist merge fields.

## Decisions (pre-migration)

| Topic | Decision |
|--------|----------|
| Custom templates | **Option A:** extend `custom_email_templates`; add `'lead'` to audience check |
| Variable naming | Dot notation under **`lead`**: `lead.venue_name`, `lead.instagram_handle`, etc. |
| Task extension | **Later migration:** `tasks.lead_id` and `tasks.lead_folder_id` nullable, with **CHECK** — not in `076` |
| Email log | **Separate** from `venue_emails`; new table `lead_email_events` |
| Lead vs venue | **Independent**; do not use `OutreachStatus` for lead stages; `promoted_at` / venue link can follow in a later change |

## Existing tables (audit snapshot)

- **`venues` / `contacts`:** CRM pipeline; contacts require `venue_id`. No Instagram or lead research fields as first-class columns.
- **`tasks`:** `venue_id`, `deal_id`, `cold_call_id`, `email_type`, … — no lead columns yet.
- **`venue_emails`:** Client/artist queue; not used for pre-client leads.
- **`custom_email_templates`:** `audience` in `('venue','artist')` before `076`.
- **Documents `document_folders`:** Unrelated; lead folders are a separate product concept.

## Import contract (from repo prompts)

AI/research output uses snake_case field names (`venue_name`, `instagram_handle`, …, `notes`). Those map to `leads` columns; `notes` → `research_notes` in the app on import.

## Migration `076` (file)

See `supabase/migrations/076_lead_intake_folders_leads_and_email_log.sql`.

**Implements:** `lead_folders`, `leads` (+ composite FKs so rows cannot point at another user’s folder/lead), `lead_email_events` (optional `task_id` → `tasks` for future automation), RLS on all three, `updated_at` triggers on folders and leads, audience check widened to include `'lead'`.

**Does not include:** `tasks` columns, TypeScript `database` types (regenerate after apply).

## Follow-up work (after apply)

- Regenerate or extend `src/types/database.ts` (and app types as needed).
- Next migration: `tasks.lead_id`, `tasks.lead_folder_id`, and CHECK; wire send pipeline to `lead_email_events`.
