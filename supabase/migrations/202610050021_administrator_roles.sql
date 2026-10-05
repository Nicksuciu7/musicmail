-- Upgrade the existing trusted admin membership store; preserve every admin.
alter table public.admin_users rename to user_roles;
alter table public.user_roles add column role text not null default 'member' check(role in ('member','admin'));
alter table public.user_roles add column require_aal2 boolean not null default false;
update public.user_roles set role='admin';
insert into public.user_roles(user_id) select id from auth.users on conflict do nothing;
revoke all on public.user_roles from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.user_roles to service_role;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin'
 and (not require_aal2 or coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'aal'='aal2'));
$$;
create policy role_read on public.user_roles for select to authenticated using(user_id=auth.uid() or public.is_admin());
grant select on public.user_roles to authenticated;

create function public.provision_member_role() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin insert into public.user_roles(user_id,role) values(new.id,'member');return new;end $$;
revoke all on function public.provision_member_role() from public,anon,authenticated,service_role;
create trigger musicmail_member_role after insert on auth.users for each row execute function public.provision_member_role();

create table public.admin_audit_log (
 id uuid primary key default gen_random_uuid(),
 -- Retain the actor UUID and target after account deletion, without credentials.
 admin_user_id uuid,
 action text not null,
 target_type text not null,
 target_id text,
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object'),
 created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
create policy admin_read on public.admin_audit_log for select to authenticated using(public.is_admin());
revoke all on public.admin_audit_log from public,anon,authenticated,service_role;
grant select on public.admin_audit_log to authenticated,service_role;
create index admin_audit_created on public.admin_audit_log(created_at desc,id);

-- Database triggers log mutations atomically, including direct canonical RPCs.
-- Store field names, never row contents, text, metadata blobs or provider tokens.
create function public.audit_admin_change() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare before_row jsonb; after_row jsonb; changed jsonb; target text;begin
 before_row:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 after_row:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 if tg_op='UPDATE' and before_row=after_row then return new;end if;
 if tg_table_name<>'user_roles' and not public.is_admin() then return coalesce(new,old);end if;
 -- Provisioning a default member is not a privileged action.
 if tg_table_name='user_roles' and tg_op='INSERT' and after_row->>'role'='member' then return new;end if;
 select coalesce(jsonb_agg(k order by k),'[]') into changed from
 (select jsonb_object_keys(before_row||after_row) k) fields where before_row->k is distinct from after_row->k;
 target:=coalesce(after_row->>'id',before_row->>'id',after_row->>'user_id',before_row->>'user_id',after_row->>'entity_id',before_row->>'entity_id');
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata)
 values(auth.uid(),lower(tg_op),tg_table_name,target,jsonb_build_object('fields',changed)
 ||case when tg_table_name='user_roles' then jsonb_build_object('previous_role',before_row->>'role','role',after_row->>'role') else '{}'::jsonb end);
 return coalesce(new,old);
end $$;
revoke all on function public.audit_admin_change() from public,anon,authenticated,service_role;
do $$ declare t text;begin
 foreach t in array array['user_roles','entities','locations','people','organisations','artist_projects','venues','entity_roles','entity_relationships','entity_locations','entity_genres','entity_emotions','entity_contact_methods','submission_channels','entity_aliases','entity_sources','genres','emotions','roles','organisation_types','venue_types','relationship_types','emotion_families'] loop
 execute format('create trigger admin_change_audit after insert or update or delete on public.%I for each row execute function public.audit_admin_change()',t);
 end loop;
end $$;

create function public.admin_change_role(target_user_id uuid,new_role text,confirmed boolean) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_admin() then raise insufficient_privilege using message='Administrator access required';end if;
 if confirmed is distinct from true or new_role is null or new_role not in ('member','admin') then raise check_violation using message='Confirm a valid role change';end if;
 if target_user_id=auth.uid() then raise check_violation using message='Cannot change your own administrator role';end if;
 -- Serialize simultaneous demotions. Never remove the last administrator.
 perform pg_advisory_xact_lock(621830022);
 if not public.is_admin() then raise insufficient_privilege using message='Administrator access required';end if;
 if new_role='member' and (select role='admin' from public.user_roles where user_id=target_user_id)
 and (select count(*) from public.user_roles where role='admin')<=1 then raise check_violation using message='Cannot remove the last administrator';end if;
 update public.user_roles set role=new_role where user_id=target_user_id;
 if not found then raise no_data_found using message='Account not found';end if;
end $$;
revoke all on function public.admin_change_role(uuid,text,boolean) from public,anon;
grant execute on function public.admin_change_role(uuid,text,boolean) to authenticated;

-- Support reads are narrowly scoped audited functions. Existing private table
-- RLS remains membership-only, even for admins. No blanket private read policy.
create function public.admin_users_page(page_offset integer default 0,selected_user_id uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;begin
 if not public.is_admin() then raise insufficient_privilege using message='Administrator access required';end if;
 if page_offset<0 or page_offset>100000 then raise check_violation using message='Invalid page';end if;
 select jsonb_build_object('total',(select count(*) from auth.users where selected_user_id is null or id=selected_user_id),'items',coalesce(jsonb_agg(row),'[]')) into result from (
 select u.id,u.email,to_jsonb(u)->>'created_at' created_at,to_jsonb(u)->>'email_confirmed_at' email_confirmed_at,
 to_jsonb(u)->>'last_sign_in_at' last_sign_in_at,to_jsonb(u)->>'banned_until' banned_until,r.role,r.require_aal2,p.display_name,
 coalesce((select jsonb_agg(jsonb_build_object('workspace_id',m.workspace_id,'name',w.name,'role',m.role)) from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.user_id=u.id),'[]') workspaces
 from auth.users u join public.user_roles r on r.user_id=u.id left join public.profiles p on p.id=u.id
 where selected_user_id is null or u.id=selected_user_id order by u.id limit 50 offset page_offset) row;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata) values(auth.uid(),'support.read','users',selected_user_id::text,jsonb_build_object('offset',page_offset));
 return result;
end $$;
create function public.admin_workspaces_page(page_offset integer default 0) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;begin
 if not public.is_admin() then raise insufficient_privilege using message='Administrator access required';end if;
 if page_offset<0 or page_offset>100000 then raise check_violation using message='Invalid page';end if;
 select jsonb_build_object('total',(select count(*) from public.workspaces),'items',coalesce(jsonb_agg(row),'[]')) into result from (
 select w.id,w.name,w.created_at,
 coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role)) from public.workspace_members m where m.workspace_id=w.id),'[]') members,
 jsonb_build_object('contacts',(select count(*) from public.user_contacts c where c.workspace_id=w.id),'notes',(select count(*) from public.notes n where n.workspace_id=w.id),'lists',(select count(*) from public.lists l where l.workspace_id=w.id),'events',(select count(*) from public.calendar_events e where e.workspace_id=w.id)) private_counts
 from public.workspaces w order by w.id limit 50 offset page_offset) row;
 insert into public.admin_audit_log(admin_user_id,action,target_type,metadata) values(auth.uid(),'support.read','workspaces',jsonb_build_object('offset',page_offset));
 return result;
end $$;
revoke all on function public.admin_users_page(integer,uuid),public.admin_workspaces_page(integer) from public,anon;
grant execute on function public.admin_users_page(integer,uuid),public.admin_workspaces_page(integer) to authenticated;
