-- Google Calendar sync: persist event description/notes for dashboard display and mirror refresh on sync.

alter table calendar_sync_event
  add column description text;
