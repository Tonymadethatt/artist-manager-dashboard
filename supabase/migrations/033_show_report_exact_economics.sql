-- Exact gig economics on performance reports (fee vs received vs optional dispute claim)

alter table performance_reports
  add column if not exists fee_total numeric(10, 2),
  add column if not exists amount_received numeric(10, 2),
  add column if not exists payment_dispute_claimed_amount numeric(10, 2);

comment on column performance_reports.fee_total is 'Total gig fee (contract) as reported by artist; compare to deals.gross_amount for commission reconciliation';
comment on column performance_reports.amount_received is 'Amount actually received from venue for this gig';
comment on column performance_reports.payment_dispute_claimed_amount is 'Optional: total fee artist believes they are owed when payment_dispute = yes';
