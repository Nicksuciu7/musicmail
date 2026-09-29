# v0.9.1 UX simplification

## Audit and plan

Reviewed the running v0.9.0 Explore, Network, contact drawer, Home, Lists, Mail, Settings and onboarding screens before editing. Explore's promotional banner and six category tabs displaced search; organisation/submission filters duplicated secondary controls; result rows showed four tags and submission badges. The drawer placed metadata above relationship context and notes. Home and Settings used a card for nearly every group. Templates competed as a primary navigation item and saved views occupied the sidebar.

The implementation plan was to bring search/results forward, disclose secondary filters and views, prioritise relationship controls in the drawer, consolidate Templates under Mail, and replace decorative panels with flat groups. Architecture, schema, server actions and privacy boundaries were held fixed.

## Removed from default view

- Explore promotional banner, category shortcuts (their filters remain), separate submission column and extra tag badges.
- Organisation/submission/type/exclusion/email/verification filters; Network relationship, outreach, list, priority and date filters are under More filters.
- Genre table column by default. Existing saved column preferences are respected; Columns restores secondary fields.
- Drawer provenance, verification, full taxonomy, submissions and extra contact methods are under More details. History and Edit & organise are separate closed disclosures.
- Sidebar saved-view buttons, contact-count badge, repeated identity and decorative slogans.

## Consolidated

- Six primary destinations: Home, Explore, My Network, Lists, Mail and Settings. Templates is a Mail subview; the existing `/templates` URL remains valid.
- Saved views and Save view share a compact Views menu; Home has a saved-view selector.
- Genre/emotion metadata uses a shared Music column with at most three visible tags and a remaining count.
- Settings groups Account, Artist Profile, Email and Data. Logout stays under Account, deletion under Data with its existing confirmation.

## Preserved

All existing filters, saved views/column preferences, canonical entities, owner-scoped contacts, notes, follow-ups, priorities, lists, CSV preview/import/export, templates, email previews, admin tools and routes remain available. No migrations or service/API changes were made. No inbox or new product module was added. Bulk controls still appear only after selection.

## Improved

Names and roles lead each row. Explicit Add to My Network/In My Network labels replace the icon-only action. Neutral avatars, fewer borders, quiet inline status editors and flatter Home/List/Settings groups reduce competing visual signals. Contact email, relationship and notes now precede advanced detail. Mobile keeps search, contact identity and the main action visible without desktop table density. Onboarding keeps its existing steps and fields, reveals additional genres on demand and makes optional-step skipping explicit.

At a 1440×1050 viewport, the Explore table now begins around y=370 rather than y=680, bringing substantially more results into view. This is a layout observation, not a measured user-productivity claim.

[Before Explore](screenshots/v0.9.0-explore-desktop.png) · [After Explore](screenshots/explore-desktop.png) · [Contact drawer](screenshots/contact-drawer.png) · [Mobile](screenshots/explore-mobile.png)

## Workflow review and limits

The browser regression journey enters the explicit demo through the login screen, searches an entity, selects Role: Promoter + London + Folk, opens the result, adds it, opens My Network, saves a note and follow-up date, selects the contact and previews a templated email. It also restores a hidden column, opens metadata with the keyboard, accesses list controls and opens Templates under Mail. Text search remains name/description search; roles use the existing Role filter.

Screenshots were visually reviewed on desktop and mobile. A separate native Safari walkthrough was attempted, but native clicks failed with `noWindowsAvailable` after the login screen rendered. It is not claimed completed; the workflow was verified with Playwright instead. Hosted sign-in and live email sending remain separate pending checks. Automated accessibility checks supplement, not replace, a human assistive-technology review.
