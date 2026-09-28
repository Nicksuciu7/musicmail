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
grant usage on schema auth,public to authenticated,service_role;
grant execute on function auth.uid() to authenticated,service_role;
SQL
for migration in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -f "$migration"; done
psql -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
psql -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
psql -v ON_ERROR_STOP=1 -q -f tests/rls.sql
printf 'Database migrations, repeatable seed and RLS integration checks passed.\n'
