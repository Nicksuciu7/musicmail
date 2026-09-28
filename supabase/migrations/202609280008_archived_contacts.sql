-- Archiving removes an entity from Explore without erasing identity from existing networks.
create or replace function public.can_read_entity(eid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from entities e where e.id=eid and (
 (e.visibility='public' and (e.archived_at is null or exists(select 1 from user_contacts c where c.entity_id=e.id and c.user_id=auth.uid()))) or e.created_by=auth.uid() or is_admin()));
$$;
