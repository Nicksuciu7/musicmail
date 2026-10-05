-- Appearance belongs to the authenticated person, never the workspace.
alter table public.profiles add column theme text not null default 'system' check(theme in ('system','light','dark'));
