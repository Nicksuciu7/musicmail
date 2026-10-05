-- Private workspace calendar. Date-only ranges use an exclusive end date;
-- timed events use UTC instants plus the original IANA zone.
create table public.calendar_events (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default auth.uid() references public.workspaces on delete cascade,
 user_id uuid default auth.uid() references auth.users on delete set null,
 title text not null check(length(trim(title)) between 1 and 200),
 event_type text not null default 'Gig' check(event_type in ('Gig','Rehearsal','Recording','Meeting','Travel','Other')),
 start_date date not null check(start_date between '1900-01-01' and '2200-12-31'), end_date date not null,
 starts_at timestamptz, ends_at timestamptz, all_day boolean not null default true,
 timezone text not null default 'Europe/London' check(length(timezone) between 1 and 100),
 location_name text not null default '' check(length(location_name)<=200), address text not null default '' check(length(address)<=500),
 venue_entity_id uuid references public.entities on delete set null,
 contact_id uuid references public.user_contacts on delete set null,
 artist_entity_id uuid references public.entities on delete set null,
 promoter text not null default '' check(length(promoter)<=200),
 load_in_at timestamptz, soundcheck_at timestamptz, doors_at timestamptz, stage_at timestamptz,
 fee text not null default '' check(length(fee)<=100), ticket_url text not null default '' check(length(ticket_url)<=2000 and (ticket_url='' or ticket_url ~* '^https?://[^[:space:]]+$')),
 notes text not null default '' check(length(notes)<=10000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key(workspace_id,contact_id) references public.user_contacts(workspace_id,id) deferrable initially deferred,
 check(end_date>=start_date and end_date<='2201-01-01'),
 check((all_day and starts_at is null and ends_at is null and end_date>start_date) or
       (not all_day and starts_at is not null and ends_at is not null and ends_at>starts_at and ends_at-starts_at<=interval '366 days'))
);
create table public.calendar_event_items (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null default auth.uid() references public.workspaces on delete cascade,
 user_id uuid default auth.uid() references auth.users on delete set null,
 event_id uuid not null, label text not null check(length(trim(label)) between 1 and 200),
 quantity integer check(quantity between 1 and 999), completed boolean not null default false,
 sort_order integer not null default 0 check(sort_order between 0 and 9999),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,event_id) references public.calendar_events(workspace_id,id) on delete cascade
);
create index calendar_events_workspace_date on public.calendar_events(workspace_id,start_date,id);
create index calendar_events_workspace_start on public.calendar_events(workspace_id,starts_at,id) where not all_day;
create index calendar_events_contact on public.calendar_events(contact_id) where contact_id is not null;
create index calendar_events_venue on public.calendar_events(venue_entity_id) where venue_entity_id is not null;
create index calendar_events_artist on public.calendar_events(artist_entity_id) where artist_entity_id is not null;
create index calendar_items_parent on public.calendar_event_items(workspace_id,event_id,sort_order,id);
create function public.guard_calendar_event() returns trigger language plpgsql set search_path=public as $$ begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise check_violation using message='Invalid timezone'; end if;
 if not new.all_day and (new.start_date<>(new.starts_at at time zone new.timezone)::date or new.end_date<>(new.ends_at at time zone new.timezone)::date) then raise check_violation using message='Date and timestamp mismatch'; end if;
 -- Validate links through the caller's RLS. Revalidation is limited to changed
 -- links so edits still work if a formerly permitted venue is later archived.
 if new.venue_entity_id is not null and (TG_OP='INSERT' or new.venue_entity_id is distinct from old.venue_entity_id) and
 not exists(select 1 from entities where id=new.venue_entity_id and entity_type='venue' and visibility='public' and archived_at is null) then raise insufficient_privilege using message='Venue unavailable';end if;
 if new.artist_entity_id is not null and (TG_OP='INSERT' or new.artist_entity_id is distinct from old.artist_entity_id) and
 not exists(select 1 from user_preferences p where p.user_id=auth.uid() and p.primary_artist_entity_id=new.artist_entity_id) then raise insufficient_privilege using message='Project unavailable';end if;
 if TG_OP='UPDATE' and current_user='authenticated' and new.id<>old.id then raise insufficient_privilege using message='Event identity is immutable';end if;
 return new;
end $$;
revoke all on function public.guard_calendar_event() from public,anon,authenticated;
create trigger validate_calendar_event before insert or update on public.calendar_events for each row execute function public.guard_calendar_event();
do $$ declare t text; begin
 foreach t in array array['calendar_events','calendar_event_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy workspace_access on public.%I for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id))',t);
  execute format('create trigger guard_workspace before insert or update on public.%I for each row execute function public.guard_workspace_row()',t);
  execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;
end $$;
-- Atomic replacement: lock an owned event, change its fields and checklist in one
-- transaction. Invoker security keeps both table RLS and link validation active.
create function public.save_calendar_event(event_id uuid, payload jsonb, checklist jsonb) returns uuid
 language plpgsql security invoker set search_path=public as $$
declare eid uuid; e calendar_events; i jsonb; n integer:=0; begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 if jsonb_typeof(payload)<>'object' or jsonb_typeof(checklist)<>'array' or jsonb_array_length(checklist)>100 then raise check_violation using message='Invalid event';end if;
 e:=jsonb_populate_record(null::calendar_events,payload);
 if event_id is null then
  insert into calendar_events(title,event_type,start_date,end_date,starts_at,ends_at,all_day,timezone,location_name,address,venue_entity_id,contact_id,artist_entity_id,promoter,load_in_at,soundcheck_at,doors_at,stage_at,fee,ticket_url,notes)
  values(e.title,e.event_type,e.start_date,e.end_date,e.starts_at,e.ends_at,e.all_day,e.timezone,e.location_name,e.address,e.venue_entity_id,e.contact_id,e.artist_entity_id,e.promoter,e.load_in_at,e.soundcheck_at,e.doors_at,e.stage_at,e.fee,e.ticket_url,e.notes) returning id into eid;
 else
  select id into eid from calendar_events where id=event_id and workspace_id=auth.uid() for update;
  if eid is null then raise insufficient_privilege using message='Event unavailable';end if;
  update calendar_events set title=e.title,event_type=e.event_type,start_date=e.start_date,end_date=e.end_date,starts_at=e.starts_at,ends_at=e.ends_at,all_day=e.all_day,timezone=e.timezone,location_name=e.location_name,address=e.address,venue_entity_id=e.venue_entity_id,contact_id=e.contact_id,artist_entity_id=e.artist_entity_id,promoter=e.promoter,load_in_at=e.load_in_at,soundcheck_at=e.soundcheck_at,doors_at=e.doors_at,stage_at=e.stage_at,fee=e.fee,ticket_url=e.ticket_url,notes=e.notes where id=eid;
 end if;
 -- Reject IDs from other events, including an attempted cross-workspace move.
 for i in select * from jsonb_array_elements(checklist) loop
  if i ? 'id' and not exists(select 1 from calendar_event_items where id=(i->>'id')::uuid and calendar_event_items.event_id=eid and workspace_id=auth.uid()) then raise insufficient_privilege using message='Checklist item unavailable';end if;
 end loop;
 delete from calendar_event_items where calendar_event_items.event_id=eid and not exists(select 1 from jsonb_array_elements(checklist) j where j->>'id'=calendar_event_items.id::text);
 for i in select * from jsonb_array_elements(checklist) loop
  if i ? 'id' then
   update calendar_event_items set label=i->>'label',quantity=(i->>'quantity')::integer,completed=coalesce((i->>'completed')::boolean,false),sort_order=n where id=(i->>'id')::uuid and calendar_event_items.event_id=eid;
  else
   insert into calendar_event_items(event_id,label,quantity,completed,sort_order) values(eid,i->>'label',(i->>'quantity')::integer,coalesce((i->>'completed')::boolean,false),n);
  end if;n:=n+1;
 end loop;
 return eid;
end $$;
revoke all on function public.save_calendar_event(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_calendar_event(uuid,jsonb,jsonb) to authenticated,service_role;
