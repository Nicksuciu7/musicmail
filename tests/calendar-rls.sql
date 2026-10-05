-- Calendar checks execute as real PostgreSQL roles, both directions. No mocks.
begin;
create temp table calendar_checks(n integer);
insert into calendar_checks values(0);
create function pg_temp.check_calendar(ok boolean,label text) returns void language plpgsql security definer set search_path=pg_temp,public as $$ begin
 if not coalesce(ok,false) then raise exception 'Calendar security check failed: %',label;end if;
 update calendar_checks set n=n+1;
end $$;
insert into auth.users(id,email) values ('aaaaaaaa-1111-4111-8111-111111111111','calendar-a@example.test'),('bbbbbbbb-2222-4222-8222-222222222222','calendar-b@example.test');
insert into entities(id,entity_type,display_name,visibility,created_by) values('cccccccc-3333-4333-8333-333333333333','venue','Shared fictional calendar venue','public','aaaaaaaa-1111-4111-8111-111111111111');
set role authenticated;
do $$ declare u uuid; begin
 foreach u in array array['aaaaaaaa-1111-4111-8111-111111111111'::uuid,'bbbbbbbb-2222-4222-8222-222222222222'::uuid] loop
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into user_contacts(id,private_display_name) values(u,'Private calendar contact');
 insert into calendar_events(id,title,start_date,end_date,contact_id,venue_entity_id) values(u,'Private gig','2026-10-12','2026-10-13',u,'cccccccc-3333-4333-8333-333333333333');
 insert into calendar_event_items(id,event_id,label,quantity) values(u,u,'mics',2);
 end loop;
end $$;
reset role;
set constraints all immediate;
set role authenticated;
do $$ declare u uuid; other uuid; t text; count_rows integer; eid uuid; item uuid; payload jsonb; begin
 foreach u in array array['aaaaaaaa-1111-4111-8111-111111111111'::uuid,'bbbbbbbb-2222-4222-8222-222222222222'::uuid] loop
 other:=case when u='aaaaaaaa-1111-4111-8111-111111111111'::uuid then 'bbbbbbbb-2222-4222-8222-222222222222'::uuid else 'aaaaaaaa-1111-4111-8111-111111111111'::uuid end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform pg_temp.check_calendar((select count(*)=1 from entities where id='cccccccc-3333-4333-8333-333333333333'),'Shared venue readable');
 foreach t in array array['calendar_events','calendar_event_items'] loop
 execute format('select count(*) from %I where workspace_id=$1',t) into count_rows using u;
 perform pg_temp.check_calendar(count_rows=1,'Own read '||t);
 execute format('select count(*) from %I where workspace_id=$1',t) into count_rows using other;
 perform pg_temp.check_calendar(count_rows=0,'Cross read '||t);
 execute format('update %I set workspace_id=$1 where workspace_id=$1',t) using other;
 get diagnostics count_rows=row_count;perform pg_temp.check_calendar(count_rows=0,'Cross update '||t);
 execute format('delete from %I where workspace_id=$1',t) using other;
 get diagnostics count_rows=row_count;perform pg_temp.check_calendar(count_rows=0,'Cross delete '||t);
 begin
 if t='calendar_events' then insert into calendar_events(workspace_id,title,start_date,end_date) values(other,'Attack','2026-10-12','2026-10-13');
 else insert into calendar_event_items(workspace_id,event_id,label) values(other,other,'Attack');end if;
 raise exception 'Cross insert allowed';exception when insufficient_privilege then perform pg_temp.check_calendar(true,'Cross insert blocked '||t);end;
 begin execute format('update %I set workspace_id=$1 where workspace_id=$2',t) using other,u;raise exception 'Workspace move allowed';exception when insufficient_privilege then perform pg_temp.check_calendar(true,'Workspace move blocked '||t);end;
 begin execute format('update %I set user_id=$1 where workspace_id=$2',t) using other,u;raise exception 'Actor tamper allowed';exception when insufficient_privilege then perform pg_temp.check_calendar(true,'Actor immutable '||t);end;
 end loop;
 begin insert into calendar_event_items(event_id,label) values(other,'Cross-parent item');raise exception 'Cross parent allowed';exception when foreign_key_violation then perform pg_temp.check_calendar(true,'Cross-parent item blocked');end;
 begin insert into calendar_events(title,start_date,end_date,contact_id) values('Cross contact','2026-10-12','2026-10-13',other);raise exception 'Cross contact allowed';exception when foreign_key_violation then perform pg_temp.check_calendar(true,'Cross-workspace contact blocked');end;
 begin insert into calendar_events(title,start_date,end_date,venue_entity_id) values('Not a venue','2026-10-12','2026-10-13','10000000-0000-4000-8000-000000000001');raise exception 'Invalid venue allowed';exception when insufficient_privilege then perform pg_temp.check_calendar(true,'Non-venue link blocked');end;
 begin insert into calendar_events(title,start_date,end_date,timezone) values('Bad zone','2026-10-12','2026-10-13','Invalid/Zone');raise exception 'Bad zone allowed';exception when check_violation then perform pg_temp.check_calendar(true,'Invalid timezone blocked');end;
 begin insert into calendar_events(title,start_date,end_date,starts_at,ends_at,all_day) values('Bad instant','2026-10-12','2026-10-12','2026-10-12 19:00Z','2026-10-12 18:00Z',false);raise exception 'Backwards time allowed';exception when check_violation then perform pg_temp.check_calendar(true,'Backwards interval blocked');end;
 update calendar_event_items set completed=true where id=u;
 perform pg_temp.check_calendar((select completed from calendar_event_items where id=u),'Own checklist updates');
 -- RPC is invoker, rejects payload actor/workspace overrides, and is atomic.
 payload:=jsonb_build_object('title','Atomic gig','event_type','Gig','start_date','2026-10-12','end_date','2026-10-13','all_day',true,'timezone','Europe/London','location_name','','address','','promoter','','fee','','ticket_url','','notes','','workspace_id',other,'user_id',other);
 eid:=save_calendar_event(null,payload,'[{"label":"Martin D-28"}]');
 perform pg_temp.check_calendar((select workspace_id=u and user_id=u from calendar_events where id=eid),'RPC ownership overrides ignored');
 select id into item from calendar_event_items where event_id=eid;
 begin perform save_calendar_event(eid,payload||'{"title":"Must roll back"}',jsonb_build_array(jsonb_build_object('id',other,'label','Stolen')));raise exception 'Cross item accepted';exception when insufficient_privilege then perform pg_temp.check_calendar(true,'RPC cross-item rejected');end;
 perform pg_temp.check_calendar((select title='Atomic gig' from calendar_events where id=eid),'RPC failure rolls back event edit');
 begin perform save_calendar_event(other,payload,'[]');raise exception 'Cross event RPC allowed';exception when insufficient_privilege then perform pg_temp.check_calendar(true,'RPC cross-event rejected');end;
 delete from calendar_events where id=eid;
 perform pg_temp.check_calendar(not exists(select 1 from calendar_event_items where id=item),'Event deletion cascades checklist');
 end loop;
end $$;
reset role;
set role anon;
do $$ declare t text;begin
 foreach t in array array['calendar_events','calendar_event_items'] loop
 begin execute format('select * from %I',t);raise exception 'Anonymous read allowed';exception when insufficient_privilege then perform pg_temp.check_calendar(true,'Anonymous denied '||t);end;
 end loop;
 begin perform save_calendar_event(null,'{}','[]');raise exception 'Anonymous RPC allowed';exception when insufficient_privilege then perform pg_temp.check_calendar(true,'Anonymous RPC denied');end;
end $$;
reset role;
-- Contact deletion clears only the optional link. Calendar history survives.
delete from user_contacts where id='aaaaaaaa-1111-4111-8111-111111111111';
select pg_temp.check_calendar((select contact_id is null from calendar_events where id='aaaaaaaa-1111-4111-8111-111111111111'),'Contact deletion preserves event');
-- Membership revocation hides both event and items immediately.
delete from workspace_members where user_id='bbbbbbbb-2222-4222-8222-222222222222';
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',true);
select pg_temp.check_calendar(not exists(select 1 from calendar_events),'Revoked member cannot read calendar');
select pg_temp.check_calendar(not exists(select 1 from calendar_event_items),'Revoked member cannot read checklist');
reset role;
-- Sole-workspace account deletion removes private calendar, retains shared venue.
delete from auth.users where id='aaaaaaaa-1111-4111-8111-111111111111';
select pg_temp.check_calendar(not exists(select 1 from calendar_events where workspace_id='aaaaaaaa-1111-4111-8111-111111111111'),'Account deletion cleans events');
select pg_temp.check_calendar(not exists(select 1 from calendar_event_items where workspace_id='aaaaaaaa-1111-4111-8111-111111111111'),'Account deletion cleans items');
select pg_temp.check_calendar(exists(select 1 from entities where id='cccccccc-3333-4333-8333-333333333333' and created_by is null),'Shared venue retained after account deletion');
select 'Calendar database: '||n||' assertions passed (A/B, atomic RPC, link integrity, deletion, revocation).' from calendar_checks;
rollback;
