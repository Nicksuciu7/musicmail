alter table user_contacts add constraint contact_has_identity check(entity_id is not null or coalesce(length(trim(private_display_name)),0)>0);
alter table entities add column merged_into_id uuid references entities;
create function public.keep_entity_type() returns trigger language plpgsql as $$ begin if old.entity_type<>new.entity_type then raise exception 'Canonical entity type is immutable';end if;return new;end $$;
create trigger keep_entity_type before update on entities for each row execute function keep_entity_type();
create or replace function public.merge_entities(source_id uuid,target_id uuid,confirmed boolean) returns void language plpgsql security definer set search_path=public as $$
declare c record; existing uuid; begin
 if not is_admin() or not confirmed then raise exception 'Admin confirmation required'; end if;
 if source_id=target_id or not exists(select 1 from entities a join entities b on a.entity_type=b.entity_type and a.created_by is not distinct from b.created_by where a.id=source_id and b.id=target_id and a.visibility='public' and b.visibility='public' and a.archived_at is null and b.archived_at is null) then raise exception 'Choose two active public entities of the same type and ownership'; end if;
 perform 1 from entities where id in(source_id,target_id) order by id for update;
 for c in select * from user_contacts where entity_id=source_id loop
 select id into existing from user_contacts where entity_id=target_id and user_id=c.user_id;
 if existing is not null then
 update notes set user_contact_id=existing where user_contact_id=c.id and user_id=c.user_id;
 update interactions set user_contact_id=existing where user_contact_id=c.id and user_id=c.user_id;
 update sent_emails set user_contact_id=existing where user_contact_id=c.id and user_id=c.user_id;
 update email_send_attempts set user_contact_id=existing where user_contact_id=c.id and user_id=c.user_id;
 insert into list_members(user_id,list_id,user_contact_id) select user_id,list_id,existing from list_members where user_contact_id=c.id on conflict do nothing;
 update user_contacts set entity_id=null,private_display_name=coalesce(private_display_name,(select display_name from entities where id=source_id)),archived=true where id=c.id;
 else update user_contacts set entity_id=target_id where id=c.id; end if;
 end loop;
 insert into entity_aliases(entity_id,alias,normalised_alias) select target_id,display_name,lower(display_name) from entities where id=source_id on conflict do nothing;
 insert into entity_aliases(entity_id,alias,normalised_alias) select target_id,alias,normalised_alias from entity_aliases where entity_id=source_id on conflict do nothing;
 insert into entity_genres select target_id,genre_id from entity_genres where entity_id=source_id on conflict do nothing;
 insert into entity_emotions select target_id,emotion_id from entity_emotions where entity_id=source_id on conflict do nothing;
 insert into entity_locations select target_id,location_id,relationship_type from entity_locations where entity_id=source_id on conflict do nothing;
 insert into entity_roles(entity_id,role_id,organisation_id,started_at,ended_at,is_current) select target_id,r.role_id,r.organisation_id,r.started_at,r.ended_at,r.is_current from entity_roles r where r.entity_id=source_id and not exists(select 1 from entity_roles t where t.entity_id=target_id and t.role_id=r.role_id and t.organisation_id is not distinct from r.organisation_id);
 insert into entity_contact_methods(entity_id,contact_type,label,value,purpose,is_primary,is_public,is_verified,last_verified_at)
 select target_id,s.contact_type,s.label,s.value,s.purpose,false,s.is_public,s.is_verified,s.last_verified_at from entity_contact_methods s where s.entity_id=source_id and not exists(select 1 from entity_contact_methods t where t.entity_id=target_id and t.contact_type=s.contact_type and t.value=s.value and t.purpose is not distinct from s.purpose);
 insert into submission_channels(entity_id,submission_type,status,email_contact_method_id,submission_url,opens_at,closes_at,instructions,fee_amount,fee_currency,last_verified_at)
 select target_id,s.submission_type,s.status,(select t.id from entity_contact_methods t join entity_contact_methods old on old.id=s.email_contact_method_id where t.entity_id=target_id and t.contact_type=old.contact_type and t.value=old.value limit 1),s.submission_url,s.opens_at,s.closes_at,s.instructions,s.fee_amount,s.fee_currency,s.last_verified_at from submission_channels s where s.entity_id=source_id;
 insert into entity_sources(entity_id,source_type,source_name,source_url,retrieved_at,verified_at) select target_id,source_type,source_name,source_url,retrieved_at,verified_at from entity_sources where entity_id=source_id;
 insert into entity_relationships(source_entity_id,target_entity_id,relationship_type_id,started_at,ended_at,is_current)
 select case when source_entity_id=source_id then target_id else source_entity_id end,case when target_entity_id=source_id then target_id else target_entity_id end,relationship_type_id,started_at,ended_at,is_current from entity_relationships where (source_entity_id=source_id or target_entity_id=source_id) and (case when source_entity_id=source_id then target_id else source_entity_id end)<>(case when target_entity_id=source_id then target_id else target_entity_id end) on conflict do nothing;
 -- Preserve historical source edges on the archived identity; add canonical replacements above.
 update user_preferences set primary_artist_entity_id=target_id where primary_artist_entity_id=source_id;
 update entities set archived_at=now(),merged_into_id=target_id where id=source_id;
 end $$;
