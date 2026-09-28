create function public.admin_save_entity(document jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare eid uuid; kind text; begin
 if not is_admin() then raise exception 'Admin required'; end if;
 eid:=coalesce((document->>'id')::uuid,gen_random_uuid()); kind:=document->>'entity_type';
 if exists(select 1 from entities where id=eid and entity_type<>kind) then raise exception 'Entity type cannot be changed'; end if;
 insert into entities(id,entity_type,display_name,description,verification_status,primary_location_id) values(eid,kind,document->>'display_name',document->>'description',coalesce(document->>'verification_status','unverified'),(select id from locations where city=document->>'location' limit 1)) on conflict(id) do update set display_name=excluded.display_name,description=excluded.description,verification_status=excluded.verification_status,primary_location_id=excluded.primary_location_id,updated_at=now();
 if kind='person' then insert into people(entity_id,first_name) values(eid,split_part(document->>'display_name',' ',1)) on conflict do nothing;
 elsif kind='organisation' then insert into organisations(entity_id,organisation_type_id) values(eid,(select id from organisation_types where name=document->>'organisation_type')) on conflict(entity_id) do update set organisation_type_id=excluded.organisation_type_id;
 elsif kind='venue' then insert into venues(entity_id) values(eid) on conflict do nothing;
 elsif kind='artist_project' then insert into artist_projects(entity_id,artist_type) values(eid,'other') on conflict do nothing; end if;
 delete from entity_genres where entity_id=eid; insert into entity_genres select eid,id from genres where name in(select jsonb_array_elements_text(coalesce(document->'genres','[]')));
 delete from entity_emotions where entity_id=eid; insert into entity_emotions select eid,id from emotions where name in(select jsonb_array_elements_text(coalesce(document->'emotions','[]')));
 delete from entity_roles where entity_id=eid; insert into entity_roles(entity_id,role_id) select eid,id from roles where name in(select jsonb_array_elements_text(coalesce(document->'roles','[]')));
 delete from entity_aliases where entity_id=eid; insert into entity_aliases(entity_id,alias,normalised_alias) select eid,x,lower(trim(x)) from (select distinct jsonb_array_elements_text(coalesce(document->'aliases','[]')) x) a;
 if coalesce(document->>'email','')<>'' then
 delete from submission_channels where entity_id=eid;
 delete from entity_contact_methods where entity_id=eid and contact_type='email';
 insert into entity_contact_methods(entity_id,contact_type,value) values(eid,'email',document->>'email');
 end if;
 if not exists(select 1 from submission_channels where entity_id=eid) then insert into submission_channels(entity_id,submission_type,status,instructions) values(eid,coalesce(document->>'submission_type','general'),coalesce(document->>'submission_status','unknown'),document->>'submission_instructions');
 else update submission_channels set submission_type=coalesce(document->>'submission_type','general'),status=coalesce(document->>'submission_status','unknown'),instructions=document->>'submission_instructions' where entity_id=eid; end if;
 delete from entity_sources where entity_id=eid; insert into entity_sources(entity_id,source_type,source_name,source_url,verified_at) values(eid,'admin',document->>'source',document->>'source_url',case when document->>'verification_status'='verified' then now() else null end);
 return eid; end $$;
create function public.merge_entities(source_id uuid,target_id uuid,confirmed boolean) returns void language plpgsql security definer set search_path=public as $$
declare c record; existing uuid; begin
 if not is_admin() or not confirmed then raise exception 'Admin confirmation required'; end if;
 if source_id=target_id or not exists(select 1 from entities a join entities b on a.entity_type=b.entity_type where a.id=source_id and b.id=target_id and a.visibility='public' and b.visibility='public') then raise exception 'Choose two public entities of the same type'; end if;
 perform 1 from entities where id in(source_id,target_id) order by id for update;
 for c in select * from user_contacts where entity_id=source_id loop
 select id into existing from user_contacts where entity_id=target_id and user_id=c.user_id;
 if existing is not null then
 update notes set user_contact_id=existing where user_contact_id=c.id and user_id=c.user_id;
 update interactions set user_contact_id=existing where user_contact_id=c.id and user_id=c.user_id;
 update sent_emails set user_contact_id=existing where user_contact_id=c.id and user_id=c.user_id;
 update email_send_attempts set user_contact_id=existing where user_contact_id=c.id and user_id=c.user_id;
 insert into list_members(user_id,list_id,user_contact_id) select user_id,list_id,existing from list_members where user_contact_id=c.id on conflict do nothing;
 -- Retain both private overlays when their metadata conflicts; archive source with its identity label.
 update user_contacts set entity_id=null,private_display_name=coalesce(private_display_name,(select display_name from entities where id=source_id)),archived=true where id=c.id;
 else update user_contacts set entity_id=target_id where id=c.id; end if;
 end loop;
 insert into entity_aliases(entity_id,alias,normalised_alias) select target_id,display_name,lower(display_name) from entities where id=source_id on conflict do nothing;
 insert into entity_aliases(entity_id,alias,normalised_alias) select target_id,alias,normalised_alias from entity_aliases where entity_id=source_id on conflict do nothing;
 insert into entity_genres select target_id,genre_id from entity_genres where entity_id=source_id on conflict do nothing;
 insert into entity_emotions select target_id,emotion_id from entity_emotions where entity_id=source_id on conflict do nothing;
 insert into entity_locations select target_id,location_id,relationship_type from entity_locations where entity_id=source_id on conflict do nothing;
 update entities set archived_at=now() where id=source_id;
 end $$;
revoke all on function admin_save_entity(jsonb),merge_entities(uuid,uuid,boolean) from public;
grant execute on function admin_save_entity(jsonb),merge_entities(uuid,uuid,boolean) to authenticated;
