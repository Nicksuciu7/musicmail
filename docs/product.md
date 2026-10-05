# Product

## Current v0.9.1 scope

The local beta serves independent solo artists, bands and small artist teams managing their own professional relationships. Demo data is fictional; hosted Supabase and live Gmail acceptance remain pending. The v0.9.1 simplification pass uses progressive disclosure without changing the underlying scope.

MusicMail helps an independent musician find relevant music-industry contacts, privately organise relationships and send thoughtful outreach. Its focus is the UK independent music community.

The directory is music-native: roles, organisation classifications, hierarchical genres, optional emotions, locations, public contact purposes and submission guidance. A search for London + Promoter + Indie Folk + Intimate produces representative matches immediately in the synthetic demo.

Onboarding requires only the artist project name. Location, genres, emotions, goals, import and Gmail are optional. A real Supabase signup uses email/password or Google; Gmail sending has a separate consent flow. Authentication is not simulated as a real signup in demo mode.

Explore contains shared information. My Network stores a user's private overlay, notes and interaction history. Relationships describe familiarity; outreach describes the current conversation. Neither is a sales pipeline. Do-not-contact blocks sends. Home surfaces attention rather than vanity metrics.

Lists are manual groups of private contacts; saved views retain filter state and screen scope. CSV imports stay private, accept up to 500 rows at a time, and require confirmation for possible duplicates. Exports include archived contacts and notes.

The visual design uses warm whites, restrained greens, clear typography, dense tables, side drawers and mobile list layouts. Empty states explain the next useful action. Keyboard focus, dialog semantics, textual status labels and contrast are checked.

V1 excludes inbox reading, reply detection, campaigns, tracking pixels, social feeds, opportunities, team invitation UI, recommendations and AI agents. Calendar is now part of the requested pre-v1 candidate. Future GreenRoom work should reference the existing canonical IDs.

## Unreleased Calendar and appearance

Calendar answers where to be, when and what to bring. Upcoming is primary; a Monday-start Month view is optional. Required fields stay Title and Date. Gig logistics and data links are disclosures, arbitrary equipment stays a checklist, and Home adds only three next events. Google Calendar/ICS exports make deliberate copies without requesting provider access. Calendar data belongs to the workspace and uses the same private membership controls as CRM. No shared entity is created from typed text.

Settings offers System/Light/Dark appearance as a personal preference, with deliberate palettes across the existing app. This pass adds no automatic sync, recurrence engine, band invitations or external dashboard configuration. See [Calendar](calendar.md) and [Appearance](themes.md).
