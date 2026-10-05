-- Data created using the beta schema must survive the ownership migration.
insert into auth.users(id,email) values('ffffffff-ffff-4fff-8fff-ffffffffffff','upgrade@example.test');
insert into profiles(id,display_name) values('ffffffff-ffff-4fff-8fff-ffffffffffff','Existing profile');
insert into user_contacts(id,user_id,private_display_name,follow_up_at) values('ffffffff-0000-4000-8000-000000000001','ffffffff-ffff-4fff-8fff-ffffffffffff','Existing contact',current_date);
insert into notes(user_id,user_contact_id,body) values('ffffffff-ffff-4fff-8fff-ffffffffffff','ffffffff-0000-4000-8000-000000000001','Existing note');
insert into lists(id,user_id,name) values('ffffffff-0000-4000-8000-000000000002','ffffffff-ffff-4fff-8fff-ffffffffffff','Existing list');
insert into list_members(user_id,list_id,user_contact_id) values('ffffffff-ffff-4fff-8fff-ffffffffffff','ffffffff-0000-4000-8000-000000000002','ffffffff-0000-4000-8000-000000000001');
insert into saved_views(user_id,name) values('ffffffff-ffff-4fff-8fff-ffffffffffff','Existing view');
insert into email_templates(user_id,name,subject,body) values('ffffffff-ffff-4fff-8fff-ffffffffffff','Existing template','Subject','Body');
select reserve_email('ffffffff-0000-4000-8000-000000000003','ffffffff-ffff-4fff-8fff-ffffffffffff','ffffffff-0000-4000-8000-000000000001');
select record_sent('ffffffff-0000-4000-8000-000000000003','ffffffff-ffff-4fff-8fff-ffffffffffff','ffffffff-0000-4000-8000-000000000001','upgrade-message','upgrade@example.test','Existing subject','Existing body');
