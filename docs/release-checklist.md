# Release status — 0.9.0 local beta

This is a local beta, not a completed production V1. The user selected “Build locally; document hosted setup”. No hosted credentials were supplied or required for the local demonstration.

| Area                                | Local verification                                                         | Hosted gate                                      |
| ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| Artist onboarding                   | Browser journey and canonical SQL transaction tested                       | Real signup, confirmation and provider callbacks |
| Explore / music filters             | Unit, SQL and browser tests                                                | Real catalogue quality and realistic latency     |
| Network / private contacts / notes  | Browser and two-user RLS tests                                             | Real Supabase API isolation                      |
| Relationship / outreach / follow-up | Validation, SQL history, UI interactions                                   | Timezone/operator acceptance                     |
| Saved views / lists                 | Browser and SQL ownership checks                                           | User acceptance                                  |
| CSV import / export                 | Quoted CSV, mapping, validation, duplicate warnings, browser import/export | Real Supabase concurrency and export acceptance  |
| Gmail OAuth / refresh / disconnect  | Implemented; encryption, state design and token boundary reviewed          | Live consenting test account and Google review   |
| Individual and small-batch sends    | Mocked provider tests, database reservation/success tests, browser preview | Real sends, refresh, revoke and failure recovery |
| Templates / history                 | Merge helpers, default template SQL, browser previews                      | Real send timeline                               |
| RLS / privacy                       | Real PostgreSQL tests with two users and admin                             | Supabase deployment configuration and backups    |
| Admin                               | Restricted implementation; merge and subtype integrity SQL tests           | Trusted operator review and catalogue workflow   |
| Responsive / accessibility          | Desktop/mobile browser checks and automated WCAG A/AA checks               | Manual assistive-technology review               |
| Production deployment               | Configuration and instructions supplied                                    | Not deployed                                     |
| Portfolio README                    | Architecture, screenshots, setup and limitations included                  | Add real demo URL after deployment               |

## Known limitations

- No real industry database has been collected. The 18 representative entities are clearly labelled synthetic and unverified.
- Workspace summaries and result pages are bounded; explicit account exports are complete. Staging should still measure realistic multi-user concurrency and large note histories.
- Admin is intentionally utilitarian and uses JSON for detailed entity edits; it is not a public contribution/moderation workflow.
- Location entry currently resolves known taxonomy cities. Unrecognised free-text onboarding cities do not create new public locations automatically; add the location through a trusted catalogue maintenance process.
- No automatic inbox sync, reply detection, delivery/read analytics or scheduled sending.
- No external error monitoring account is configured. Safe structured events are emitted for database/OAuth/send failures.
- Real authentication, OAuth provider behavior and production deployment cannot be certified by a local demo or mocked API tests.
- Legal, consent-screen, retention, backup, incident-response and catalogue provenance reviews remain operator responsibilities.

Version 1.0.0 and a production release should be created only when these gates pass. Do not infer live readiness from the existence of integration code.
