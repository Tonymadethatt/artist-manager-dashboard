-- booking_requests: submitted interest/inquiry from venue capture forms.
-- Populated via applyEmailCaptureSideEffects for relevant capture kinds.
-- Owner-only access; manual delete supported.

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  capture_token_id uuid references public.email_capture_tokens(id) on delete set null,
  -- Kind mirrors the EmailCaptureKind that created this request
  source_kind text not null,
  -- Core booking interest fields (all optional at DB level; validated at app layer)
  rebook_interest text,           -- 'yes' | 'maybe' | 'no'
  preferred_dates text,
  budget_note text,
  note text,
  -- Raw response payload for reference
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_requests_user_id_idx on public.booking_requests (user_id);
create index if not exists booking_requests_venue_id_idx on public.booking_requests (venue_id);
create index if not exists booking_requests_deal_id_idx on public.booking_requests (deal_id);
create index if not exists booking_requests_created_at_idx on public.booking_requests (created_at desc);

alter table public.booking_requests enable row level security;

create policy "booking_requests: owner select"
  on public.booking_requests for select
  using (auth.uid() = user_id);

create policy "booking_requests: owner insert"
  on public.booking_requests for insert
  with check (auth.uid() = user_id);

create policy "booking_requests: owner update"
  on public.booking_requests for update
  using (auth.uid() = user_id);

create policy "booking_requests: owner delete"
  on public.booking_requests for delete
  using (auth.uid() = user_id);
