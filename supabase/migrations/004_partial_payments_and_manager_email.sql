-- Add manager_email to artist_profile
alter table artist_profile add column if not exists manager_email text;

-- Payment method enum
create type payment_method as enum ('cash', 'paypal', 'zelle', 'apple_pay', 'venmo', 'check', 'other');

-- Monthly fee payments sub-table
create table monthly_fee_payments (
  id uuid primary key default gen_random_uuid(),
  fee_id uuid not null references monthly_fees(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10,2) not null,
  paid_date date not null default current_date,
  payment_method payment_method not null default 'other',
  notes text,
  created_at timestamptz not null default now()
);
create index monthly_fee_payments_fee_id_idx on monthly_fee_payments(fee_id);
create index monthly_fee_payments_user_id_idx on monthly_fee_payments(user_id);
alter table monthly_fee_payments enable row level security;
create policy "monthly_fee_payments: owner access" on monthly_fee_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
