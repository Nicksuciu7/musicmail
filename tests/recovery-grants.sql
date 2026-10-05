begin;
insert into auth.users(id,email) values('99999999-9999-4999-8999-999999999999','recovery-grant@example.test');
set role service_role;
insert into recovery_grants(session_id,user_id,expires_at) values('88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999',now()+interval '15 minutes');
do $$ begin
 if consume_recovery_grant('88888888-8888-4888-8888-888888888888','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'Wrong user consumed recovery'; end if;
 if not consume_recovery_grant('88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999') then raise exception 'Valid recovery denied'; end if;
 if consume_recovery_grant('88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999') then raise exception 'Recovery replay allowed'; end if;
 update recovery_grants set consumed_at=null,expires_at=now()-interval '1 second';
 if consume_recovery_grant('88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999') then raise exception 'Expired recovery accepted'; end if;
end $$;
reset role;
set role authenticated;
do $$ begin
 begin insert into recovery_grants(session_id,user_id,expires_at) values(gen_random_uuid(),'99999999-9999-4999-8999-999999999999',now());raise exception 'Recovery grant forgery allowed';exception when insufficient_privilege then null;end;
 begin perform consume_recovery_grant('88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999');raise exception 'Grant RPC exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
