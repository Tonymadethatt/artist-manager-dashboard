-- Track payments toward the balance / remainder separately from deposit (see deals.deposit_paid_amount).

alter table public.deals
  add column if not exists balance_paid_amount numeric(10, 2) not null default 0;

comment on column public.deals.balance_paid_amount is
  'Amount paid toward the contract remainder after deposit; total client-paid = deposit_paid_amount + balance_paid_amount.';
