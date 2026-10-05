create function public.admin_workspace_records(selected_workspace_id uuid,section text,page_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare projection text; table_name text; ordering text:='id'; rows jsonb; total bigint;begin
 if not public.is_admin() then raise insufficient_privilege using message='Administrator access required';end if;
 if page_offset<0 or page_offset>100000 then raise check_violation using message='Invalid page';end if;
 if not exists(select 1 from public.workspaces where id=selected_workspace_id) then raise no_data_found using message='Workspace not found';end if;
 -- Identifiers/projections are constants, never caller-supplied SQL.
 case section
 when 'contacts' then table_name:='user_contacts';projection:='id,workspace_id,entity_id,private_display_name,private_email,relationship_status,outreach_status,priority,relationship_origin,first_contacted_at,last_contacted_at,follow_up_at,archived,created_at,updated_at';
 when 'notes' then table_name:='notes';projection:='id,workspace_id,user_contact_id,body,pinned,created_at,updated_at';
 when 'lists' then table_name:='lists';projection:='id,workspace_id,name,created_at';
 when 'list_members' then table_name:='list_members';projection:='workspace_id,list_id,user_contact_id';ordering:='list_id,user_contact_id';
 when 'saved_views' then table_name:='saved_views';projection:='id,workspace_id,name,filter_definition,sort_definition,visible_columns,created_at';
 when 'interactions' then table_name:='interactions';projection:='id,workspace_id,user_contact_id,type,title,occurred_at,created_at';
 when 'email_metadata' then table_name:='sent_emails';projection:='id,workspace_id,user_contact_id,recipient,subject,sent_at';
 when 'calendar_events' then table_name:='calendar_events';projection:='id,workspace_id,title,event_type,start_date,end_date,starts_at,ends_at,all_day,timezone,location_name,address,venue_entity_id,contact_id,artist_entity_id,promoter,load_in_at,soundcheck_at,doors_at,stage_at,fee,ticket_url,notes,created_at,updated_at';
 when 'equipment' then table_name:='calendar_event_items';projection:='id,workspace_id,event_id,label,quantity,completed,sort_order,created_at,updated_at';
 when 'gmail_status' then
 select coalesce(jsonb_agg(row),'[]') into rows from (
 select m.user_id,(g.user_id is not null) connected,g.email,g.updated_at
 from public.workspace_members m left join public.gmail_connections g on g.user_id=m.user_id
 where m.workspace_id=selected_workspace_id order by m.user_id limit 50 offset page_offset) row;
 select count(*) into total from public.workspace_members where workspace_id=selected_workspace_id;
 else raise check_violation using message='Unsupported support section';
 end case;
 if table_name is not null then
 execute format('select coalesce(jsonb_agg(row),''[]'') from (select %s from public.%I where workspace_id=$1 order by %s limit 50 offset $2) row',projection,table_name,ordering) into rows using selected_workspace_id,page_offset;
 execute format('select count(*) from public.%I where workspace_id=$1',table_name) into total using selected_workspace_id;
 end if;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata)
 values(auth.uid(),'support.read','workspace',selected_workspace_id::text,jsonb_build_object('section',section,'offset',page_offset));
 return jsonb_build_object('items',rows,'total',total);
end $$;
revoke all on function public.admin_workspace_records(uuid,text,integer) from public,anon;
grant execute on function public.admin_workspace_records(uuid,text,integer) to authenticated;
