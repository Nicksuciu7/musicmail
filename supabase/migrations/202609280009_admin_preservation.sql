-- Editing a record must not erase its other contact methods, channels or provenance.
create or replace function public.admin_save_entity(document jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare eid uuid; kind text; method_id uuid; channel_id uuid; begin
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
 delete from entity_roles where entity_id=eid and is_current; insert into entity_roles(entity_id,role_id) select eid,id from roles where name in(select jsonb_array_elements_text(coalesce(document->'roles','[]')));
 delete from entity_aliases where entity_id=eid; insert into entity_aliases(entity_id,alias,normalised_alias) select eid,x,lower(trim(x)) from (select distinct jsonb_array_elements_text(coalesce(document->'aliases','[]')) x) a;
 if coalesce(document->>'email','')<>'' then
 select id into method_id from entity_contact_methods where entity_id=eid and contact_type='email' order by is_primary desc,created_at limit 1;
 if method_id is null then insert into entity_contact_methods(entity_id,contact_type,value,is_primary) values(eid,'email',document->>'email',true);
 else update entity_contact_methods set value=document->>'email' where id=method_id;end if;
 end if;
 select id into channel_id from submission_channels where entity_id=eid order by id limit 1;
 if channel_id is null then insert into submission_channels(entity_id,submission_type,status,instructions) values(eid,coalesce(document->>'submission_type','general'),coalesce(document->>'submission_status','unknown'),document->>'submission_instructions');
 else update submission_channels set submission_type=coalesce(document->>'submission_type','general'),status=coalesce(document->>'submission_status','unknown'),instructions=document->>'submission_instructions' where id=channel_id;end if;
 if not exists(select 1 from entity_sources where entity_id=eid and source_name is not distinct from document->>'source' and coalesce(source_url,'')=coalesce(document->>'source_url','')) then
 insert into entity_sources(entity_id,source_type,source_name,source_url,verified_at) values(eid,'admin',document->>'source',document->>'source_url',case when document->>'verification_status'='verified' then now() else null end);
 end if;
 return eid; end $$;
