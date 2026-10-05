set role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-ffffffffffff',false);
do $$ declare t text; n integer; begin
 foreach t in array array['user_contacts','notes','interactions','lists','list_members','saved_views','email_templates','sent_emails'] loop
  execute format('select count(*) from public.%I where workspace_id=auth.uid() and user_id=auth.uid()',t) into n;
  if n=0 then raise exception 'Backfill lost data or audit actor: %',t; end if;
 end loop;
 if (select display_name from profiles where id=auth.uid())<>'Existing profile' then raise exception 'Backfill changed profile'; end if;
 if not exists(select 1 from workspace_members where workspace_id=auth.uid() and role='owner') then raise exception 'Owner not provisioned'; end if;
end $$;
reset role;
delete from auth.users where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
select set_config('request.jwt.claim.sub','',false);
