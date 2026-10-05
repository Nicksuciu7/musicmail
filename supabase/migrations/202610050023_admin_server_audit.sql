-- Include trusted database/service maintenance as system audit entries.
-- current_setting(role) retains the invoking PostgREST role inside a definer
-- trigger; current_user would incorrectly identify every caller as the owner.
-- Ordinary member-owned private artist creation still is not an admin action.
create or replace function public.audit_admin_change() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare before_row jsonb; after_row jsonb; changed jsonb; target text;begin
 before_row:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 after_row:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 if tg_op='UPDATE' and before_row=after_row then return new;end if;
 if tg_table_name<>'user_roles' and not public.is_admin() and coalesce(current_setting('role',true),'none') in ('authenticated','anon') then return coalesce(new,old);end if;
 -- Provisioning a default member is not a privileged action.
 if tg_table_name='user_roles' and tg_op='INSERT' and after_row->>'role'='member' then return new;end if;
 select coalesce(jsonb_agg(k order by k),'[]') into changed from
 (select jsonb_object_keys(before_row||after_row) k) fields where before_row->k is distinct from after_row->k;
 target:=coalesce(after_row->>'id',before_row->>'id',after_row->>'user_id',before_row->>'user_id',after_row->>'entity_id',before_row->>'entity_id');
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata)
 values(auth.uid(),lower(tg_op),tg_table_name,target,jsonb_build_object('fields',changed)
 ||case when tg_table_name='user_roles' then jsonb_build_object('previous_role',before_row->>'role','role',after_row->>'role') else '{}'::jsonb end);
 return coalesce(new,old);
end $$;
