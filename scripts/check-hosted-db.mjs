// Read-only hosted schema/grant checks. Never emit the database URI or credentials.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import assert from "node:assert/strict";
const url = new URL(process.env.SUPABASE_DB_URL);
function query(sql) {
  const result = spawnSync(
    "psql",
    ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
    {
      env: {
        ...process.env,
        PGHOST: url.hostname,
        PGPORT: url.port || "5432",
        PGDATABASE: url.pathname.slice(1),
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGSSLMODE: "require",
        PGCONNECT_TIMEOUT: "15",
      },
      input: sql,
      encoding: "utf8",
      timeout: 60000,
    },
  );
  if (result.status !== 0)
    throw new Error(
      "Hosted database read-only check failed; connection/query details suppressed.",
    );
  return result.stdout.trim();
}
const versions = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .map((f) => f.split("_")[0])
  .sort();
const installed = query(
  "select version from supabase_migrations.schema_migrations order by version;",
).split("\n");
assert.deepEqual(
  installed,
  versions,
  "Hosted migration ledger differs from repository",
);
assert.equal(
  query(
    "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;",
  ),
  "0",
  "A public table has RLS disabled",
);
const privateTables =
  "'profiles','user_preferences','workspaces','workspace_members','user_contacts','notes','interactions','lists','list_members','saved_views','email_templates','sent_emails','gmail_connections','email_send_attempts','request_buckets','recovery_grants','admin_users','calendar_events','calendar_event_items'";
assert.equal(
  query(
    "select (has_schema_privilege('anon','public','create') or has_schema_privilege('authenticated','public','create'))::text;",
  ),
  "false",
  "Untrusted public-schema creation grant",
);
assert.equal(
  query(
    `select count(*) from information_schema.role_table_grants where table_schema='public' and table_name in (${privateTables}) and grantee in ('anon','PUBLIC');`,
  ),
  "0",
  "Anonymous private-table grants",
);
assert.equal(
  query(
    "select count(*) from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES');",
  ),
  "0",
  "Unsafe authenticated privileges",
);
assert.equal(
  query(
    "select count(*) from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and table_name in ('gmail_connections','email_send_attempts','request_buckets','recovery_grants');",
  ),
  "0",
  "Server-only tables exposed",
);
assert.equal(
  query(
    "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('reserve_email','record_sent','consume_request_limit','consume_recovery_grant') and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'));",
  ),
  "0",
  "Privileged RPC exposed",
);
assert.equal(
  query(
    "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.proname in ('is_admin','can_read_entity','is_workspace_member','reserve_email','record_sent','consume_request_limit','consume_recovery_grant','complete_onboarding','admin_save_entity','merge_entities','import_contacts') and not exists(select 1 from unnest(p.proconfig) setting where setting like 'search_path=%');",
  ),
  "0",
  "Security definer search path missing",
);
console.log(
  `Hosted database: ${versions.length} migrations match; all public tables use RLS; anonymous/private, schema creation, unsafe grants, server-only tables and privileged RPC/search-path checks passed (8 checks). Read-only.`,
);
