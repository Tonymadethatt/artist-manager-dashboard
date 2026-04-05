-- Add typed category to outreach_notes for activity logging
-- category values: 'call' | 'email_sent' | 'email_received' | 'contract_sent'
--                  | 'meeting' | 'voicemail' | 'no_response' | 'other'
-- Notes without a category are regular free-text notes.
alter table outreach_notes add column if not exists category text;
