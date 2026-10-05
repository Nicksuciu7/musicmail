-- A default-template PKCE callback may authorize exactly one reset for the
-- provider-verified recovery session. Browser flags never confer this grant.
create table public.recovery_grants (
 session_id uuid primary key,
 user_id uuid not null references auth.users on delete cascade,
 expires_at timestamptz not null,
 consumed_at timestamptz
);
alter table public.recovery_grants enable row level security;
revoke all on public.recovery_grants from public,anon,authenticated;
grant all on public.recovery_grants to service_role;
create index recovery_grants_user on public.recovery_grants(user_id);
create function public.consume_recovery_grant(sid uuid,uid uuid) returns boolean
 language plpgsql security definer set search_path=public as $$ begin
 update recovery_grants set consumed_at=now() where session_id=sid and user_id=uid and expires_at>now() and consumed_at is null;
 return found;
end $$;
revoke all on function public.consume_recovery_grant(uuid,uuid) from public,anon,authenticated;
grant execute on function public.consume_recovery_grant(uuid,uuid) to service_role;
