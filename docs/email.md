# Personal outreach

Gmail connection is separate from Supabase sign-in. OAuth requests `openid email` for sender identity and `https://www.googleapis.com/auth/gmail.send` for delivery. It does not read the inbox. Replies remain in Gmail; the user updates outreach status manually.

A user selects 1–10 contacts, chooses or writes a template, edits each recipient's subject/body and previews each message. The server validates every request independently. Supported variables: `{{first_name}}`, `{{organisation}}`, `{{artist_name}}`, `{{contact_name}}`. Unknown variables are rejected. Default templates are starting points with explicit personalisation placeholders, not complete pitches.

The composer shows the connected Gmail identity. Each message has exactly one To address and no shared recipient list. Suppressed or archived contacts cannot be sent. Synthetic `.example` recipients are blocked even in a configured environment.

The server allows at most 30 attempts per hour per user. An advisory lock prevents concurrent requests from exceeding that count. Each message has a stable UUID attempt ID; replayed IDs do not send again. Reserved, failed and uncertain attempts count towards the limit.

After Gmail confirms acceptance, `record_sent` transactionally records message metadata, creates an interaction, sets first/last-contacted timestamps and changes `not_contacted` or `draft` to `sent`. Other outreach states, including `do_not_contact`, are preserved. The relationship status is not inferred from a send.

If Gmail delivery may have occurred but no reliable response or database commit was obtained, the attempt becomes uncertain. The UI instructs the user to inspect Gmail Sent; there is no automatic retry. A successful API response means Gmail accepted the message, not that the recipient received or read it.

Demo mode supports templates and personal previews but **never calls Gmail**. Live connect, refresh, revoke and deliver must be tested with the operator's own consenting test accounts before release. See [security review](email-security.md) and [deployment setup](deployment.md).

## Authentication mail

Verification and recovery emails are delivered by Supabase Auth through its SMTP configuration, independently of the user's Gmail connection. Development supports Supabase default templates via the same-browser PKCE `/auth/callback` flow. The branded templates in `supabase/templates/` are saved in the production Confirm signup and Reset password editors. They link to the configured Site URL with a one-time token in the fragment; the app redeems the token only when the user submits the form. This avoids email scanners consuming a token simply by fetching a link. See [authentication setup](authentication.md). SMTP is active through Resend as `MusicMail <hello@auth.musicmailapp.uk>`; actual confirmation and reset delivery/completion are operator-verified. SPF/DKIM records resolve and the sender inherits parent DMARC `v=DMARC1; p=none;`. DNS/provider verification is not a claim about every message header. See [acceptance](v1-acceptance.md).

## Gmail acceptance status

On 2026-10-03 the operator clarified that Google Cloud has not been set up. Earlier statements of Gmail verification do not establish live provider acceptance. Code/mocked security tests pass; production OAuth credentials and consent/send/revoke acceptance remain blockers. The application still uses only gmail.send and identity scopes. No unnecessary inbox scope is requested.
