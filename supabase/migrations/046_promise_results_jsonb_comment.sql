-- Document dual-sided recap storage on performance_reports.promise_results (legacy + v2).

comment on column performance_reports.promise_results is
  'Artist recap answers: legacy flat [ { "id", "met" } ] for venue-only deals; v2 { "v": 2, "venue": [...], "artist": [...] } when the deal has artist recap lines.';
