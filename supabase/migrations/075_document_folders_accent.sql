-- Preset accent for Documents folder tiles (UI maps to Tailwind).

alter table public.document_folders
  add column if not exists accent text not null default 'default';

alter table public.document_folders drop constraint if exists document_folders_accent_check;

alter table public.document_folders add constraint document_folders_accent_check check (
  accent in (
    'default',
    'slate',
    'amber',
    'emerald',
    'sky',
    'rose',
    'violet',
    'orange'
  )
);
