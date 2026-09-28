-- Submission type and effective status must match the same channel.
create or replace function public.discover_entities(filters jsonb default '{}') returns jsonb language sql stable security invoker set search_path=public as $$
 with selected as (
 select e.* from entities e where e.visibility='public' and e.archived_at is null
 and (coalesce(filters->>'q','')='' or e.display_name ilike '%'||(filters->>'q')||'%' or exists(select 1 from entity_aliases a where a.entity_id=e.id and a.normalised_alias ilike '%'||lower(filters->>'q')||'%') or exists(select 1 from entity_roles er join entities org on org.id=er.organisation_id where er.entity_id=e.id and org.display_name ilike '%'||(filters->>'q')||'%'))
 and (coalesce(jsonb_array_length(filters->'types'),0)=0 or e.entity_type in (select jsonb_array_elements_text(filters->'types')))
 and (coalesce(jsonb_array_length(filters->'roles'),0)=0 or exists(select 1 from entity_roles er join roles r on r.id=er.role_id where er.entity_id=e.id and er.is_current and r.name in (select jsonb_array_elements_text(filters->'roles'))))
 and (coalesce(jsonb_array_length(filters->'organisationTypes'),0)=0 or exists(select 1 from organisations o join organisation_types t on t.id=o.organisation_type_id where o.entity_id=e.id and t.name in(select jsonb_array_elements_text(filters->'organisationTypes'))))
 and (coalesce(jsonb_array_length(filters->'locations'),0)=0 or exists(select 1 from locations l where (l.id=e.primary_location_id or exists(select 1 from entity_locations el where el.entity_id=e.id and el.location_id=l.id)) and l.city in(select jsonb_array_elements_text(filters->'locations'))))
 and (coalesce(jsonb_array_length(filters->'genres'),0)=0 or exists(select 1 from entity_genres eg join genres g on g.id=eg.genre_id where eg.entity_id=e.id and (g.name in(select jsonb_array_elements_text(filters->'genres')) or g.parent_genre_id in(select id from genres where name in(select jsonb_array_elements_text(filters->'genres'))))))
 and (coalesce(jsonb_array_length(filters->'emotions'),0)=0 or exists(select 1 from entity_emotions em join emotions m on m.id=em.emotion_id where em.entity_id=e.id and m.name in(select jsonb_array_elements_text(filters->'emotions'))))
 and (not coalesce((filters->>'email')::boolean,false) or exists(select 1 from entity_contact_methods c where c.entity_id=e.id and c.contact_type='email' and c.is_public))
 and (not coalesce((filters->>'verified')::boolean,false) or e.verification_status='verified')
 and ((coalesce(filters->>'submission','')='' and coalesce(filters->>'submissionType','')='') or exists(select 1 from submission_channels s where s.entity_id=e.id and (coalesce(filters->>'submissionType','')='' or s.submission_type=filters->>'submissionType') and (coalesce(filters->>'submission','')='' or (case when s.status='open' and ((s.opens_at is not null and s.opens_at>now()) or (s.closes_at is not null and s.closes_at<now())) then 'closed' else s.status end)=filters->>'submission')))
 ), projected as (select id,display_name,created_at,entity_document(selected) doc from selected), excluded as (
 select * from projected where not exists(select 1 from jsonb_array_elements_text(coalesce(filters->'exclude','[]')) x where doc->'roles' ? x or doc->'genres' ? x or doc->'emotions' ? x or doc->>'location'=x or doc->>'entity_type'=x or doc->>'organisation_type'=x)
 ), page as (select doc from excluded order by case when filters->>'sort'='recent' then created_at end desc,display_name,id limit 12 offset (greatest(1,least(10000,coalesce((filters->>'page')::integer,1)))-1)*12)
 select jsonb_build_object('items',coalesce((select jsonb_agg(doc) from page),'[]'),'total',(select count(*) from excluded));
$$;
