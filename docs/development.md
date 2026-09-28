# Development

## Local demonstration

Use Node 22.12+ with npm. Install with `npm ci`, copy `.env.example` to `.env.local`, then `npm run dev`. Open http://localhost:3000. Use `MUSICMAIL_DEMO=true` only for synthetic local demonstration. Browser sessions are independent; closing a tab does not delete its data. Settings → Delete data resets that demo workspace.

The demo uses no Supabase or Gmail credentials. `.data/demo` contains local workspace files, excluded from Git. Remove those files only if you intend to clear demo sessions. No real contact data should be placed in fixtures.

## Local Supabase

Install the Supabase CLI and a Docker-compatible runtime using [Supabase's local workflow](https://supabase.com/docs/guides/local-development/cli-workflows). Then:

```bash
supabase start
supabase status
```

The checked-in config loads migrations and the synthetic seed. Copy the local API URL, public key and service key from the CLI into `.env.local` yourself, set `MUSICMAIL_DEMO=false`, and restart Next.js. Do not paste keys into chat or commit them.

Email/password signup uses Supabase Auth. Use the local mail viewer to confirm development emails. Google login requires its own Supabase provider configuration. Gmail sending is configured independently as described in [deployment.md](deployment.md).

`supabase db reset` recreates **local** development data from migrations and seed. It is destructive to local database contents. Do not use a remote reset flag on an existing hosted project. Add migrations for future changes.

## Standalone database tests

The SQL integration suite needs local `initdb`, `pg_ctl` and `psql`, but no Docker or Supabase account:

```bash
npm run test:db
```

It creates an isolated temporary cluster on port 55439, shims Supabase auth identity, tests real RLS with different PostgreSQL roles, and removes the cluster on exit. It never reads the app's production database URL. Do not run PostgreSQL initdb as root. On Linux, ensure PostgreSQL binaries are in PATH.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

Playwright starts the demo server automatically if port 3000 is free. If reusing an existing server, it must be configured for demo mode. Stop a development server before building in the same checkout to avoid Next.js cache races. Tests use isolated browser contexts; `.data` remains ignored.

Formatting: `npm run format`. Regenerate SQL seed from the typed synthetic fixtures using `npx tsx scripts/generate-seed.ts`. Unit tests cover music filters, CSV, validation, templates, encryption and Gmail request behavior. Component tests cover accessible dialog dismissal and duplicate-add controls. Browser tests cover the core journey and mobile layout.

## Code map

`src/lib/domain.ts` contains DTOs, validated actions and pure helpers. `src/lib/server` owns authentication, repositories, demo persistence, encryption and Gmail. API routes validate requests and call services. `src/components` contains the workspace screens and shared interactions. `supabase/migrations` is authoritative for persistence and access policy.

The local beta deliberately uses a small number of straightforward services rather than a speculative framework. The workspace bootstrap is bounded; contact details load on demand. Directory, network and mail queries paginate on the server. Full exports and duplicate validation use complete owner-scoped data separately.
