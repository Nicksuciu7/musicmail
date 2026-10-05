-- Workspace ownership. user_id remains a nullable creator/actor audit field for
-- compatibility; it no longer grants CRM access. Membership is server-managed.
create table public.workspaces (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 200),
 created_by uuid references auth.users on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.workspace_members (
 workspace_id uuid not null references public.workspaces on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 role text not null check(role in ('owner','member')),
 created_at timestamptz not null default now(),
 primary key(workspace_id,user_id)
);
create index workspace_members_user on public.workspace_members(user_id,workspace_id);
create function public.is_workspace_member(wid uuid) returns boolean
 language sql stable security definer set search_path=public as $$
 select exists(select 1 from workspace_members where workspace_id=wid and user_id=auth.uid())
$$;
revoke all on function public.is_workspace_member(uuid) from public,anon;
grant execute on function public.is_workspace_member(uuid) to authenticated,service_role;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
create policy member_read on public.workspaces for select to authenticated using(is_workspace_member(id));
create policy own_membership on public.workspace_members for select to authenticated using(user_id=auth.uid());
revoke all on public.workspaces,public.workspace_members from anon,authenticated;
grant select on public.workspaces,public.workspace_members to authenticated;
grant all on public.workspaces,public.workspace_members to service_role;
create trigger touch_updated_at before update on public.workspaces for each row execute function public.touch_updated_at();

-- Deterministic personal workspace IDs make backfill and retry provisioning safe.
insert into public.workspaces(id,name,created_by)
 select id,'My MusicMail',id from auth.users;
insert into public.workspace_members(workspace_id,user_id,role)
 select id,id,'owner' from auth.users;

-- Replace owner-composite foreign keys before making audit identities nullable.
do $$ declare t text; c record; begin
 foreach t in array array['notes','interactions','list_members','sent_emails','email_send_attempts'] loop
  for c in select conname from pg_constraint where conrelid=('public.'||t)::regclass
    and contype='f' and confrelid in ('public.user_contacts'::regclass,'public.lists'::regclass) loop
   execute format('alter table public.%I drop constraint %I',t,c.conname);
  end loop;
 end loop;
 foreach t in array array['user_contacts','notes','interactions','saved_views','lists','list_members','email_templates','sent_emails','email_send_attempts'] loop
  execute format('alter table public.%I add column workspace_id uuid references public.workspaces on delete cascade',t);
  execute format('update public.%I set workspace_id=user_id',t);
  execute format('alter table public.%I alter column workspace_id set not null',t);
  execute format('alter table public.%I alter column workspace_id set default auth.uid()',t);
  for c in select conname from pg_constraint where conrelid=('public.'||t)::regclass
    and contype='f' and confrelid='auth.users'::regclass loop
   execute format('alter table public.%I drop constraint %I',t,c.conname);
  end loop;
  execute format('alter table public.%I alter column user_id drop not null',t);
  execute format('alter table public.%I add foreign key(user_id) references auth.users on delete set null',t);
  execute format('create index %I on public.%I(workspace_id)',t||'_workspace',t);
 end loop;
end $$;
alter table public.user_contacts drop constraint user_contacts_user_id_entity_id_key;
alter table public.user_contacts add unique(workspace_id,entity_id), add unique(workspace_id,id);
alter table public.lists add unique(workspace_id,id);
do $$ declare t text; begin
 foreach t in array array['notes','interactions','list_members','sent_emails','email_send_attempts'] loop
  execute format('alter table public.%I add foreign key(workspace_id,user_contact_id) references public.user_contacts(workspace_id,id) on delete cascade',t);
 end loop;
end $$;
alter table public.list_members add foreign key(workspace_id,list_id) references public.lists(workspace_id,id) on delete cascade;

create function public.guard_workspace_row() returns trigger language plpgsql set search_path=public as $$ begin
 if TG_OP='INSERT' then
  -- Server operations supply the actor explicitly; their default workspace is
  -- resolved independently of the HTTP caller's JWT.
  if new.workspace_id is null then new.workspace_id:=new.user_id; end if;
  if current_user='authenticated' and new.user_id is distinct from auth.uid() then
   raise insufficient_privilege using message='Invalid actor';
  end if;
 elsif current_user='authenticated' and
   (new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id) then
  raise insufficient_privilege using message='Ownership and actor are immutable';
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['user_contacts','notes','interactions','saved_views','lists','list_members','email_templates','sent_emails','email_send_attempts'] loop
  execute format('create trigger guard_workspace before insert or update on public.%I for each row execute function public.guard_workspace_row()',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  if t not in ('sent_emails','email_send_attempts') then
   execute format('drop policy owner_access on public.%I',t);
   execute format('create policy workspace_access on public.%I for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id))',t);
   execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  elsif t='sent_emails' then
   execute 'drop policy owner_read on public.sent_emails';
   execute 'create policy workspace_read on public.sent_emails for select to authenticated using(public.is_workspace_member(workspace_id))';
   execute 'grant select on public.sent_emails to authenticated';
  end if;
 end loop;
end $$;

create function public.provision_personal_workspace() returns trigger
 language plpgsql security definer set search_path=public as $$ begin
 insert into workspaces(id,name,created_by) values(new.id,'My MusicMail',new.id) on conflict(id) do nothing;
 insert into workspace_members(workspace_id,user_id,role) values(new.id,new.id,'owner') on conflict do nothing;
 insert into profiles(id) values(new.id) on conflict do nothing;
 return new;
end $$;
create trigger musicmail_new_user after insert on auth.users for each row execute function public.provision_personal_workspace();
insert into public.profiles(id) select id from auth.users on conflict do nothing;

-- Delete sole-member workspaces, retain shared workspaces when another owner
-- exists, and block deletion of the last owner of a workspace with other members.
create function public.cleanup_deleted_user() returns trigger
 language plpgsql security definer set search_path=public as $$ declare w record; begin
 for w in select workspace_id,role from workspace_members where user_id=old.id order by workspace_id loop
  perform 1 from workspaces where id=w.workspace_id for update;
  if not exists(select 1 from workspace_members where workspace_id=w.workspace_id and user_id<>old.id) then
   delete from workspaces where id=w.workspace_id;
  elsif w.role='owner' and not exists(select 1 from workspace_members where workspace_id=w.workspace_id and user_id<>old.id and role='owner') then
   raise exception 'Transfer workspace ownership before deleting this account';
  end if;
 end loop;
 delete from entities where created_by=old.id and visibility='private';
 return old;
end $$;
create trigger musicmail_delete_user before delete on auth.users for each row execute function public.cleanup_deleted_user();
alter table public.entities drop constraint entities_created_by_fkey;
alter table public.entities add foreign key(created_by) references auth.users on delete set null;

create or replace function public.contact_history() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if TG_OP='INSERT' then insert into interactions(user_id,workspace_id,user_contact_id,type,title) values(new.user_id,new.workspace_id,new.id,'contact_added','Added to your network');
 else
 if new.relationship_status is distinct from old.relationship_status then insert into interactions(user_id,workspace_id,user_contact_id,type,title) values(coalesce(auth.uid(),new.user_id),new.workspace_id,new.id,'relationship_changed','Relationship: '||replace(new.relationship_status,'_',' ')); end if;
 if new.outreach_status is distinct from old.outreach_status then insert into interactions(user_id,workspace_id,user_contact_id,type,title) values(coalesce(auth.uid(),new.user_id),new.workspace_id,new.id,'outreach_status_changed','Outreach: '||replace(new.outreach_status,'_',' ')); end if;
 if new.follow_up_at is distinct from old.follow_up_at then insert into interactions(user_id,workspace_id,user_contact_id,type,title) values(coalesce(auth.uid(),new.user_id),new.workspace_id,new.id,'follow_up_changed','Follow-up updated'); end if;
 end if; return new; end $$;
create or replace function public.note_history() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into interactions(user_id,workspace_id,user_contact_id,type,title) values(new.user_id,new.workspace_id,new.user_contact_id,'note_added','Private note added'); return new; end $$;

-- Supabase hosted defaults must not grant anonymous access or token access.
revoke all on all tables in schema public from anon;
revoke all on public.gmail_connections,public.email_send_attempts,public.admin_users from authenticated;
alter function public.touch_updated_at() set search_path=public;
alter function public.keep_entity_type() set search_path=public;
revoke create on schema public from public,anon,authenticated;
-- Trigger helpers are not callable RPCs; policy helpers are authenticated only.
revoke all on function public.guard_workspace_row(),public.provision_personal_workspace(),public.cleanup_deleted_user(),public.contact_history(),public.note_history(),public.seed_user_templates(),public.touch_updated_at(),public.keep_entity_type(),public.preserve_contact_name(),public.check_entity_subtype() from public,anon,authenticated;
revoke all on function public.is_admin(),public.can_read_entity(uuid) from public,anon;
grant execute on function public.is_admin(),public.can_read_entity(uuid) to authenticated,service_role;

create or replace function public.merge_entities(source_id uuid,target_id uuid,confirmed boolean) returns void language plpgsql security definer set search_path=public as $$
declare c record; existing uuid; begin
 if not is_admin() or not confirmed then raise exception 'Admin confirmation required'; end if;
 if source_id=target_id or not exists(select 1 from entities a join entities b on a.entity_type=b.entity_type and a.created_by is not distinct from b.created_by where a.id=source_id and b.id=target_id and a.visibility='public' and b.visibility='public' and a.archived_at is null and b.archived_at is null) then raise exception 'Choose two active public entities of the same type and ownership'; end if;
 perform 1 from entities where id in(source_id,target_id) order by id for update;
 for c in select * from user_contacts where entity_id=source_id loop
 select id into existing from user_contacts where entity_id=target_id and workspace_id=c.workspace_id;
 if existing is not null then
 update notes set user_contact_id=existing where user_contact_id=c.id and workspace_id=c.workspace_id;
 update interactions set user_contact_id=existing where user_contact_id=c.id and workspace_id=c.workspace_id;
 update sent_emails set user_contact_id=existing where user_contact_id=c.id and workspace_id=c.workspace_id;
 update email_send_attempts set user_contact_id=existing where user_contact_id=c.id and workspace_id=c.workspace_id;
 insert into list_members(user_id,workspace_id,list_id,user_contact_id) select user_id,workspace_id,list_id,existing from list_members where user_contact_id=c.id on conflict do nothing;
 update user_contacts set entity_id=null,private_display_name=coalesce(private_display_name,(select display_name from entities where id=source_id)),archived=true where id=c.id;
 else update user_contacts set entity_id=target_id where id=c.id; end if;
 end loop;
 insert into entity_aliases(entity_id,alias,normalised_alias) select target_id,display_name,lower(display_name) from entities where id=source_id on conflict do nothing;
 insert into entity_aliases(entity_id,alias,normalised_alias) select target_id,alias,normalised_alias from entity_aliases where entity_id=source_id on conflict do nothing;
 insert into entity_genres select target_id,genre_id from entity_genres where entity_id=source_id on conflict do nothing;
 insert into entity_emotions select target_id,emotion_id from entity_emotions where entity_id=source_id on conflict do nothing;
 insert into entity_locations select target_id,location_id,relationship_type from entity_locations where entity_id=source_id on conflict do nothing;
 insert into entity_roles(entity_id,role_id,organisation_id,started_at,ended_at,is_current) select target_id,r.role_id,r.organisation_id,r.started_at,r.ended_at,r.is_current from entity_roles r where r.entity_id=source_id and not exists(select 1 from entity_roles t where t.entity_id=target_id and t.role_id=r.role_id and t.organisation_id is not distinct from r.organisation_id);
 insert into entity_contact_methods(entity_id,contact_type,label,value,purpose,is_primary,is_public,is_verified,last_verified_at)
 select target_id,s.contact_type,s.label,s.value,s.purpose,false,s.is_public,s.is_verified,s.last_verified_at from entity_contact_methods s where s.entity_id=source_id and not exists(select 1 from entity_contact_methods t where t.entity_id=target_id and t.contact_type=s.contact_type and t.value=s.value and t.purpose is not distinct from s.purpose);
 insert into submission_channels(entity_id,submission_type,status,email_contact_method_id,submission_url,opens_at,closes_at,instructions,fee_amount,fee_currency,last_verified_at)
 select target_id,s.submission_type,s.status,(select t.id from entity_contact_methods t join entity_contact_methods old on old.id=s.email_contact_method_id where t.entity_id=target_id and t.contact_type=old.contact_type and t.value=old.value limit 1),s.submission_url,s.opens_at,s.closes_at,s.instructions,s.fee_amount,s.fee_currency,s.last_verified_at from submission_channels s where s.entity_id=source_id;
 insert into entity_sources(entity_id,source_type,source_name,source_url,retrieved_at,verified_at) select target_id,source_type,source_name,source_url,retrieved_at,verified_at from entity_sources where entity_id=source_id;
 insert into entity_relationships(source_entity_id,target_entity_id,relationship_type_id,started_at,ended_at,is_current)
 select case when source_entity_id=source_id then target_id else source_entity_id end,case when target_entity_id=source_id then target_id else target_entity_id end,relationship_type_id,started_at,ended_at,is_current from entity_relationships where (source_entity_id=source_id or target_entity_id=source_id) and (case when source_entity_id=source_id then target_id else source_entity_id end)<>(case when target_entity_id=source_id then target_id else target_entity_id end) on conflict do nothing;
 -- Preserve historical source edges on the archived identity; add canonical replacements above.
 update user_preferences set primary_artist_entity_id=target_id where primary_artist_entity_id=source_id;
 update entities set archived_at=now(),merged_into_id=target_id where id=source_id;
 end $$;

create or replace function public.reserve_email(attempt_id uuid, owner_id uuid, contact_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 if not exists(select 1 from user_contacts where id=contact_id and exists(select 1 from workspace_members m where m.workspace_id=user_contacts.workspace_id and m.user_id=owner_id) and not archived and outreach_status<>'do_not_contact') then raise exception 'Contact unavailable or suppressed'; end if;
 if (select count(*) from email_send_attempts where user_id=owner_id and created_at>now()-interval '1 hour')>=30 then raise exception 'Hourly sending limit reached'; end if;
 insert into email_send_attempts(id,user_id,workspace_id,user_contact_id) select attempt_id,owner_id,workspace_id,contact_id from user_contacts where id=contact_id;
 end $$;
create or replace function public.record_sent(attempt_id uuid,owner_id uuid,contact_id uuid,message_id text,to_email text,message_subject text,message_body text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not exists(select 1 from email_send_attempts where id=attempt_id and user_id=owner_id and user_contact_id=contact_id and status='reserved' for update) then raise exception 'Invalid send attempt'; end if;
 insert into sent_emails(user_id,workspace_id,user_contact_id,gmail_message_id,recipient,subject,body) select owner_id,workspace_id,contact_id,message_id,to_email,message_subject,message_body from email_send_attempts where id=attempt_id;
 insert into interactions(user_id,workspace_id,user_contact_id,type,title) select owner_id,workspace_id,contact_id,'email_sent',message_subject from email_send_attempts where id=attempt_id;
 update user_contacts set first_contacted_at=coalesce(first_contacted_at,now()),last_contacted_at=now(),outreach_status=case when outreach_status in ('not_contacted','draft') then 'sent' else outreach_status end where id=contact_id;
 update email_send_attempts set status='sent' where id=attempt_id;
 end $$;
revoke all on function reserve_email(uuid,uuid,uuid),record_sent(uuid,uuid,uuid,text,text,text,text) from public;
grant execute on function reserve_email(uuid,uuid,uuid),record_sent(uuid,uuid,uuid,text,text,text,text) to service_role;

create or replace function public.import_contacts(rows jsonb,confirm_duplicates boolean default false) returns integer language plpgsql security invoker set search_path=public as $$
declare r jsonb; cid uuid; n integer:=0; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>500 then raise exception 'Invalid import'; end if;
 for r in select * from jsonb_array_elements(rows) loop
 if length(trim(coalesce(r->>'name',''))) not between 1 and 200 then raise exception 'Name required'; end if;
 if not confirm_duplicates and exists(select 1 from user_contacts where workspace_id=auth.uid() and ((coalesce(r->>'email','')<>'' and lower(private_email)=lower(r->>'email')) or (lower(private_display_name)=lower(r->>'name') and lower(coalesce(private_details->>'organisation',''))=lower(coalesce(r->>'organisation',''))))) then raise exception 'Possible duplicate'; end if;
 insert into user_contacts(user_id,private_display_name,private_email,private_details,relationship_status) values(auth.uid(),r->>'name',r->>'email',jsonb_build_object('organisation',r->>'organisation','role',r->>'role','location',r->>'location','genres',r->>'genres'),coalesce(r->>'relationship','unknown')) returning id into cid;
 if coalesce(r->>'notes','')<>'' then insert into notes(user_id,user_contact_id,body) values(auth.uid(),cid,r->>'notes'); end if;
 n:=n+1; end loop; return n; end $$;
revoke all on function import_contacts(jsonb,boolean) from public;
grant execute on function import_contacts(jsonb,boolean) to authenticated;

create or replace function public.complete_onboarding(project_name text, project_type text, city_name text, genre_names text[], emotion_names text[], user_goals jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare eid uuid; lid uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(trim(project_name)) not between 1 and 200 or project_type not in ('solo','band','duo','collective','producer_project','dj_project','other') then raise exception 'Invalid artist'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select primary_artist_entity_id into eid from user_preferences where user_id=auth.uid();
 select id into lid from locations where city=city_name limit 1;
 if eid is null then
 insert into entities(entity_type,display_name,visibility,created_by,primary_location_id) values('artist_project',trim(project_name),'private',auth.uid(),lid) returning id into eid;
 insert into artist_projects(entity_id,artist_type) values(eid,project_type);
 else
 if not exists(select 1 from entities where id=eid and created_by=auth.uid()) then raise exception 'Invalid owner'; end if;
 update entities set display_name=trim(project_name),primary_location_id=lid,updated_at=now() where id=eid;
 update artist_projects set artist_type=project_type where entity_id=eid;
 delete from entity_genres where entity_id=eid; delete from entity_emotions where entity_id=eid;
 end if;
 insert into entity_genres select eid,id from genres where name=any(genre_names);
 insert into entity_emotions select eid,id from emotions where name=any(emotion_names);
 insert into profiles(id,display_name) values(auth.uid(),project_name) on conflict(id) do nothing;
 insert into user_preferences(user_id,primary_artist_entity_id,goals,onboarding_completed) values(auth.uid(),eid,user_goals,true) on conflict(user_id) do update set primary_artist_entity_id=excluded.primary_artist_entity_id,goals=excluded.goals,onboarding_completed=true;
 return eid; end $$;
revoke all on function complete_onboarding(text,text,text,text[],text[],jsonb) from public;
grant execute on function complete_onboarding(text,text,text,text[],text[],jsonb) to authenticated;

-- Explicitly override hosted default EXECUTE grants on application functions.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.is_admin(),public.can_read_entity(uuid),public.is_workspace_member(uuid),public.entity_document(public.entities),public.get_entity(uuid),public.discover_entities(jsonb),public.network_contacts(jsonb),public.workspace_document(),public.workspace_summary(uuid[]),public.import_contacts(jsonb,boolean),public.complete_onboarding(text,text,text,text[],text[],jsonb),public.admin_save_entity(jsonb),public.merge_entities(uuid,uuid,boolean) to authenticated,service_role;
grant execute on function public.reserve_email(uuid,uuid,uuid),public.record_sent(uuid,uuid,uuid,text,text,text,text) to service_role;
