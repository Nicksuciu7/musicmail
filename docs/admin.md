# Administrator access

The pre-v1 administrator feature lives on `feature/admin-security`, based on the completed Calendar/appearance candidate. Version remains **0.9.1**. Database migrations **021–023** are installed on the existing Supabase project; the new application UI has not been deployed to production or merged into `main`.

Administrators use the ordinary verified Supabase email/password account and its existing password, recovery and session protections. There is no separate admin login, default password, public bootstrap account or email/domain rule. Disposable acceptance accounts use randomly generated credentials, are removed afterward and never appear in documentation as usable accounts.

## Roles and authorization

Migration 021 renames the existing trusted `admin_users` table to `user_roles`, preserving its administrators and backfilling all other Auth accounts as `member`. An Auth insertion trigger always provisions `member`, irrespective of editable user metadata. Fields are `user_id` (Auth UUID), `role` (`member`/`admin`) and `require_aal2` (default false).

Normal users can select their own role, but cannot insert, update or delete role rows. Administrators can read roles and change another account's role through `admin_change_role`; direct authenticated role writes remain forbidden. That function requires explicit confirmation, rejects changes to one's own role, serializes role changes, rechecks authorization after obtaining the lock and protects the last administrator. A trusted database/server operator remains the recovery/bootstrap path.

`requireAdmin()` verifies the authenticated, email-confirmed identity and calls database `is_admin()` on every request. Demo mode is rejected before any demo identity cookie is created. A role in a client state object, user metadata or email address grants nothing. `requireAdminPage()` protects both the `/admin` layout and page; absent sessions go to `/login`, members/demo receive 404. Every admin API uses `requireAdminRequest()`: absent/unverified session 401, verified non-admin 403, database errors fail closed. Revocation applies on subsequent requests using the same session; there is no role cache.

The normal HttpOnly/SameSite=Lax session cookie remains Secure on HTTPS. Mutations require the exact configured Origin and bounded, validated JSON. Admin reads allow 180 requests/minute per actor; mutations 60/minute through the existing server-side shared limiter. Support JSON is `private, no-store`; mutations are `no-store`. No service key or extra admin token is sent to the browser.

## Routes and supported actions

| Route                                                         | Purpose                                                                                                                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                                                      | Account/workspace support, role management, audit viewer and existing canonical editors                                                                                      |
| `GET /api/admin/support?view=users`                           | 50-account pages with UUID, email, display name, creation/verification/sign-in/ban timestamps, trusted role and workspace memberships; optional `userId` selects one account |
| `GET /api/admin/support?view=workspaces`                      | 50-workspace pages with UUID, name, creation time, member IDs/roles and private contact/note/list/event counts                                                               |
| `GET /api/admin/support?view=records&workspaceId=…&section=…` | Audited, read-only support records for the selected workspace                                                                                                                |
| `GET /api/admin/support?view=audit`                           | 50-entry pages of immutable administrative evidence                                                                                                                          |
| `POST /api/admin/roles`                                       | `{ userId, role, confirmed: true }`; another existing Auth account only                                                                                                      |
| `POST /api/admin`                                             | Validated canonical entity save, confirmed archive/merge and taxonomy maintenance                                                                                            |
| `GET /api/admin/entity?id=…`                                  | Existing canonical entity details                                                                                                                                            |
| `GET/POST /api/admin/records`                                 | Allowlisted related canonical/taxonomy records; deletion requires confirmation                                                                                               |

Support sections: `contacts` (including relationship/outreach/priority/follow-up), `notes`, `lists`, `list_members`, `saved_views`, `interactions`, `email_metadata`, `calendar_events`, `equipment` and `gmail_status`. Email metadata excludes message body and Gmail message ID. Gmail returns member ID, connected status, address and updated time only. Auth account views select safe individual fields; neither raw Auth objects nor password hashes, session/JWT tokens, provider credentials, encrypted Gmail tokens or keys are returned. Interaction support excludes arbitrary metadata. All private support functions require the real caller's database administrator state, enforce pagination and audit the read before returning it.

The interface supports pagination, workspace inspection and confirmed role changes. Existing canonical editing, related-record deletion and confirmed merges remain functional. It does not add administrative account suspension, user deletion, bulk destructive operations, impersonation or arbitrary SQL. Suspension would also need a tested strategy for existing JWT/RLS access; a UI-only ban would be insufficient. Users retain the existing recent-auth account deletion and private-data export flows.

## RLS and audit design

Existing workspace membership policies and composite ownership foreign keys are unchanged. Even an administrator's ordinary table query cannot read another workspace's private notes. Explicit `SECURITY DEFINER` support functions permit only the intended, audited reads, with pinned `pg_catalog,public` search paths and fixed projections/table names. Arbitrary table names, provider token storage and private mutations are unavailable. Shared canonical write policies continue to require `is_admin()`. Both members can read the same public entity while their CRM overlays stay separate.

`admin_audit_log` has `id`, `admin_user_id`, `action`, `target_type`, `target_id`, safe `metadata` and `created_at`. Actor/target UUIDs survive account deletion. Database triggers atomically capture role changes and canonical insert/update/delete, including direct database RPC mutations and trusted service/database maintenance. Metadata records changed **field names**, never row values; roles additionally record previous/new role. Support functions record `support.read`, category, workspace/selected user UUID and page offset. Ordinary users cannot read or mutate audit entries. Administrators can read, but neither authenticated users nor the service role can insert/update/delete/truncate the log directly. Trusted database owners manage retention outside the application.

A null actor means a trusted database/system operation, including first-admin bootstrap or Auth cleanup. Authenticated privileged actions have the actual actor UUID. Fixture cleanup leaves safe immutable audit evidence, without test passwords or email-link proofs.

For later MFA, `user_roles.require_aal2=true` requires a verified JWT `aal2` claim in the same `is_admin()` function, covering server guards, shared RLS and privileged RPCs. This follows [Supabase's database MFA enforcement pattern](https://supabase.com/docs/guides/database/postgres/row-level-security#mfa). AAL1/AAL2 policy tests pass; MFA enrollment/challenge UI and production MFA activation are not claimed. Do not enable this flag until enrollment and recovery are implemented and tested.

## Promote your existing account safely

1. Create/use your normal MusicMail account, verify its email and sign in with your own password. Do not create a second password for administration.
2. In Supabase project **thkrltiusxylpzqwfasx → Authentication → Users**, locate **your verified account** and copy its **User UID**. Check the email carefully. The UUID is an identifier; no secret is needed in chat.
3. Open **SQL Editor → New query** using your trusted project-owner account. Replace `REPLACE_WITH_YOUR_AUTH_USER_UUID` below with that exact UUID. Run the complete transaction once. It rejects nonexistent/unverified accounts and missing provisioned role rows.

```sql
begin;
do $$
declare target uuid := 'REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid;
begin
  if not exists (
    select 1 from auth.users
    where id = target and email_confirmed_at is not null
  ) then
    raise exception 'Choose an existing verified Auth account';
  end if;
  update public.user_roles set role = 'admin' where user_id = target;
  if not found then
    raise exception 'Provisioned account role not found';
  end if;
end $$;
commit;
```

4. Verify the saved value in SQL Editor with the same UUID:

```sql
select user_id, role, require_aal2
from public.user_roles
where user_id = 'REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid;

select action, target_type, target_id, metadata, created_at
from public.admin_audit_log
where target_type = 'user_roles'
  and target_id = 'REPLACE_WITH_YOUR_AUTH_USER_UUID'
order by created_at desc
limit 5;
```

Expected role is `admin`; the audit shows the trusted promotion. Refresh MusicMail and visit `/admin` in the new non-demo application candidate. The changed role takes effect on the next request; an ordinary second account must still receive 404/403. This procedure does not create an Auth account, set/reset a password or disable email verification/MFA. No real customer account has been automatically promoted by this feature work.

If removing the final administrator through trusted SQL, first designate and verify a replacement. The application cannot demote its own administrator; trusted database access is the explicit recovery path.

## Verification commands

Run the usual `typecheck`, `lint`, `test`, `build`, `test:e2e`, `test:db`, `check:dependencies` and `check:secrets` scripts. Local PostgreSQL tests include upgrade preservation and 95 new role/support/audit/AAL assertions, in addition to every existing regression/isolation assertion. The legacy fixtures were adapted to the renamed role store; no isolation expectation was relaxed.

For real Supabase testing, start the local production build with demo disabled, then run tests sequentially:

```bash
MUSICMAIL_DEMO=false npm run start
# In another terminal, using the private existing .env.local:
npm run check:hosted-db
npm run test:hosted:isolation
npm run test:hosted:admin
npm run test:hosted:auth
```

`test:hosted:admin` creates two members and a temporary administrator, uses actual Supabase Auth JWTs and browser sessions, tests privilege denial and intended cross-workspace reads, makes audited canonical/role changes, verifies concurrent demotion safety, revocation, safe payloads, cookies and light/dark/mobile accessibility, then removes all account/business fixtures. It sends no email and only promotes disposable fixtures. Run it against localhost, never by pasting a service key into the browser.

Turnstile production activation, Gmail production OAuth and live consent/send/refresh/disconnect, review/deployment of the combined candidate and final production acceptance remain release blockers. Completing administrator functionality does not authorize a v1 version bump, tag or release.

Current verification and screenshots: [administrator acceptance](admin-acceptance.md).

## Google data in support operations

Follow the public privacy notice and Google's Limited Use requirements. An audited administrator role does not authorize unrelated browsing of Google data. Human access needs the user's specific agreement or a permitted necessary security/legal purpose; keep credentials out of support records. [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy).
