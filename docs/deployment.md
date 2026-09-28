# Hosted setup

The requested deliverable for this session is local development plus hosted setup documentation. No remote repository, Supabase project, OAuth client or Vercel deployment was created or assumed.

## 1. Supabase

Create separate staging and production projects in the appropriate region. Use the Supabase CLI to link the intended project and apply the checked-in migrations:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Confirm the linked project before running commands. Do not reset a hosted database. Production migrations should run through a reviewed deployment process. See [Supabase environment management](https://supabase.com/docs/guides/deployment/managing-environments).

Load taxonomy data and then verified industry records. `supabase/seed.sql` includes fictional entities and is suitable for development/staging demonstrations, not an unlabelled production catalogue. Keep provenance and verification dates accurate.

Enable email/password authentication and configure email confirmation and a production mail provider. If using Google sign-in, enable the Google provider in Supabase, register the Supabase callback URI shown by its dashboard, and configure provider credentials there. Set Supabase Auth Site URL to the app's HTTPS origin and allow the exact `/auth/callback` URL for each deployed environment. Avoid wildcard production redirects.

To provision an internal administrator, add the intended existing Auth user UUID to `public.admin_users` through a trusted server/SQL operator session. Do not expose this action in the app. Administrator access controls shared records, not other users' private CRM data.

## 2. Google Gmail OAuth

Use a Google Cloud project with Gmail API enabled and a web application OAuth client. Configure branding, support contacts, privacy policy and consent-screen audience. Test with explicitly allowed test users before requesting any required Google verification.

Register this exact authorised redirect URI for the app's domain:

```text
https://YOUR_DOMAIN/api/gmail/callback
```

For local development, register `http://localhost:3000/api/gmail/callback` separately. Do not put localhost into production application configuration. Gmail requests only `openid email` and `gmail.send`. Login and send consent are distinct even if the same Cloud project is used.

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_ENCRYPTION_KEY` on the server. Generate the key with:

```bash
openssl rand -base64 32
```

Keep that value secret and backed up separately. Do not rotate it without a token re-encryption/reconnection plan. Follow [Google's web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) and review [the implementation's security notes](email-security.md).

## 3. GitHub

This repository is already initialised on `main`. Inspect `git remote -v` before adding a destination. Create a private or public repository named `musicmail` or `greenroom-musicmail` under the intended account. Add its URL only if there is no existing remote; never overwrite another destination.

Before pushing, inspect `git status`, staged diffs and tracked files for secrets, `.env.local`, private datasets and browser artifacts. `.env.example` must contain placeholders only. Push meaningful commits and annotated milestone tags after review. The CI workflow runs local checks without production secrets.

No licence has been imposed automatically; choose a licence deliberately before inviting third-party reuse.

## 4. Vercel

Import the intended GitHub repository using the Next.js preset. `vercel.json` supplies the build/install commands and London region preference. Set environment variables for each deployment environment:

```text
MUSICMAIL_DEMO=false
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APP_ENCRYPTION_KEY=...
```

The public Supabase key is designed for a browser client; the service-role key and encryption key must remain server-only. Review [Vercel framework environment variables](https://vercel.com/docs/environment-variables/framework-environment-variables). Do not deploy the filesystem demo adapter on Vercel; its storage is not durable there.

The Gmail route declares a 300-second maximum duration. Confirm that the chosen hosting plan supports the intended duration and Google quota. Slow or interrupted batches leave durable attempt records and are not blindly retried. Configure provider/runtime error monitoring around the safe structured event categories; the local build does not include a hosted Sentry account.

## 5. Staging acceptance

Use two test users to exercise signup, email confirmation, Google login, artist setup and RLS through the real Supabase API. Connect a consenting test Gmail account, send only to controlled recipients, verify sender identity and metadata, force an expired access token to exercise refresh, disconnect/revoke, and test an ambiguous failure without resend.

Test exports with more than 1,000 records, account deletion, backup retention, admin merges, responsive UI and realistic search latency. Complete [release-checklist.md](release-checklist.md). Only then deploy production, attach real screenshots/demo link, create the annotated v1.0.0 tag and publish its GitHub release.
