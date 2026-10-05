do $$ begin
 if (select role from public.user_roles where user_id='dddddddd-7777-4777-8777-777777777777') is distinct from 'admin' then raise exception 'Existing administrator lost';end if;
 if (select role from public.user_roles where user_id='eeeeeeee-8888-4888-8888-888888888888') is distinct from 'member' then raise exception 'Existing member accidentally promoted';end if;
end $$;
delete from auth.users where id in ('dddddddd-7777-4777-8777-777777777777','eeeeeeee-8888-4888-8888-888888888888');
