-- Remove duplicate lead_folders per (user_id, name), re-point FKs, prevent re-seeding races.

create temp table _lead_folder_dup_map (old_id uuid primary key, new_id uuid not null);

insert into _lead_folder_dup_map (old_id, new_id)
with keeper as (
  select distinct on (user_id, name)
    id as keep_id,
    user_id,
    name
  from public.lead_folders
  order by user_id, name, sort_order asc, id asc
)
select lf.id, k.keep_id
from public.lead_folders lf
join keeper k on k.user_id = lf.user_id and k.name = lf.name
where lf.id <> k.keep_id;

update public.leads l
set folder_id = m.new_id
from _lead_folder_dup_map m
where l.folder_id = m.old_id;

update public.tasks t
set lead_folder_id = m.new_id
from _lead_folder_dup_map m
where t.lead_folder_id = m.old_id;

update public.custom_email_templates c
set move_to_folder_id = m.new_id
from _lead_folder_dup_map m
where c.move_to_folder_id = m.old_id;

update public.lead_email_events e
set folder_id_before = m.new_id
from _lead_folder_dup_map m
where e.folder_id_before = m.old_id;

update public.lead_email_events e
set moved_to_folder_id = m.new_id
from _lead_folder_dup_map m
where e.moved_to_folder_id = m.old_id;

update public.lead_folder_movements x
set from_folder_id = m.new_id
from _lead_folder_dup_map m
where x.from_folder_id = m.old_id;

update public.lead_folder_movements x
set to_folder_id = m.new_id
from _lead_folder_dup_map m
where x.to_folder_id = m.old_id;

delete from public.lead_folders lf
using _lead_folder_dup_map m
where lf.id = m.old_id;

create unique index if not exists lead_folders_user_id_name_unique
  on public.lead_folders (user_id, name);

comment on index public.lead_folders_user_id_name_unique is
  'One folder name per user; prevents duplicate default seeds and keeps selects stable.';
