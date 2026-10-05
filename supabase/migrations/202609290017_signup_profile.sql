-- Names are display metadata, never authorization attributes. Reading via JSON
-- keeps the migration compatible with the minimal local Auth test harness.
create or replace function public.provision_personal_workspace() returns trigger
 language plpgsql security definer set search_path=public as $$
declare display text; begin
 display:=left(trim(coalesce(to_jsonb(new)->'raw_user_meta_data'->>'name',to_jsonb(new)->'raw_user_meta_data'->>'full_name','')),100);
 insert into workspaces(id,name,created_by) values(new.id,case when display='' then 'My MusicMail' else display||'''s MusicMail' end,new.id) on conflict(id) do nothing;
 insert into workspace_members(workspace_id,user_id,role) values(new.id,new.id,'owner') on conflict do nothing;
 insert into profiles(id,display_name) values(new.id,nullif(display,'')) on conflict do nothing;
 return new;
end $$;
revoke all on function public.provision_personal_workspace() from public,anon,authenticated;
