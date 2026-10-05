#!/usr/bin/env bash
set -euo pipefail
DB_TEST_DIR=$(mktemp -d /tmp/musicmail-pg.XXXXXX)
DB_TEST_PORT=55439
cleanup() { pg_ctl -D "$DB_TEST_DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DB_TEST_DIR"; }
trap cleanup EXIT
initdb -D "$DB_TEST_DIR/data" -A trust --no-locale >/dev/null
pg_ctl -D "$DB_TEST_DIR/data" -l "$DB_TEST_DIR/log" -o "-p $DB_TEST_PORT -k $DB_TEST_DIR -h 127.0.0.1" start >/dev/null
export PGHOST="$DB_TEST_DIR" PGPORT="$DB_TEST_PORT" PGDATABASE=postgres
psql -v ON_ERROR_STOP=1 -q <<'SQL'
create role authenticated nologin;
create role anon nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,public to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
-- Model permissive hosted defaults: the final migration must revoke them.
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
SQL
for migration in supabase/migrations/*.sql; do
  if [[ "$migration" == *202609290014_workspace_ownership.sql ]]; then
    psql -v ON_ERROR_STOP=1 -q -f tests/workspace-upgrade-before.sql
  fi
  psql -v ON_ERROR_STOP=1 -q -f "$migration"
  if [[ "$migration" == *202609290014_workspace_ownership.sql ]]; then
    psql -v ON_ERROR_STOP=1 -q -f tests/workspace-upgrade-after.sql
  fi
done
psql -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
psql -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
psql -v ON_ERROR_STOP=1 -q -f tests/rls.sql
psql -v ON_ERROR_STOP=1 -q -f tests/workspace-rls.sql
psql -v ON_ERROR_STOP=1 -q -f tests/recovery-grants.sql
psql -v ON_ERROR_STOP=1 -q -f tests/calendar-rls.sql
printf 'Database migrations, repeatable seed and RLS integration checks passed.\n'
