# Changelog

## 0.9.0 — 2026-09-28 — Local beta

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

- Local beta only. Live Supabase/Gmail acceptance and production deployment are pending.
- Synthetic records are not a verified industry dataset. See `docs/release-checklist.md`.

## 0.1.0 — 2026-09-28

### Added

- Architecture review, table list, ER diagram, route map, privacy plan and implementation sequence.
- Next.js / React / strict TypeScript / Tailwind project foundation.
