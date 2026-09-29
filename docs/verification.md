# v0.9.1 verification — 29 September 2026

Environment: macOS, Node.js 25.2.1, Next.js 16.3.6, PostgreSQL 14.18. The hosted Supabase config targets PostgreSQL 17; its actual runtime remains a staging check.

| Check                                          | Result                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Strict TypeScript / Next route generation      | Pass                                                                                  |
| ESLint                                         | Pass, no warnings                                                                     |
| Vitest / React Testing Library                 | 24 tests pass                                                                         |
| PostgreSQL migration and RLS integration suite | Pass; all 13 migrations, seed applied twice                                           |
| Large private export                           | 1,106 contacts retained; initial summary limited to 50 recent records in that fixture |
| Send controls                                  | Suppression, unique attempts, hourly limit and atomic metadata checks pass            |
| Browser journeys                               | 6 Playwright tests pass in development and production builds                          |
| Automated accessibility                        | No WCAG A/AA violations reported on Explore, public detail drawer and mobile Explore  |
| Production compilation                         | Pass                                                                                  |
| Dependency audit                               | 0 reported vulnerabilities                                                            |
| Product screenshots                            | Twelve synthetic screenshots captured without browser runtime errors                  |

The browser suite covers artist setup, music filtering, adding a contact, private notes, relationship changes, template personalisation/preview, CSV import, list assignment, saved views, data export, CSRF rejection, session isolation, mobile layout and on-demand access to contacts outside the initial summary.

SQL tests use real PostgreSQL roles and RLS with a minimal Supabase Auth identity shim. Gmail tests mock the provider. Neither verifies live Google consent, token refresh/revocation against Google, Supabase GoTrue, Vercel runtime configuration or a deployed application.

No external emails were sent and no hosted deployment was made. Those gates remain in [release-checklist.md](release-checklist.md).

Repository preparation reran `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run test:db` and `npm audit`. All passed with the results above. GitHub repository details and the release procedure are in [publishing.md](publishing.md).

The v0.9.1 pass preserves the original five browser tests (selectors updated for moved controls) and adds a progressive-disclosure journey covering filters, keyboard expansion, column restoration, notes, follow-ups, bulk preview and Mail/Templates navigation. Typecheck, lint, 24 unit tests, all 13 migrations/RLS checks, production build and audit were rerun. The browser suite also passes against the production build. npm 10 clean-install validation (`npx --yes npm@10 ci --dry-run --ignore-scripts`) passes after repairing optional platform dependency entries in the lockfile.

The changed-file secret-pattern scan found no matches. No schema, API or server-service files changed. See [the UX review](ux-simplification.md) for before/after observations and the incomplete native Safari walkthrough; it was replaced by the passing automated browser flow, not reported as a successful manual test.
