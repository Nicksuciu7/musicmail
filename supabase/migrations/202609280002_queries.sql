-- Invoker functions preserve table RLS; result projection does not grant extra visibility.
create function public.entity_document(e entities) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('id',e.id,'entity_type',e.entity_type,'display_name',e.display_name,'description',coalesce(e.description,''),'location',coalesce((select city from locations where id=e.primary_location_id),''),
 'roles',coalesce((select jsonb_agg(r.name) from entity_roles er join roles r on r.id=er.role_id where er.entity_id=e.id and er.is_current),'[]'),
 'organisation',coalesce((select x.display_name from entity_roles er join entities x on x.id=er.organisation_id where er.entity_id=e.id and er.is_current limit 1),''),
 'organisation_type',coalesce((select t.name from organisations o join organisation_types t on t.id=o.organisation_type_id where o.entity_id=e.id),''),
 'genres',coalesce((select jsonb_agg(g.name) from entity_genres eg join genres g on g.id=eg.genre_id where eg.entity_id=e.id),'[]'),
 'emotions',coalesce((select jsonb_agg(m.name) from entity_emotions em join emotions m on m.id=em.emotion_id where em.entity_id=e.id),'[]'),
 'email',coalesce((select value from entity_contact_methods where entity_id=e.id and contact_type='email' and is_public order by is_primary desc limit 1),''),
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
create function public.discover_entities(filters jsonb default '{}') returns jsonb language sql stable security invoker set search_path=public as $$
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
 and (coalesce(filters->>'submission','')='' or exists(select 1 from submission_channels s where s.entity_id=e.id and s.status=filters->>'submission' and (s.status<>'open' or ((s.opens_at is null or s.opens_at<=now()) and (s.closes_at is null or s.closes_at>=now())))))
 and (coalesce(filters->>'submissionType','')='' or exists(select 1 from submission_channels s where s.entity_id=e.id and s.submission_type=filters->>'submissionType'))
 ), projected as (select id,display_name,created_at,entity_document(selected) doc from selected), excluded as (
 select * from projected where not exists(select 1 from jsonb_array_elements_text(coalesce(filters->'exclude','[]')) x where doc->'roles' ? x or doc->'genres' ? x or doc->'emotions' ? x or doc->>'location'=x or doc->>'entity_type'=x or doc->>'organisation_type'=x)
 ), page as (select doc from excluded order by case when filters->>'sort'='recent' then created_at end desc,display_name,id limit 12 offset (greatest(1,least(10000,coalesce((filters->>'page')::integer,1)))-1)*12)
 select jsonb_build_object('items',coalesce((select jsonb_agg(doc) from page),'[]'),'total',(select count(*) from excluded));
$$;
create function public.get_entity(eid uuid) returns jsonb language sql stable security invoker set search_path=public as $$ select entity_document(e) from entities e where id=eid $$;
revoke all on function discover_entities(jsonb),get_entity(uuid),entity_document(entities) from public;
grant execute on function discover_entities(jsonb),get_entity(uuid),entity_document(entities) to authenticated,service_role;

create function public.reserve_email(attempt_id uuid, owner_id uuid, contact_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 if not exists(select 1 from user_contacts where id=contact_id and user_id=owner_id and not archived and outreach_status<>'do_not_contact') then raise exception 'Contact unavailable or suppressed'; end if;
 if (select count(*) from email_send_attempts where user_id=owner_id and created_at>now()-interval '1 hour')>=30 then raise exception 'Hourly sending limit reached'; end if;
 insert into email_send_attempts(id,user_id,user_contact_id) values(attempt_id,owner_id,contact_id);
 end $$;
create function public.record_sent(attempt_id uuid,owner_id uuid,contact_id uuid,message_id text,to_email text,message_subject text,message_body text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not exists(select 1 from email_send_attempts where id=attempt_id and user_id=owner_id and user_contact_id=contact_id and status='reserved' for update) then raise exception 'Invalid send attempt'; end if;
 insert into sent_emails(user_id,user_contact_id,gmail_message_id,recipient,subject,body) values(owner_id,contact_id,message_id,to_email,message_subject,message_body);
 insert into interactions(user_id,user_contact_id,type,title) values(owner_id,contact_id,'email_sent',message_subject);
 update user_contacts set first_contacted_at=coalesce(first_contacted_at,now()),last_contacted_at=now(),outreach_status=case when outreach_status in ('not_contacted','draft') then 'sent' else outreach_status end where user_id=owner_id and id=contact_id;
 update email_send_attempts set status='sent' where id=attempt_id;
 end $$;
revoke all on function reserve_email(uuid,uuid,uuid),record_sent(uuid,uuid,uuid,text,text,text,text) from public;
grant execute on function reserve_email(uuid,uuid,uuid),record_sent(uuid,uuid,uuid,text,text,text,text) to service_role;
