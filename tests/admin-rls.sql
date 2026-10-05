-- Trusted fixtures only. All assertions exercise actual PostgreSQL permissions.
begin;
create temp table admin_checks(n integer);
insert into admin_checks values(0);
create function pg_temp.check_admin(ok boolean,label text) returns void language plpgsql security definer set search_path=pg_temp,public as $$ begin
 if not coalesce(ok,false) then raise exception 'Admin security check failed: %',label;end if;
 update admin_checks set n=n+1;
end $$;
insert into auth.users(id,email) values
 ('aaaaaaaa-4444-4444-8444-444444444444','admin-member-a@example.test'),
 ('bbbbbbbb-5555-4555-8555-555555555555','admin-member-b@example.test'),
 ('cccccccc-6666-4666-8666-666666666666','administrator@example.test');
select pg_temp.check_admin((select count(*)=3 from user_roles where user_id in ('aaaaaaaa-4444-4444-8444-444444444444','bbbbbbbb-5555-4555-8555-555555555555','cccccccc-6666-4666-8666-666666666666') and role='member'),'All new accounts are members');
-- Preserve legacy admin regression setup; this transaction rolls back.
update user_roles set role='member' where role='admin';
update user_roles set role='admin' where user_id='cccccccc-6666-4666-8666-666666666666';
set role authenticated;
do $$ declare u uuid; other uuid; n integer; result jsonb;begin
 foreach u in array array['aaaaaaaa-4444-4444-8444-444444444444'::uuid,'bbbbbbbb-5555-4555-8555-555555555555'::uuid] loop
 perform set_config('request.jwt.claim.sub',u::text,true);
 other:=case when u='aaaaaaaa-4444-4444-8444-444444444444' then 'bbbbbbbb-5555-4555-8555-555555555555'::uuid else 'aaaaaaaa-4444-4444-8444-444444444444'::uuid end;
 insert into user_contacts(id,entity_id,follow_up_at) values(u,'10000000-0000-4000-8000-000000000013',current_date);
 insert into notes(user_contact_id,body) values(u,'Separate private support note');
 insert into lists(id,name) values(u,'Separate list');
 insert into list_members(list_id,user_contact_id) values(u,u);
 insert into saved_views(name) values('Separate view');
 insert into interactions(user_contact_id,type,title,metadata) values(u,'note','Separate history','{"not_for_support":"never expose arbitrary interaction metadata"}');
 insert into calendar_events(id,title,start_date,end_date,contact_id) values(u,'Separate event','2026-10-12','2026-10-13',u);
 insert into calendar_event_items(event_id,label) values(u,'Separate equipment');
 perform pg_temp.check_admin(not is_admin(),'Member is not admin');
 perform pg_temp.check_admin((select count(*)=1 from user_roles),'Member sees own role only');
 begin update user_roles set role='admin' where user_id=u;raise exception 'Self-promotion allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Self promotion denied');end;
 begin update user_roles set role='admin' where user_id=other;raise exception 'Other promotion allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Other promotion denied');end;
 begin insert into user_roles(user_id,role) values(u,'admin');raise exception 'Role insert allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Role insert denied');end;
 begin delete from user_roles where user_id=u;raise exception 'Role delete allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Role delete denied');end;
 begin perform admin_change_role(u,'admin',true);raise exception 'Role RPC allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Role RPC denied');end;
 begin perform admin_users_page();raise exception 'Users RPC allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Users RPC denied');end;
 begin perform admin_workspaces_page();raise exception 'Workspaces RPC allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Workspaces RPC denied');end;
 begin perform admin_workspace_records(other,'notes');raise exception 'Support RPC allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Support RPC denied');end;
 perform pg_temp.check_admin((select count(*)=0 from admin_audit_log),'Member cannot read audit log');
 begin insert into admin_audit_log(action,target_type) values('forged','user');raise exception 'Audit forgery allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Audit insert denied');end;
 begin update admin_audit_log set metadata='{}';raise exception 'Audit update allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Audit update denied');end;
 begin delete from admin_audit_log;raise exception 'Audit delete allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Audit delete denied');end;
 perform pg_temp.check_admin((select count(*)=0 from notes where workspace_id=other),'Private isolation retained');
 perform pg_temp.check_admin((select count(*)=1 from entities where id='10000000-0000-4000-8000-000000000013'),'Same public canonical entity');
 end loop;
end $$;
reset role;
insert into sent_emails(user_id,workspace_id,user_contact_id,recipient,subject,body,gmail_message_id)
 select u,u,u,'to@example.test','Support subject','Never return email body','Never return provider id'
 from unnest(array['aaaaaaaa-4444-4444-8444-444444444444'::uuid,'bbbbbbbb-5555-4555-8555-555555555555'::uuid]) u;
insert into gmail_connections(user_id,email,encrypted_tokens) values('bbbbbbbb-5555-4555-8555-555555555555','b@example.test','fictional-encrypted-value-not-a-credential');
set role service_role;
select set_config('request.jwt.claim.sub','',true);
insert into genres(name,slug) values('Fictional trusted maintenance','fictional-trusted-maintenance');
select pg_temp.check_admin(exists(select 1 from admin_audit_log where admin_user_id is null and target_type='genres' and action='insert' and target_id=(select id::text from genres where slug='fictional-trusted-maintenance')),'Trusted maintenance audited');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-6666-4666-8666-666666666666',true);
do $$ declare section text; u uuid; result jsonb; n integer; tax uuid;begin
 perform pg_temp.check_admin(is_admin(),'Explicit administrator');
 perform pg_temp.check_admin((select count(*)=0 from notes),'No blanket administrator private RLS');
 result:=admin_users_page(0,'bbbbbbbb-5555-4555-8555-555555555555');
 perform pg_temp.check_admin(result->'items'->0->>'email'='admin-member-b@example.test','Intended email view');
 perform pg_temp.check_admin(not (result->'items'->0 ?| array['encrypted_password','raw_user_meta_data','raw_app_meta_data','confirmation_token','recovery_token']),'Auth allowlist');
 result:=admin_workspaces_page();
 perform pg_temp.check_admin((result->>'total')::int>=3,'Workspace overview');
 foreach u in array array['aaaaaaaa-4444-4444-8444-444444444444'::uuid,'bbbbbbbb-5555-4555-8555-555555555555'::uuid] loop
 foreach section in array array['contacts','notes','lists','list_members','saved_views','interactions','email_metadata','calendar_events','equipment','gmail_status'] loop
 result:=admin_workspace_records(u,section);
 perform pg_temp.check_admin(jsonb_array_length(result->'items')=case when section='interactions' then 3 else 1 end,'Intended support read: '||section);
 perform pg_temp.check_admin(result::text !~ 'encrypted_tokens|Never return|not_for_support|raw_app_meta_data|encrypted_password','Support secret allowlist: '||section);
 end loop;end loop;
 begin perform admin_workspace_records('bbbbbbbb-5555-4555-8555-555555555555','gmail_connections');raise exception 'Arbitrary table accepted';exception when check_violation then perform pg_temp.check_admin(true,'Arbitrary tables denied');end;
 begin perform admin_users_page(-1);raise exception 'Invalid page accepted';exception when check_violation then perform pg_temp.check_admin(true,'Invalid pages denied');end;
 begin perform admin_change_role('cccccccc-6666-4666-8666-666666666666','member',true);raise exception 'Own demotion allowed';exception when check_violation then perform pg_temp.check_admin(true,'Own demotion denied');end;
 begin perform admin_change_role('bbbbbbbb-5555-4555-8555-555555555555','admin',null);raise exception 'Null confirmation accepted';exception when check_violation then perform pg_temp.check_admin(true,'Explicit confirmation required');end;
 perform admin_change_role('bbbbbbbb-5555-4555-8555-555555555555','admin',true);
 perform pg_temp.check_admin((select role='admin' from user_roles where user_id='bbbbbbbb-5555-4555-8555-555555555555'),'Trusted role mutation succeeds');
 perform pg_temp.check_admin(exists(select 1 from admin_audit_log where admin_user_id=auth.uid() and target_id='bbbbbbbb-5555-4555-8555-555555555555' and target_type='user_roles' and metadata->>'role'='admin'),'Role action audited');
 perform admin_change_role('bbbbbbbb-5555-4555-8555-555555555555','member',true);
 insert into genres(name,slug) values('Fictional admin audit genre','fictional-admin-audit') returning id into tax;
 perform pg_temp.check_admin(exists(select 1 from admin_audit_log where admin_user_id=auth.uid() and target_id=tax::text and target_type='genres' and action='insert'),'Canonical edit audited');
 perform pg_temp.check_admin(not exists(select 1 from admin_audit_log where metadata::text like '%Fictional admin audit genre%'),'No canonical content in logs');
 perform pg_temp.check_admin((select count(*)>=22 from admin_audit_log where admin_user_id=auth.uid() and action='support.read'),'Support reads audited');
 begin delete from admin_audit_log;raise exception 'Admin audit deletion allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Admin cannot erase audit');end;
end $$;
reset role;
-- A trusted DBA can require AAL2 without weakening normal Auth or creating tokens.
update user_roles set require_aal2=true where user_id='cccccccc-6666-4666-8666-666666666666';
set role authenticated;
do $$ begin
 perform set_config('request.jwt.claims','{"aal":"aal1"}',true);
 perform pg_temp.check_admin(not is_admin(),'AAL1 rejected when required');
 begin perform admin_workspaces_page();raise exception 'AAL1 support allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'AAL1 privileged RPC denied');end;
 perform set_config('request.jwt.claims','{"aal":"aal2"}',true);
 perform pg_temp.check_admin(is_admin(),'AAL2 accepted when required');
end $$;
reset role;
set role anon;
do $$ begin
 begin perform admin_users_page();raise exception 'Anonymous RPC allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Anonymous admin RPC denied');end;
 begin select * from user_roles;raise exception 'Anonymous role read allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Anonymous role read denied');end;
 begin select * from admin_audit_log;raise exception 'Anonymous log read allowed';exception when insufficient_privilege then perform pg_temp.check_admin(true,'Anonymous audit read denied');end;
end $$;
reset role;
select 'Administrator PostgreSQL security assertions passed: '||n from admin_checks;
rollback;
