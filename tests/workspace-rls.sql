-- Real PostgreSQL role checks; run transactionally after the legacy regression suite.
begin;
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  if has_table_privilege('authenticated','public.'||t,'TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Unsafe authenticated privilege on %',t; end if;
 end loop;
 foreach t in array array['workspaces','workspace_members','profiles','user_preferences','user_contacts','notes','lists','list_members','saved_views','interactions','email_templates','sent_emails','gmail_connections','email_send_attempts','admin_users'] loop
  if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS disabled on %',t; end if;
  if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Anonymous grant on %',t; end if;
 end loop;
 if has_function_privilege('authenticated','public.reserve_email(uuid,uuid,uuid)','EXECUTE') or
    has_function_privilege('anon','public.workspace_document()','EXECUTE') then raise exception 'Privileged function exposed'; end if;
end $$;
insert into auth.users(id,email) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','workspace-a@example.test'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','workspace-b@example.test');
-- Each actor owns the same canonical entity, but different private overlays.
set role authenticated;
do $$ declare u uuid; begin
 foreach u in array array['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid] loop
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into user_contacts(id,entity_id,follow_up_at) values(u,'10000000-0000-4000-8000-000000000013',current_date);
  insert into notes(id,user_contact_id,body) values(u,u,'Private note');
  insert into lists(id,name) values(u,'Private list');
  insert into list_members(list_id,user_contact_id) values(u,u);
  insert into saved_views(id,name) values(u,'Private view');
  insert into email_templates(id,name,subject,body) values(u,'Private template','Subject','Body');
 end loop;
end $$;
reset role;
set role service_role;
do $$ declare u uuid; begin
 foreach u in array array['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid] loop
  perform reserve_email(u,u,u);
  perform record_sent(u,u,u,'test-message','recipient@example.test','Private subject','Private body');
 end loop;
end $$;
reset role;

-- Anonymous access must fail by grants even with a forged identity claim.
set role anon;
do $$ declare t text; begin
 perform set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
 foreach t in array array['workspaces','workspace_members','profiles','user_preferences','user_contacts','notes','lists','list_members','saved_views','interactions','email_templates','sent_emails','gmail_connections','email_send_attempts','admin_users'] loop
  begin execute format('select * from public.%I',t); raise exception 'Anonymous SELECT allowed on %',t;
  exception when insufficient_privilege then null; end;
 end loop;
end $$;
reset role;
set role authenticated;
do $$ declare u uuid; other uuid; t text; n integer; payload jsonb; begin
 foreach u in array array['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid] loop
  other:=case when u='cccccccc-cccc-4ccc-8ccc-cccccccccccc' then 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid else 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid end;
  perform set_config('request.jwt.claim.sub',u::text,true);
  if not exists(select 1 from entities where id='10000000-0000-4000-8000-000000000013') then raise exception 'Shared entity unavailable'; end if;
  if not exists(select 1 from user_contacts where id=u and follow_up_at=current_date) then raise exception 'Own follow-up unavailable'; end if;
  foreach t in array array['user_contacts','notes','lists','list_members','saved_views','interactions','email_templates','sent_emails'] loop
   execute format('select count(*) from public.%I where workspace_id=$1',t) into n using u;
   if n=0 then raise exception 'Own SELECT failed: %',t; end if;
   execute format('select count(*) from public.%I where workspace_id=$1',t) into n using other;
   if n<>0 then raise exception 'Cross workspace SELECT: %',t; end if;
   begin
    execute format('update public.%I set workspace_id=workspace_id where workspace_id=$1',t) using other;
    get diagnostics n=row_count;
    if n<>0 then raise exception 'Cross workspace UPDATE: %',t; end if;
   exception when insufficient_privilege then if t<>'sent_emails' then raise; end if; end;
   begin
    execute format('delete from public.%I where workspace_id=$1',t) using other;
    get diagnostics n=row_count;
    if n<>0 then raise exception 'Cross workspace DELETE: %',t; end if;
   exception when insufficient_privilege then if t<>'sent_emails' then raise; end if; end;
   execute format('select to_jsonb(x) from public.%I x where workspace_id=$1 limit 1',t) into payload using u;
   payload:=payload||jsonb_build_object('workspace_id',other,'user_id',u);
   if payload ? 'id' then payload:=payload||jsonb_build_object('id',gen_random_uuid()); end if;
   if payload ? 'user_contact_id' then payload:=payload||jsonb_build_object('user_contact_id',other); end if;
   if payload ? 'list_id' then payload:=payload||jsonb_build_object('list_id',other); end if;
   begin
    execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',t,t) using payload;
    raise exception 'Cross workspace INSERT: %',t;
   exception when insufficient_privilege then null; end;
  end loop;
  begin update user_contacts set workspace_id=other where id=u; raise exception 'Tenant movement accepted'; exception when insufficient_privilege then null; end;
  begin insert into notes(workspace_id,user_contact_id,body) values(u,other,'Forged parent'); raise exception 'Cross workspace parent accepted'; exception when foreign_key_violation then null; end;
  begin insert into workspace_members values(other,u,'owner',now()); raise exception 'Membership escalation'; exception when insufficient_privilege then null; end;
  begin perform reserve_email(gen_random_uuid(),other,other); raise exception 'Service RPC exposed'; exception when insufficient_privilege then null; end;
  begin select encrypted_tokens from gmail_connections; raise exception 'Credentials exposed'; exception when insufficient_privilege then null; end;
  if jsonb_array_length(workspace_document()->'contacts')<>1 then raise exception 'Export crosses workspace'; end if;
 end loop;
end $$;
reset role;
-- Membership, not creator identity, confers access. Removing membership revokes it.
insert into workspace_members(workspace_id,user_id,role) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd','member');
set role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $$ begin
 update user_contacts set relationship_status='warm' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 if not found then raise exception 'Member update denied'; end if;
 insert into notes(workspace_id,user_contact_id,body) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','cccccccc-cccc-4ccc-8ccc-cccccccccccc','Member note');
end $$;
reset role;
-- Last owner with other members cannot disappear, even via the service API.
do $$ begin
 begin delete from auth.users where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'; raise exception 'Last owner deleted';
 exception when raise_exception then if SQLERRM='Last owner deleted' then raise; end if; end;
end $$;
delete from workspace_members where workspace_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set role authenticated;
do $$ begin if exists(select 1 from user_contacts where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') then raise exception 'Revoked member retained access'; end if; end $$;
reset role;
-- Account deletion preserves canonical entities, removes sole-member private data.
insert into entities(id,entity_type,display_name,created_by) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','person','Public retained','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
delete from auth.users where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$ begin
 if exists(select 1 from workspaces where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') then raise exception 'Workspace deletion incomplete'; end if;
 if not exists(select 1 from entities where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' and created_by is null) then raise exception 'Public entity lost'; end if;
end $$;
set role service_role;
do $$ declare key text:=repeat('a',64); begin
 if consume_request_limit(key,2,60)<>0 then raise exception 'First request denied'; end if;
 if consume_request_limit(key,2,60)<>0 then raise exception 'Second request denied'; end if;
 if consume_request_limit(key,2,60)<=0 then raise exception 'Rate cap not enforced'; end if;
 update request_buckets set expires_at=now()-interval '1 second' where bucket=key;
 if consume_request_limit(key,2,60)<>0 then raise exception 'Window did not reset'; end if;
end $$;
reset role;
set role authenticated;
do $$ begin
 begin perform consume_request_limit(repeat('b',64),100,60);raise exception 'Rate bypass exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
