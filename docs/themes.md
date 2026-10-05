# Appearance

Settings → Appearance offers System (default), Light and Dark. Appearance belongs to the person, never their workspace.

Migration `202610050020_appearance.sql` adds a constrained `profiles.theme` column. Verified accounts save through the normal server/RLS client; no admin key is used. Their stored preference wins on initial rendering, so another account in the same browser receives its own mode. Anonymous auth pages retain the last device preference through a non-secret, HttpOnly/SameSite=Lax cookie (Secure on HTTPS), lasting a year. Local demo uses the same cookie; a fresh browser defaults to System. No localStorage credentials or theme boot script are used.

The async root layout reads the preference before rendering `html[data-theme]`. System is a CSS `prefers-color-scheme` rule, so the correct palette appears with the first stylesheet and responds to OS changes immediately, even without JavaScript. Manual modes override that media rule. The client provider starts with the identical server preference; there is no deliberate hydration mismatch or suppressed hydration warning. Changing a mode gives immediate feedback, disables controls while saving, and restores the previous mode if persistence fails.

Both palettes use semantic tokens in `globals.css`: background, surface, muted surface, foreground, muted text, border, accent/on-accent, soft green, danger and focus. Dark uses deep green-grey surfaces and restrained pale sage accents. Native inputs respect `color-scheme`; neither palette uses colour inversion. Existing literal colour styles were removed from React components.

The audit covers Home, Explore/filter/table/loading states, network, calendar/Month/forms/detail/checklist, lists, mail/composer/recipient picker, templates, settings, auth/recovery pages, cards, drawers, badges, hover/focus, destructive/disabled states and toast colours. Shared admin UI inherits the same tokens; live privileged admin interactions are not included in browser acceptance. Focus stays visible, controls retain semantic labels, and status includes text/checks rather than colour alone.

Automated axe WCAG A/AA checks run against both palettes on the main routes, Calendar creation/detail, contact drawer and mail recipient picker. Desktop/mobile calendar flows also run axe. OS System switching, manual overrides, persistence, server-rendered theme attributes and hydration errors are checked. These automated checks do not claim a full screen-reader or human accessibility certification. See [acceptance](calendar-theme-acceptance.md).
