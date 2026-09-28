create function public.import_contacts(rows jsonb,confirm_duplicates boolean default false) returns integer language plpgsql security invoker set search_path=public as $$
declare r jsonb; cid uuid; n integer:=0; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>500 then raise exception 'Invalid import'; end if;
 for r in select * from jsonb_array_elements(rows) loop
 if length(trim(coalesce(r->>'name',''))) not between 1 and 200 then raise exception 'Name required'; end if;
 if not confirm_duplicates and exists(select 1 from user_contacts where user_id=auth.uid() and ((coalesce(r->>'email','')<>'' and lower(private_email)=lower(r->>'email')) or (lower(private_display_name)=lower(r->>'name') and lower(coalesce(private_details->>'organisation',''))=lower(coalesce(r->>'organisation',''))))) then raise exception 'Possible duplicate'; end if;
 insert into user_contacts(user_id,private_display_name,private_email,private_details,relationship_status) values(auth.uid(),r->>'name',r->>'email',jsonb_build_object('organisation',r->>'organisation','role',r->>'role','location',r->>'location','genres',r->>'genres'),coalesce(r->>'relationship','unknown')) returning id into cid;
 if coalesce(r->>'notes','')<>'' then insert into notes(user_id,user_contact_id,body) values(auth.uid(),cid,r->>'notes'); end if;
 n:=n+1; end loop; return n; end $$;
revoke all on function import_contacts(jsonb,boolean) from public;
grant execute on function import_contacts(jsonb,boolean) to authenticated;
