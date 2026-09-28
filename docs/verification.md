# Local verification — 28 September 2026

Environment: macOS, Node.js 25.2.1, Next.js 16.3.6, PostgreSQL 14.18. The hosted Supabase config targets PostgreSQL 17; its actual runtime remains a staging check.

| Check                                          | Result                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Strict TypeScript / Next route generation      | Pass                                                                                  |
| ESLint                                         | Pass, no warnings                                                                     |
| Vitest / React Testing Library                 | 24 tests pass                                                                         |
| PostgreSQL migration and RLS integration suite | Pass; all 13 migrations, seed applied twice                                           |
| Large private export                           | 1,106 contacts retained; initial summary limited to 50 recent records in that fixture |
| Send controls                                  | Suppression, unique attempts, hourly limit and atomic metadata checks pass            |
| Browser journeys                               | 5 Playwright tests pass in development and production builds                          |
| Automated accessibility                        | No WCAG A/AA violations reported on Explore, public detail drawer and mobile Explore  |
| Production compilation                         | Pass                                                                                  |
| Dependency audit                               | 0 reported vulnerabilities                                                            |
| Product screenshots                            | Five synthetic screenshots captured without browser runtime errors                    |

The browser suite covers artist setup, music filtering, adding a contact, private notes, relationship changes, template personalisation/preview, CSV import, list assignment, saved views, data export, CSRF rejection, session isolation, mobile layout and on-demand access to contacts outside the initial summary.

SQL tests use real PostgreSQL roles and RLS with a minimal Supabase Auth identity shim. Gmail tests mock the provider. Neither verifies live Google consent, token refresh/revocation against Google, Supabase GoTrue, Vercel runtime configuration or a deployed application.

No external emails were sent and no hosted deployment was made. Those gates remain in [release-checklist.md](release-checklist.md).
