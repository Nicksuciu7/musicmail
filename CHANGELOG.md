# Changelog

## [0.9.1] — 2026-09-29 — UX simplification

### Changed

- Search-first Explore with four primary filters and secondary controls behind More filters.
- Compact Views menu, three music tags per result with overflow counts, and explicit network actions.
- Quieter Network table; genre columns available through Columns and bulk actions shown only on selection.
- Contact, relationship, follow-up and notes first; metadata, history and editing controls in disclosures.
- Templates under Mail; grouped Home and Settings content, flat Lists and Templates layouts.
- Shorter copy, restrained colors/borders, mobile layouts and a smaller default onboarding genre selection.
- Existing routes, schema, privacy boundaries, CSV, lists, notes and outreach functionality preserved.

### Fixed

- Completed optional platform dependency entries in the lockfile so npm 10 can install in GitHub CI.

### Verification

- Added a browser regression journey for progressive disclosure and the core discovery-to-email-preview flow.
- Existing automated checks retained; see docs/verification.md for results and limitations.

### Known limitations

- Fictional local demo; live Supabase and Gmail acceptance and production deployment remain pending.

## [0.9.0] — 2026-09-28 — Local beta

### Added

- Canonical shared music entities, subtype tables, relationships, taxonomies, provenance and submission channels.
- Supabase Auth integration, private artist onboarding and explicit isolated synthetic demo mode.
- Explore, server-side filters and pagination, private contacts, notes, statuses, priorities and follow-ups.
- Lists, saved views, column preferences, CSV mapping/validation/import and portable exports.
- Email templates, individual personalised previews, Gmail OAuth, encrypted tokens, send reservations and history.
- Home attention screen, internal shared-data maintenance, confirmed duplicate merges and data controls.
- Strict TypeScript, unit/component tests, real PostgreSQL RLS integration tests, Playwright journeys and accessibility checks.
- Architecture documentation, screenshots, CI and deployment instructions.

### Security

- Owner policies and composite foreign keys isolate private data; token tables are server-only.
- Same-origin mutation checks, protected OAuth state/PKCE, AES-GCM token encryption and send replay guards.
- Suppression and rate limits, no automatic retry on uncertain delivery, CSV formula neutralisation.

### Known limitations

- UX simplification is planned before v1.0.0.

- Local beta only. Live Supabase/Gmail acceptance and production deployment are pending.
- Synthetic records are not a verified industry dataset. See `docs/release-checklist.md`.

## 0.1.0 — 2026-09-28

### Added

- Architecture review, table list, ER diagram, route map, privacy plan and implementation sequence.
- Next.js / React / strict TypeScript / Tailwind project foundation.
