-- Account preferences remain separate from the canonical artist project.
create or replace function public.workspace_document() returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
 'profile',(select to_jsonb(p)-'id' from profiles p where p.id=auth.uid()),
 'artistName',coalesce((select e.display_name from user_preferences p join entities e on e.id=p.primary_artist_entity_id where p.user_id=auth.uid()),'Your artist project'),
 'artist', (select jsonb_build_object('id',e.id,'name',e.display_name,'type',a.artist_type,'location',coalesce(l.city,''),'genres',coalesce((select jsonb_agg(g.name) from entity_genres eg join genres g on g.id=eg.genre_id where eg.entity_id=e.id),'[]'),'emotions',coalesce((select jsonb_agg(m.name) from entity_emotions em join emotions m on m.id=em.emotion_id where em.entity_id=e.id),'[]')) from user_preferences p join entities e on e.id=p.primary_artist_entity_id join artist_projects a on a.entity_id=e.id left join locations l on l.id=e.primary_location_id where p.user_id=auth.uid()),
 'onboarded',coalesce((select onboarding_completed from user_preferences where user_id=auth.uid()),false),
 'goals',coalesce((select goals from user_preferences where user_id=auth.uid()),'[]'),
 'isAdmin',is_admin(),
 'contacts',coalesce((select jsonb_agg((to_jsonb(c)-'user_id')||jsonb_build_object('entity',case when e.id is not null then entity_document(e) else null end) order by c.created_at desc) from user_contacts c left join entities e on e.id=c.entity_id),'[]'),
 'notes',coalesce((select jsonb_agg(to_jsonb(n)-'user_id' order by created_at desc) from notes n),'[]'),
 'interactions',coalesce((select jsonb_agg(to_jsonb(i)-'user_id' order by occurred_at desc) from interactions i),'[]'),
 'lists',coalesce((select jsonb_agg(to_jsonb(l)-'user_id') from lists l),'[]'),
 'members',coalesce((select jsonb_agg(to_jsonb(m)-'user_id') from list_members m),'[]'),
 'views',coalesce((select jsonb_agg(to_jsonb(v)-'user_id') from saved_views v),'[]'),
 'templates',coalesce((select jsonb_agg(to_jsonb(t)-'user_id') from email_templates t),'[]'),
 'sent',coalesce((select jsonb_agg(to_jsonb(s)-'user_id' order by sent_at desc) from sent_emails s),'[]'));
$$;
revoke all on function workspace_document() from public;
grant execute on function workspace_document() to authenticated;

create or replace function public.workspace_summary(contact_ids uuid[] default '{}') returns jsonb language sql stable security invoker set search_path=public as $$
 with picked as (
 (select id from user_contacts where not archived order by created_at desc limit 50)
 union (select id from user_contacts where not archived and follow_up_at<=(now() at time zone coalesce((select timezone from profiles where id=auth.uid()),'Europe/London'))::date order by follow_up_at limit 50)
 union (select id from user_contacts where not archived and follow_up_at>(now() at time zone coalesce((select timezone from profiles where id=auth.uid()),'Europe/London'))::date order by follow_up_at limit 50)
 union (select id from user_contacts where id=any(contact_ids))
 )
 select jsonb_build_object(
 'contactCount',(select count(*) from user_contacts where not archived),
 'networkEntityIds',coalesce((select jsonb_agg(entity_id) from user_contacts where entity_id is not null and not archived),'[]'),
 'profile',(select to_jsonb(p)-'id' from profiles p where p.id=auth.uid()),
 'artistName',coalesce((select e.display_name from user_preferences p join entities e on e.id=p.primary_artist_entity_id where p.user_id=auth.uid()),'Your artist project'),
 'artist', (select jsonb_build_object('id',e.id,'name',e.display_name,'type',a.artist_type,'location',coalesce(l.city,''),'genres',coalesce((select jsonb_agg(g.name) from entity_genres eg join genres g on g.id=eg.genre_id where eg.entity_id=e.id),'[]'),'emotions',coalesce((select jsonb_agg(m.name) from entity_emotions em join emotions m on m.id=em.emotion_id where em.entity_id=e.id),'[]')) from user_preferences p join entities e on e.id=p.primary_artist_entity_id join artist_projects a on a.entity_id=e.id left join locations l on l.id=e.primary_location_id where p.user_id=auth.uid()),
 'onboarded',coalesce((select onboarding_completed from user_preferences where user_id=auth.uid()),false),
 'goals',coalesce((select goals from user_preferences where user_id=auth.uid()),'[]'),
 'isAdmin',is_admin(),
 'contacts',coalesce((select jsonb_agg((to_jsonb(c)-'user_id')||jsonb_build_object('entity',case when e.id is not null then entity_document(e) else null end) order by c.created_at desc) from user_contacts c left join entities e on e.id=c.entity_id where c.id in(select id from picked)),'[]'),
 'notes',coalesce((select jsonb_agg(to_jsonb(n)-'user_id' order by created_at desc) from notes n where user_contact_id=any(contact_ids)),'[]'),
 'interactions',coalesce((select jsonb_agg(to_jsonb(i)-'user_id' order by occurred_at desc) from (select * from interactions where user_contact_id=any(contact_ids) order by occurred_at desc limit 100) i),'[]'),
 'lists',coalesce((select jsonb_agg((to_jsonb(l)-'user_id')||jsonb_build_object('member_count',(select count(*) from list_members where list_id=l.id))) from lists l),'[]'),
 'members',coalesce((select jsonb_agg(to_jsonb(m)-'user_id') from list_members m where user_contact_id in(select id from picked)),'[]'),
 'views',coalesce((select jsonb_agg(to_jsonb(v)-'user_id') from saved_views v),'[]'),
 'templates',coalesce((select jsonb_agg(to_jsonb(t)-'user_id') from email_templates t),'[]'),
 'sent',coalesce((select jsonb_agg(to_jsonb(s)-'user_id' order by sent_at desc) from (select * from sent_emails order by sent_at desc limit 20) s),'[]'));
$$;
revoke all on function workspace_summary(uuid[]) from public;
grant execute on function workspace_summary(uuid[]) to authenticated;

create or replace function public.complete_onboarding(project_name text, project_type text, city_name text, genre_names text[], emotion_names text[], user_goals jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare eid uuid; lid uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(trim(project_name)) not between 1 and 200 or project_type not in ('solo','band','duo','collective','producer_project','dj_project','other') then raise exception 'Invalid artist'; end if;
 select primary_artist_entity_id into eid from user_preferences where user_id=auth.uid();
 select id into lid from locations where city=city_name limit 1;
 if eid is null then
 insert into entities(entity_type,display_name,visibility,created_by,primary_location_id) values('artist_project',trim(project_name),'private',auth.uid(),lid) returning id into eid;
 insert into artist_projects(entity_id,artist_type) values(eid,project_type);
 else
 if not exists(select 1 from entities where id=eid and created_by=auth.uid()) then raise exception 'Invalid owner'; end if;
 update entities set display_name=trim(project_name),primary_location_id=lid,updated_at=now() where id=eid;
 update artist_projects set artist_type=project_type where entity_id=eid;
 delete from entity_genres where entity_id=eid; delete from entity_emotions where entity_id=eid;
 end if;
 insert into entity_genres select eid,id from genres where name=any(genre_names);
 insert into entity_emotions select eid,id from emotions where name=any(emotion_names);
 insert into profiles(id,display_name) values(auth.uid(),project_name) on conflict(id) do nothing;
 insert into user_preferences(user_id,primary_artist_entity_id,goals,onboarding_completed) values(auth.uid(),eid,user_goals,true) on conflict(user_id) do update set goals=excluded.goals,onboarding_completed=true;
 return eid; end $$;
revoke all on function complete_onboarding(text,text,text,text[],text[],jsonb) from public;
grant execute on function complete_onboarding(text,text,text,text[],text[],jsonb) to authenticated;

create or replace function public.network_contacts(filters jsonb default '{}') returns jsonb language sql stable security invoker set search_path=public as $$
 with candidates as (select c.*,case when entity_id is not null then get_entity(entity_id) else jsonb_build_object('display_name',private_display_name,'entity_type','person','location',coalesce(private_details->>'location',''),'roles',jsonb_build_array(coalesce(private_details->>'role','')),'organisation',coalesce(private_details->>'organisation',''),'organisation_type','','genres',to_jsonb(string_to_array(coalesce(private_details->>'genres',''),';')),'emotions','[]'::jsonb,'aliases','[]'::jsonb,'email',coalesce(private_email,''),'submission_status','unknown','submission_type','','verification_status','unverified') end as e from user_contacts c where not archived
 and (coalesce(filters->>'relationship','')='' or relationship_status=filters->>'relationship')
 and (coalesce(filters->>'outreach','')='' or outreach_status=filters->>'outreach')
 and (coalesce(filters->>'priority','')='' or priority=filters->>'priority')
 and (coalesce(filters->>'list','')='' or exists(select 1 from list_members m where m.user_contact_id=c.id and m.list_id::text=filters->>'list'))
 and (coalesce(filters->>'followUp','')='' or (filters->>'followUp'='overdue' and follow_up_at<(now() at time zone coalesce((select timezone from profiles where id=auth.uid()),'Europe/London'))::date) or (filters->>'followUp'='today' and follow_up_at=(now() at time zone coalesce((select timezone from profiles where id=auth.uid()),'Europe/London'))::date) or (filters->>'followUp'='upcoming' and follow_up_at>(now() at time zone coalesce((select timezone from profiles where id=auth.uid()),'Europe/London'))::date))
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
