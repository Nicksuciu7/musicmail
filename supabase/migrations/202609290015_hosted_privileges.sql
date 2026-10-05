-- Hosted Supabase defaults also grant non-DML privileges. RLS does not protect
-- TRUNCATE; authenticated users must never receive it, even on shared tables.
revoke all on all tables in schema public from public,anon;
revoke truncate,references,trigger on all tables in schema public from authenticated;
-- New migrations must explicitly grant their API surface, rather than inherit
-- broad privileges from the migration owner's defaults.
alter default privileges in schema public revoke all on tables from public,anon,authenticated;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
