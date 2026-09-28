alter table saved_views add column scope text not null default 'explore' check(scope in ('explore','network'));
create function public.workspace_document() returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
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
create function public.seed_user_templates() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into email_templates(user_id,name,category,subject,body) values
 (new.user_id,'A first introduction','Promoter introduction','{{artist_name}} — a little introduction',E'Hi {{first_name}},\n\nI’m reaching out from {{artist_name}}. I love what you’re building at {{organisation}} and thought our music might be a good fit.\n\n[Add a personal connection and one listening link.]\n\nWould you be open to a conversation?\n\nThanks for listening,\n{{artist_name}}'),
 (new.user_id,'A gentle follow-up','Follow-up','Following up — {{artist_name}}',E'Hi {{first_name}},\n\nJust following up on my last note. I know things get busy, so no pressure at all.\n\n[Add a useful update or a specific question.]\n\nAll the best,\n{{artist_name}}'),
 (new.user_id,'A record for your ears','Label demo','New music from {{artist_name}}',E'Hi {{first_name}},\n\nI’m sharing a new release from {{artist_name}} for consideration at {{organisation}}.\n\n[Add one private listening link and a short description of the music.]\n\nThank you for your time,\n{{artist_name}}'),
 (new.user_id,'Share a stage','Support slot','Support slot enquiry — {{artist_name}}',E'Hi {{first_name}},\n\nI’m reaching out from {{artist_name}} about supporting an upcoming show at {{organisation}}.\n\n[Explain the musical fit, availability and include a live video link.]\n\nThanks,\n{{artist_name}}'),
 (new.user_id,'A room for our music','Venue booking','Booking enquiry — {{artist_name}}',E'Hi {{first_name}},\n\nWe’d love to bring {{artist_name}} to {{organisation}}.\n\n[Suggest dates, share one live video and describe your local audience honestly.]\n\nBest wishes,\n{{artist_name}}'),
 (new.user_id,'See you in the field','Festival application','Festival consideration — {{artist_name}}',E'Hi {{first_name}},\n\nPlease consider {{artist_name}} for {{organisation}}.\n\n[Follow the published submission guidance and include one listening link.]\n\nThank you,\n{{artist_name}}'),
 (new.user_id,'A story to share','Press pitch','New release — {{artist_name}}',E'Hi {{first_name}},\n\nI thought the story behind our next release might interest you at {{organisation}}.\n\n[Add the release date, story and a private listening link.]\n\nAll the best,\n{{artist_name}}'),
 (new.user_id,'Something for the airwaves','Radio submission','For your show — {{artist_name}}',E'Hi {{first_name}},\n\nHere’s a new track from {{artist_name}} for consideration at {{organisation}}.\n\n[Add a listening link, release date and clean-version details where relevant.]\n\nThanks for listening,\n{{artist_name}}');
 return new;end $$;
create trigger user_templates after insert on user_preferences for each row execute function seed_user_templates();
