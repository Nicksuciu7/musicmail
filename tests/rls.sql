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
