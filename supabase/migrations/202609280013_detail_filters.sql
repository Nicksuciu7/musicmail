-- Expose public contact channels and last-contact filters without private leakage.
create or replace function public.entity_document(e entities) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('id',e.id,'entity_type',e.entity_type,'display_name',e.display_name,'description',coalesce(e.description,''),'location',coalesce((select city from locations where id=e.primary_location_id),''),
 'roles',coalesce((select jsonb_agg(r.name) from entity_roles er join roles r on r.id=er.role_id where er.entity_id=e.id and er.is_current),'[]'),
 'organisation',coalesce((select x.display_name from entity_roles er join entities x on x.id=er.organisation_id where er.entity_id=e.id and er.is_current limit 1),''),
 'organisation_type',coalesce((select t.name from organisations o join organisation_types t on t.id=o.organisation_type_id where o.entity_id=e.id),''),
 'genres',coalesce((select jsonb_agg(g.name) from entity_genres eg join genres g on g.id=eg.genre_id where eg.entity_id=e.id),'[]'),
 'emotions',coalesce((select jsonb_agg(m.name) from entity_emotions em join emotions m on m.id=em.emotion_id where em.entity_id=e.id),'[]'),
 'email',coalesce((select value from entity_contact_methods where entity_id=e.id and contact_type='email' and is_public order by is_primary desc limit 1),''),
 'contact_methods',coalesce((select jsonb_agg(jsonb_build_object('id',id,'contact_type',contact_type,'value',value,'label',label,'purpose',purpose)) from entity_contact_methods where entity_id=e.id and is_public),'[]'),
 'website',coalesce((select value from entity_contact_methods where entity_id=e.id and contact_type='website' and is_public limit 1),''),
 'verification_status',e.verification_status,
 'submission_status',coalesce((select case when status='open' and ((opens_at is not null and opens_at>now()) or (closes_at is not null and closes_at<now())) then 'closed' else status end from submission_channels where entity_id=e.id limit 1),'unknown'),
 'submission_type',coalesce((select submission_type from submission_channels where entity_id=e.id limit 1),''),
 'submission_instructions',coalesce((select instructions from submission_channels where entity_id=e.id limit 1),''),
 'aliases',coalesce((select jsonb_agg(alias) from entity_aliases where entity_id=e.id),'[]'),
 'source',coalesce((select source_name from entity_sources where entity_id=e.id limit 1),''),
 'source_url',coalesce((select source_url from entity_sources where entity_id=e.id limit 1),''),
 'verified_at',(select verified_at from entity_sources where entity_id=e.id limit 1),
 'capacity',(select capacity_max from venues where entity_id=e.id));
$$;

create or replace function public.network_contacts(filters jsonb default '{}') returns jsonb language sql stable security invoker set search_path=public as $$
 with candidates as (select c.*,case when entity_id is not null then get_entity(entity_id) else jsonb_build_object('display_name',private_display_name,'entity_type','person','location',coalesce(private_details->>'location',''),'roles',jsonb_build_array(coalesce(private_details->>'role','')),'organisation',coalesce(private_details->>'organisation',''),'organisation_type','','genres',to_jsonb(string_to_array(coalesce(private_details->>'genres',''),';')),'emotions','[]'::jsonb,'aliases','[]'::jsonb,'email',coalesce(private_email,''),'submission_status','unknown','submission_type','','verification_status','unverified') end as e from user_contacts c where not archived
 and (coalesce(filters->>'relationship','')='' or relationship_status=filters->>'relationship')
 and (coalesce(filters->>'outreach','')='' or outreach_status=filters->>'outreach')
 and (coalesce(filters->>'lastContact','')='' or (filters->>'lastContact'='never' and last_contacted_at is null) or (filters->>'lastContact'='recent' and last_contacted_at>=now()-interval '30 days') or (filters->>'lastContact'='older' and last_contacted_at<now()-interval '30 days'))
 and (coalesce(filters->>'priority','')='' or priority=filters->>'priority')
 and (coalesce(filters->>'list','')='' or exists(select 1 from list_members m where m.user_contact_id=c.id and m.list_id::text=filters->>'list'))
 and (coalesce(filters->>'followUp','')='' or (filters->>'followUp'='overdue' and follow_up_at<(now() at time zone coalesce((select timezone from profiles where id=auth.uid()),'Europe/London'))::date) or (filters->>'followUp'='today' and follow_up_at=(now() at time zone coalesce((select timezone from profiles where id=auth.uid()),'Europe/London'))::date) or (filters->>'followUp'='upcoming' and follow_up_at>(now() at time zone coalesce((select timezone from profiles where id=auth.uid()),'Europe/London'))::date))
 ), filtered as (select * from candidates where
 (coalesce(filters->>'q','')='' or coalesce(e->>'display_name',private_display_name,'') ilike '%'||(filters->>'q')||'%' or coalesce(e->>'organisation','') ilike '%'||(filters->>'q')||'%' or exists(select 1 from jsonb_array_elements_text(coalesce(e->'aliases','[]')) a where a ilike '%'||(filters->>'q')||'%'))
 and (coalesce(jsonb_array_length(filters->'types'),0)=0 or e->>'entity_type' in(select jsonb_array_elements_text(filters->'types')))
 and (coalesce(jsonb_array_length(filters->'roles'),0)=0 or e->'roles' ?| array(select jsonb_array_elements_text(filters->'roles')))
 and (coalesce(jsonb_array_length(filters->'locations'),0)=0 or e->>'location' in(select jsonb_array_elements_text(filters->'locations')))
 and (coalesce(jsonb_array_length(filters->'genres'),0)=0 or e->'genres' ?| array(select jsonb_array_elements_text(filters->'genres') union select name from genres where parent_genre_id in(select id from genres where name in(select jsonb_array_elements_text(filters->'genres')))))
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
