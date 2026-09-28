-- Bounded initial payload; full document remains reserved for explicit export.
create function public.workspace_summary(contact_ids uuid[] default '{}') returns jsonb language sql stable security invoker set search_path=public as $$
 with picked as (
 (select id from user_contacts where not archived order by created_at desc limit 50)
 union (select id from user_contacts where not archived and follow_up_at<=(now() at time zone 'Europe/London')::date order by follow_up_at limit 50)
 union (select id from user_contacts where not archived and follow_up_at>(now() at time zone 'Europe/London')::date order by follow_up_at limit 50)
 union (select id from user_contacts where id=any(contact_ids))
 )
 select jsonb_build_object(
 'contactCount',(select count(*) from user_contacts where not archived),
 'networkEntityIds',coalesce((select jsonb_agg(entity_id) from user_contacts where entity_id is not null and not archived),'[]'),
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
