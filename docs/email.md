# Personal outreach

Gmail connection is separate from Supabase sign-in. OAuth requests `openid email` for sender identity and `https://www.googleapis.com/auth/gmail.send` for delivery. It does not read the inbox. Replies remain in Gmail; the user updates outreach status manually.

A user selects 1–10 contacts, chooses or writes a template, edits each recipient's subject/body and previews each message. The server validates every request independently. Supported variables: `{{first_name}}`, `{{organisation}}`, `{{artist_name}}`, `{{contact_name}}`. Unknown variables are rejected. Default templates are starting points with explicit personalisation placeholders, not complete pitches.

The composer shows the connected Gmail identity. Each message has exactly one To address and no shared recipient list. Suppressed or archived contacts cannot be sent. Synthetic `.example` recipients are blocked even in a configured environment.

The server allows at most 30 attempts per hour per user. An advisory lock prevents concurrent requests from exceeding that count. Each message has a stable UUID attempt ID; replayed IDs do not send again. Reserved, failed and uncertain attempts count towards the limit.

After Gmail confirms acceptance, `record_sent` transactionally records message metadata, creates an interaction, sets first/last-contacted timestamps and changes `not_contacted` or `draft` to `sent`. Other outreach states, including `do_not_contact`, are preserved. The relationship status is not inferred from a send.

If Gmail delivery may have occurred but no reliable response or database commit was obtained, the attempt becomes uncertain. The UI instructs the user to inspect Gmail Sent; there is no automatic retry. A successful API response means Gmail accepted the message, not that the recipient received or read it.

Demo mode supports templates and personal previews but **never calls Gmail**. Live connect, refresh, revoke and deliver must be tested with the operator's own consenting test accounts before release. See [security review](email-security.md) and [deployment setup](deployment.md).
