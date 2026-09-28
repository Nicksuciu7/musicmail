-- Enforce subtype integrity and maintain update times independently of clients.
create function public.check_entity_subtype() returns trigger language plpgsql set search_path=public as $$
declare expected text; begin
 expected:=case TG_TABLE_NAME when 'people' then 'person' when 'organisations' then 'organisation' when 'artist_projects' then 'artist_project' else 'venue' end;
 if not exists(select 1 from entities where id=new.entity_id and entity_type=expected) then raise exception 'Entity subtype mismatch';end if;return new;end $$;
create trigger subtype_check before insert or update on people for each row execute function check_entity_subtype();
create trigger subtype_check before insert or update on organisations for each row execute function check_entity_subtype();
create trigger subtype_check before insert or update on artist_projects for each row execute function check_entity_subtype();
create trigger subtype_check before insert or update on venues for each row execute function check_entity_subtype();
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
do $$ declare t text;begin foreach t in array array['entities','entity_relationships','entity_contact_methods','profiles','user_preferences','user_contacts','notes','saved_views','email_templates'] loop execute format('create trigger touch_updated_at before update on %I for each row execute function touch_updated_at()',t);end loop;end $$;
create index submissions_entity on submission_channels(entity_id,status,submission_type);
create index source_entity on entity_sources(entity_id);
create index roles_organisation on entity_roles(organisation_id);
create index relationship_target on entity_relationships(target_entity_id);
create index contacts_entity on user_contacts(entity_id);
-- Account deletion must not fail when a contact points to its owner's private artist.
-- Snapshot the artist identity into the contact before the entity FK becomes null.
create function public.preserve_contact_name() returns trigger language plpgsql security definer set search_path=public as $$ begin update user_contacts set private_display_name=coalesce(private_display_name,old.display_name) where entity_id=old.id;return old;end $$;
create trigger preserve_contact_name before delete on entities for each row execute function preserve_contact_name();

create function public.network_contacts(filters jsonb default '{}') returns jsonb language sql stable security invoker set search_path=public as $$
 with candidates as (select c.*,case when entity_id is not null then get_entity(entity_id) else jsonb_build_object('display_name',private_display_name,'entity_type','person','location',coalesce(private_details->>'location',''),'roles',jsonb_build_array(coalesce(private_details->>'role','')),'organisation',coalesce(private_details->>'organisation',''),'organisation_type','','genres',to_jsonb(string_to_array(coalesce(private_details->>'genres',''),';')),'emotions','[]'::jsonb,'aliases','[]'::jsonb,'email',coalesce(private_email,''),'submission_status','unknown','submission_type','','verification_status','unverified') end as e from user_contacts c where not archived
 and (coalesce(filters->>'relationship','')='' or relationship_status=filters->>'relationship')
 and (coalesce(filters->>'outreach','')='' or outreach_status=filters->>'outreach')
 and (coalesce(filters->>'priority','')='' or priority=filters->>'priority')
 and (coalesce(filters->>'list','')='' or exists(select 1 from list_members m where m.user_contact_id=c.id and m.list_id::text=filters->>'list'))
 and (coalesce(filters->>'followUp','')='' or (filters->>'followUp'='overdue' and follow_up_at<(now() at time zone 'Europe/London')::date) or (filters->>'followUp'='today' and follow_up_at=(now() at time zone 'Europe/London')::date) or (filters->>'followUp'='upcoming' and follow_up_at>(now() at time zone 'Europe/London')::date))
 ), filtered as (select * from candidates where
 (coalesce(filters->>'q','')='' or coalesce(e->>'display_name',private_display_name,'') ilike '%'||(filters->>'q')||'%' or coalesce(e->>'organisation','') ilike '%'||(filters->>'q')||'%' or exists(select 1 from jsonb_array_elements_text(coalesce(e->'aliases','[]')) a where a ilike '%'||(filters->>'q')||'%'))
 and (coalesce(jsonb_array_length(filters->'types'),0)=0 or e->>'entity_type' in(select jsonb_array_elements_text(filters->'types')))
 and (coalesce(jsonb_array_length(filters->'roles'),0)=0 or e->'roles' ?| array(select jsonb_array_elements_text(filters->'roles')))
 and (coalesce(jsonb_array_length(filters->'locations'),0)=0 or e->>'location' in(select jsonb_array_elements_text(filters->'locations')))
 and (coalesce(jsonb_array_length(filters->'genres'),0)=0 or e->'genres' ?| array(select jsonb_array_elements_text(filters->'genres')))
 and (coalesce(jsonb_array_length(filters->'emotions'),0)=0 or e->'emotions' ?| array(select jsonb_array_elements_text(filters->'emotions')))
 and (coalesce(jsonb_array_length(filters->'organisationTypes'),0)=0 or e->>'organisation_type' in(select jsonb_array_elements_text(filters->'organisationTypes')))
 and (not coalesce((filters->>'email')::boolean,false) or coalesce(nullif(private_email,''),e->>'email','')<>'')
 and (not coalesce((filters->>'verified')::boolean,false) or e->>'verification_status'='verified')
 and (coalesce(filters->>'submission','')='' or e->>'submission_status'=filters->>'submission')
 and (coalesce(filters->>'submissionType','')='' or e->>'submission_type'=filters->>'submissionType')
 and not exists(select 1 from jsonb_array_elements_text(coalesce(filters->'exclude','[]')) x where e->'roles' ? x or e->'genres' ? x or e->'emotions' ? x or e->>'location'=x or e->>'entity_type'=x or e->>'organisation_type'=x)
 ), page as (select (to_jsonb(f)-'e')||jsonb_build_object('entity',case when entity_id is not null then e else null end) doc from filtered f order by case when filters->>'sort'='recent' then created_at end desc,coalesce(e->>'display_name',private_display_name),id limit 12 offset (greatest(1,least(10000,coalesce((filters->>'page')::integer,1)))-1)*12)
 select jsonb_build_object('items',coalesce((select jsonb_agg(doc) from page),'[]'),'total',(select count(*) from filtered));
$$;
revoke all on function network_contacts(jsonb) from public;
grant execute on function network_contacts(jsonb) to authenticated;
