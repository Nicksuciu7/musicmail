# Administrator candidate acceptance — 2026-10-05

Historical feature checkpoint. The combined candidate was deployed and passed **1,202 production administrator assertions** on October 12; see [current deployment and provider gates](google-gmail-acceptance.md).

Implemented on **feature/admin-security**, based on the completed foundation/Calendar/appearance checkpoint. Version remains **0.9.1**. Main and release tags are unchanged; the new application UI is not deployed to production.

## Delivered

- Hosted migrations **021–023**: preserve existing administrators, backfill/provision ordinary members, trusted role changes, future AAL2 policy, narrow audited support reads and immutable canonical/role/system-maintenance audit evidence. All 23 repository/hosted ledger entries match.
- Dedicated `/admin` layout and page with verified Auth/database authorization. Every existing/new admin API uses the reusable server guard and shared rate limits. Member/demo pages return 404 and APIs 403; unauthenticated APIs return 401.
- Paginated users, account status/memberships/roles, workspaces/member IDs/private counts, private contact/status/follow-up/list/note/view/history/calendar/equipment support, email metadata and token-free Gmail connection status.
- Explicitly confirmed role changes, existing canonical save/related-record/taxonomy maintenance, confirmed archives/deletes/merges and an audit viewer. Private support records are read-only. Administrative user suspension/deletion and impersonation are not added; normal recent-auth self-deletion/export remain available.
- Ordinary membership RLS and workspace foreign keys are preserved. Privileged support reads use explicit guarded database functions; administrators do not acquire blanket private-table access.
- No permanent/bootstrap admin credential or real-account promotion. [Exact verified-UUID promotion procedure](admin.md#promote-your-existing-account-safely), route/model/security details and operating instructions are documented.

## Verified

| Check                                                  | Result                                                                                                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                    | Passed                                                                                                                                                                                                     |
| `npm run lint`                                         | Passed without warnings                                                                                                                                                                                    |
| `npm test`                                             | **155 tests in 10 files** passed; 18 new server guard/route/request checks                                                                                                                                 |
| `npm run build`                                        | Next.js 16.3.6 production build passed                                                                                                                                                                     |
| `MUSICMAIL_E2E_PRODUCTION=true npm run test:e2e`       | **14 Chromium tests** passed against the optimized local build, including new demo admin-page/API denial                                                                                                   |
| `npm run test:db`                                      | All **23 migrations**, repeatable seed, every existing regression, role upgrade preservation, **95 admin assertions** and **61 Calendar assertions** passed with real PostgreSQL permissions/RLS           |
| `npm run check:hosted-db`                              | **10 read-only checks** passed; 23 migration versions match, all public tables have RLS, no unsafe/anonymous private grants or role/audit direct writes                                                    |
| `npm run test:hosted:isolation`                        | **157 A/B assertions** passed in both directions after all three admin migrations, including shared canonical identity and separate private overlays; disposable accounts/data removed                     |
| `npm run test:hosted:admin`                            | **1,117 assertions** passed on the local non-demo production build and real Supabase Auth/DB; count includes recursive response-field omission checks and varies with the paginated audit sample           |
| `npm run test:hosted:auth`                             | Existing **90 assertions** passed after the final audit migration: Auth/CRM/Calendar, complete 1,002-event export, themes, recovery/change, recent-auth deletion and cleanup                               |
| `npm run check:dependencies`                           | Runtime/production audit **0 findings**; full audit **5 high development-only findings**, the existing exact reviewed braces exception; no new dependencies or forced downgrade                            |
| `MUSICMAIL_SCAN_PRODUCTION=true npm run check:secrets` | Repository/history and **18 local browser assets + 10 existing production assets** passed known-value/provider-pattern/private-env checks; the production assets belong to the earlier deployed foundation |

The hosted admin acceptance uses two members and one temporary administrator with ordinary verified Auth sessions. Editable metadata claiming admin is ignored. Both members fail page/API/role-table/audit access tests and retain private isolation. The administrator can read every intended support category, manage canonical taxonomy and make audited role changes. Concurrent mutual demotions leave exactly one fixture administrator and reject the other operation. Later revocation immediately denies an existing session. Payloads omit Auth/Gmail credentials; cookies remain HttpOnly/Lax. Light, dark and mobile admin screens have **zero automated WCAG A/AA violations** and no mobile overflow.

Fixture credentials are generated randomly in memory. Tests send no email, never promote real customers and delete account/business fixtures in `finally`. Safe immutable audit entries intentionally remain. The local Auth harness verifies the optional AAL1/AAL2 authorization policy; live MFA enrollment is not claimed.

Browser testing caught and fixed demo-page cookie mutation during server rendering. Live UI acceptance caught and fixed an ambiguous select label. Both existing and new checks pass; no isolation assertion was weakened or removed. Legacy fixture names were updated for `user_roles`, and the existing non-admin API denial now explicitly expects 403.

## Screenshots

Reviewed screenshots show only disposable fictional workspace records, no real customer details or credentials:

- [Administrator support in Light](screenshots/admin-support-light.png)
- [Administrator support in Dark](screenshots/admin-support-dark.png)

## Remaining v1 blockers

Turnstile production activation; Gmail production OAuth setup and controlled live consent/send/refresh/disconnect; review/deployment of the combined feature candidate; and final production acceptance/security checks. Google identity sign-in and MFA remain optional. SMTP delivery and real confirmation/recovery success retain their earlier verified evidence.

The administrator feature does not authorize a `1.0.0` version bump, tag, main release push or GitHub release. No new manual secret/configuration request is needed to complete the code feature; the project owner can use the documented trusted UUID operation to promote their own verified account.
