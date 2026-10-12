# MusicMail privacy notice — preparation draft

This is a factual draft for operator review, not the live privacy policy. Operator identity/contact and operational retention must be settled before publication. It does not claim a completed legal or Google verification review.

## Operator and contact

MusicMail is presented as a GreenRoom Network product. The legal operator and privacy/support contact are awaiting confirmation. Google currently shows the project owner's email as its consent support address; that alone does not establish a company identity or approved privacy contact.

## Information used by MusicMail

MusicMail uses your account email, display name, authentication information managed by Supabase and account preferences to provide verified access. Your workspace holds contacts, professional relationships, notes, lists, saved views, follow-ups, interactions, message templates, sent-message records and musician calendar events/checklists. Shared music-industry entities are separate from private workspace overlays. Importing a private contact does not automatically publish it.

Security and service operations also involve request metadata, provider delivery/authentication events and audit records. The app uses necessary session, OAuth-state and appearance cookies. Session and provider credentials are excluded from user exports. Cookie and provider retention must be checked against the deployed configuration before stating exact periods.

## Optional Gmail connection

Connecting Gmail is separate from signing into MusicMail. MusicMail requests basic Google account identity and permission to send email on your behalf (`gmail.send`). It does not request permission to read your inbox, modify received mail or access your full mailbox. Google returns an address and access/refresh tokens used to identify the sending account, send messages you initiate and refresh the connection.

Tokens are encrypted in server storage and unavailable through the ordinary browser/database API. MusicMail records the outgoing recipient, subject/body, send result and provider message identifier privately in your workspace so you can track outreach. Sending is limited and does not automatically retry ambiguous delivery. These records must be distinguished from reading a Gmail inbox.

Disconnecting attempts to revoke Google's grant and removes the stored MusicMail connection. If provider revocation fails, the application tells you to remove the grant in your Google account. Disconnecting preserves your private sent-message history. Account deletion also attempts revocation and removes the applicable private workspace data.

Before publication, confirm the required Google API Services User Data Policy/Limited Use statement accurately reflects both code and operator practices. Do not promise absent internal restrictions merely because the implementation has no advertising or model-training feature.

## Service providers and access

The deployment uses Vercel for application hosting, Supabase for authentication/database services, Resend for account emails, Cloudflare Turnstile for bot protection and Google for optional Gmail sending. Their services process the information needed for these functions. Any additional analytics, support integrations, processor agreements, geographic processing or international-transfer arrangements require operator confirmation.

Private records are protected by workspace membership and Row Level Security. Authorized MusicMail administrators can use audited support functions; private support access is not equivalent to sharing records with other ordinary members. Administrative access must be explained accurately in the final notice.

## Export, deletion and retention

You can export your private workspace data in account settings. You can disconnect Gmail and request account deletion through the protected account flow. Account deletion removes sole-member workspaces and associated private records; another owner's shared workspace and canonical public music-industry records are preserved. Archived contacts remain private retained records until deleted with the relevant account/workspace lifecycle.

No fixed backup/log retention or immediate deletion from provider backups is promised by this draft. The operator needs to choose/document a schedule and explain any security/audit retention. Applicable access, correction, objection and other rights and a contact process must be included in the final notice after operator review.

## Safe use and updates

Users remain responsible for the contact data and messages they add and for honoring do-not-contact preferences and relevant outreach requirements. Publicly available professional details do not automatically authorize all marketing. Any material change in processing, providers or Gmail use must be reflected in the notice.
