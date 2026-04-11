-- Dashboard-only Google sync: events are stored in calendar_sync_event without requiring a copy to another Google calendar.

alter table calendar_sync_event
  alter column destination_calendar_id drop not null;

alter table calendar_sync_event
  alter column destination_event_id drop not null;
