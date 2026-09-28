-- A minimal auth shim provides real PostgreSQL role/RLS behavior, not Supabase GoTrue.
insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a@example.test'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b@example.test');
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select complete_onboarding('A private band','band','London',array['Indie Folk'],array['Intimate'],'["Book gigs"]');
insert into user_contacts(id,user_id,entity_id) values('aaaaaaaa-0000-4000-8000-000000000001',auth.uid(),'10000000-0000-4000-8000-000000000001');
insert into notes(user_contact_id,body) values('aaaaaaaa-0000-4000-8000-000000000001','A secret note');
insert into lists(id,name) values('aaaaaaaa-0000-4000-8000-000000000002','A list');
insert into list_members(list_id,user_contact_id) values('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001');
insert into saved_views(name,filter_definition) values('Folk promoters','{"genres":["Indie Folk"]}');
select import_contacts('[{"name":"Private Booker","email":"booker@example.test","notes":"Imported privately","relationship":"warm"}]',false);
do $$ begin
 if (select count(*) from user_contacts)<>2 then raise exception 'Owner contacts missing'; end if;
 if (select count(*) from notes)<>2 then raise exception 'Owner notes missing'; end if;
 if (discover_entities('{"roles":["Promoter"],"locations":["London"],"genres":["Indie Folk"],"emotions":["Intimate"]}')->>'total')::int<>3 then raise exception 'Music filters failed'; end if;
 if (select count(*) from entities where visibility='private')<>1 then raise exception 'Artist not created canonically'; end if;
 begin insert into entities(entity_type,display_name) values('person','Unauthorised edit');raise exception 'Expected shared write denial';exception when insufficient_privilege then null;end;
 begin select encrypted_tokens from gmail_connections;raise exception 'Expected token denial';exception when insufficient_privilege then null;end;
 begin perform merge_entities('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',true);raise exception 'Expected admin denial';exception when raise_exception then if SQLERRM='Expected admin denial' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$ begin
 if (select count(*) from user_contacts)<>0 or (select count(*) from notes)<>0 or (select count(*) from lists)<>0 or (select count(*) from list_members)<>0 or (select count(*) from saved_views)<>0 or (select count(*) from interactions)<>0 then raise exception 'Cross-user privacy leak'; end if;
 if (select count(*) from entities where visibility='private')<>0 then raise exception 'Private artist leak'; end if;
 begin insert into notes(user_contact_id,body) values('aaaaaaaa-0000-4000-8000-000000000001','Attack');raise exception 'Expected foreign owner denial';exception when foreign_key_violation then null;end;
 begin insert into user_contacts(user_id,private_display_name) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Attack');raise exception 'Expected owner denial';exception when insufficient_privilege then null;end;
 begin update notes set body='Attack' where body='A secret note';if found then raise exception 'Cross-user note modified';end if;end;
end $$;
insert into user_contacts(id,private_display_name,outreach_status) values('bbbbbbbb-0000-4000-8000-000000000001','B contact','do_not_contact');
reset role;
set role service_role;
do $$ begin
 begin perform reserve_email('cccccccc-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-0000-4000-8000-000000000001');raise exception 'Suppression failed';exception when raise_exception then if SQLERRM='Suppression failed' then raise;end if;end;
end $$;
select reserve_email('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001');
select record_sent('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','gmail-test','to@example.test','Test subject','Test body');
do $$ begin
 if (select outreach_status from user_contacts where id='aaaaaaaa-0000-4000-8000-000000000001')<>'sent' then raise exception 'Send transition failed'; end if;
 if (select count(*) from sent_emails)<>1 then raise exception 'Send metadata missing';end if;
 begin perform reserve_email('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001');raise exception 'Replay protection failed';exception when unique_violation then null;end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$ begin if (select count(*) from sent_emails)<>0 then raise exception 'Email metadata leaked';end if;end $$;
reset role;
-- Extended integration checks for exports, templates, network query and admin separation.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$ begin
 if (network_contacts('{"relationship":"warm"}')->>'total')::int<>1 then raise exception 'Private network filtering failed';end if;
 if jsonb_array_length(workspace_document()->'contacts')<>2 then raise exception 'Workspace export incomplete';end if;
 if (select count(*) from email_templates)<>8 then raise exception 'Onboarding templates missing';end if;
 begin insert into user_contacts(user_id) values(auth.uid());raise exception 'Null identity accepted';exception when check_violation then null;end;
end $$;
reset role;
insert into admin_users values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$ begin
 if (select count(*) from notes)<>0 then raise exception 'Admin leaked private notes';end if;
 begin insert into venues(entity_id) values('10000000-0000-4000-8000-000000000001');raise exception 'Subtype mismatch accepted';exception when raise_exception then if SQLERRM='Subtype mismatch accepted' then raise;end if;end;
end $$;
select merge_entities('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000013',true);
do $$ begin
 if not exists(select 1 from entity_contact_methods where entity_id='10000000-0000-4000-8000-000000000013' and value='hello@mosslightpresents.example') then raise exception 'Merge lost public contact';end if;
 if not exists(select 1 from entity_sources where entity_id='10000000-0000-4000-8000-000000000013') then raise exception 'Merge lost provenance';end if;
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$ begin
 if not exists(select 1 from user_contacts where entity_id='10000000-0000-4000-8000-000000000013') then raise exception 'Merge failed to relink owner contact';end if;
 if (select count(*) from notes)<>2 then raise exception 'Merge lost private notes';end if;
end $$;
reset role;
-- Owner removal cascades through private data and owned canonical artist.
delete from auth.users where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$ begin if exists(select 1 from notes where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') or exists(select 1 from entities where created_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'Account deletion incomplete';end if;end $$;
-- Bound normal page data while preserving exports beyond PostgREST's usual row cap.
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
insert into user_contacts(private_display_name,private_email) select 'Volume contact '||g,'volume'||g||'@example.test' from generate_series(1,1105) g;
do $$ begin
 if jsonb_array_length(workspace_summary()->'contacts')<>50 then raise exception 'Workspace summary is not bounded';end if;
 if jsonb_array_length(workspace_document()->'contacts')<>1106 then raise exception 'Export truncated beyond 1000 records';end if;
 if jsonb_array_length(network_contacts('{"page":2}')->'items')<>12 then raise exception 'Network pagination failed';end if;
 if (network_contacts('{"q":"Volume contact 1105"}')->>'total')::int<>1 then raise exception 'Search outside initial page failed';end if;
end $$;
update user_contacts set outreach_status='not_contacted' where id='bbbbbbbb-0000-4000-8000-000000000001';
reset role;
set role service_role;
do $$ declare i integer;begin
 for i in 1..30 loop perform reserve_email(gen_random_uuid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-0000-4000-8000-000000000001');end loop;
 begin perform reserve_email(gen_random_uuid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-0000-4000-8000-000000000001');raise exception 'Rate limit failed';exception when raise_exception then if SQLERRM='Rate limit failed' then raise;end if;end;
end $$;
reset role;
