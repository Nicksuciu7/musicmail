# Workspace calendar

Calendar is unreleased work towards v1, available on `feature/calendar-dark-mode`. The published version remains 0.9.1. The production application has not been replaced by this feature branch.

## Experience

Primary navigation has one Calendar entry. Upcoming is the default, grouping events by day; Month is a compact Monday-start, six-row view. Upcoming shows a clearly bounded year with previous/next range navigation. Both views page 100 events at a time with Load more, rather than silently losing large collections. A date in Month starts an event for that day. Home shows at most three next events and their load-in times.

Only Title and Date are required. Types are Gig, Rehearsal, Recording, Meeting, Travel and Other. Times, location and notes are optional. Blank times make a date-only event; a timed event defaults to one hour when end time is absent. More options contains the time zone and an optional end date. All-day end dates are inclusive in the form and exclusive in storage/export.

Gig details disclose address, free-text promoter/contact, load-in, soundcheck, doors, stage, fee and ticket URL. Gig timings use the event's starting date and original zone. For after-midnight stage times on a different date, put the dated timing in Notes; there is no multi-day gig-timing scheduler. Fee is deliberately free text, allowing currency and agreements without an accounting subsystem.

What to bring accepts arbitrary labels, optional integer quantities and checked states. Up to 100 items can be entered per save; order follows the list. Checks persist immediately, with optimistic feedback and rollback on a failed write. Editing preserves item IDs, creation timestamps and checked states; removing an item deletes it on save. No equipment catalogue is created.

Location remains free text. More options can search existing shared MusicMail venues, link a loaded private network contact, or link the current artist project. These links are optional. Typed text never creates or publishes a canonical entity. Venue linking does not depend on an external geocoding service. Contact options come from the workspace's loaded contact summary; an existing older contact link is retained during edits.

## Storage and ownership

Migration `202610050019_calendar.sql` adds `calendar_events` and `calendar_event_items`. Each has a required workspace ID and nullable `user_id` creator/actor audit field. The audit identity grants no access. Existing personal workspace provisioning, membership and deletion semantics apply; no band invitation UI is added.

Timed events store PostgreSQL `timestamptz` UTC instants and the original IANA zone. Date-only events store calendar dates without fabricated midnight timestamps. UI dates/times use the account profile's zone (Europe/London default). Queries use viewer-zone UTC bounds for timed events and date bounds for all-day events, including overlapping multi-day events.

Temporal validates dates and converts local times. Nonexistent spring times are rejected. Repeated autumn times require an explicit first/second occurrence choice in More options; editing preserves the selected occurrence. A selected occurrence never silently shifts a nonexistent spring time. Calendar ranges are bounded to 366 days; dates are bounded to 1900–2200.

Indexes cover workspace/date, timed starts, checklist parent/order and nullable entity/contact references. Table checks reject empty/oversize titles/items, invalid event types, quantities, reversed intervals and inconsistent local dates. The database validates zone names independently.

## Security

Both tables enable membership RLS for authenticated SELECT/INSERT/UPDATE/DELETE, using `is_workspace_member(workspace_id)`. Anonymous/PUBLIC grants and authenticated TRUNCATE/TRIGGER/REFERENCES are revoked. The existing workspace trigger fixes actor attribution and blocks workspace/actor changes. The event trigger also prevents ID changes.

The composite `(workspace_id,event_id)` FK makes a cross-workspace checklist attachment impossible. A composite `(workspace_id,contact_id)` FK enforces contact isolation; the single contact FK clears an optional contact link on deletion while preserving the calendar event. Venue links must reference readable, active public venue entities. Artist links must match the caller's existing primary project. Triggers validate new/changed links through caller RLS, while retaining history when a previously linked venue is later archived.

`save_calendar_event` is a security-invoker RPC. It locks the owned event and updates event/checklist atomically. Actor/workspace IDs in the JSON payload are ignored. Checklist IDs from another event are rejected, and a failed item write rolls back the entire edit. Current application routes select the personal workspace explicitly; future workspace selection can use this same membership model without changing the tables. Full account export includes all RLS-permitted calendar rows, with explicit paging beyond Supabase's default 1,000-row cap.

Every API requires verified identity, exact-origin checks for mutations, Zod validation, body bounds and existing shared server rate limits. ICS reads require identity and ownership; responses are private/no-store. No service key, provider credential or token reaches the client.

Deleting an event cascades its items. Deleting a sole-member account/workspace cascades private events/items; a shared canonical venue survives. Existing shared-workspace last-owner restrictions remain unchanged. Full JSON export uses an explicit calendar/item field allowlist; it includes no external-provider secrets. Export format version is 2; CSV remains the CRM contact format.

## External calendar copies

The detail drawer offers Google Calendar and Apple / Outlook (.ics). Google opens a prefilled event creation URL with encoded title, UTC times or all-day dates, zone, location and details. It requests no OAuth access. Details are limited to 2,000 characters in the URL, with a visible explanation for longer records; ICS includes full details. The user must save the event in Google's interface.

ICS follows [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545): stable event UUID UID, UTC timed DTSTART/DTEND, DATE values with exclusive all-day DTEND, CRLF lines, escaped text and folding at 75 UTF-8 octets without splitting characters. It includes notes, gig timings and checklist details. An independent `ical.js` parser verifies dates, content, Unicode, escaping and injection resistance in unit tests. This validates standards compliance; importing into every native Apple/Outlook application is not claimed as a live acceptance test.

The `CalendarExportProvider` boundary lives in `src/lib/calendar-export.ts`. MusicMail remains the source of truth. Exports are copies; edits do not synchronise automatically. Future selected-event Google Calendar or iCloud adapters require separate, explicit account consent and provider credentials. Gmail scopes are untouched. Two-way sync, recurrence, resources and collaboration are outside this pass.

## Demo and verification

Local demo sessions include fictional Lantern Room and Eastside Rehearsal events, anchored to the current date. Existing demo files are safely backfilled without changing CRM data. No real personal data or sends are added.

See [calendar/appearance acceptance](calendar-theme-acceptance.md) for exact checks and screenshots. SQL role tests cover A/B CRUD, parent/contact integrity, actor immutability, atomic rollback, anonymous denial, membership revocation and deletion. The hosted isolation suite exercises real Supabase user JWTs in both directions. Browser tests cover the full desktop/mobile musician journey, export, sessions, Home and Month.
