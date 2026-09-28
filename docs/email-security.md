# Gmail security review

Design review completed before implementation; live Google OAuth verification is a release gate, not claimed complete by local tests.

- Scope: gmail.send plus openid/email for sender identity. No inbox read, modify or full-mail scope.
- OAuth state: 256-bit random value in a 10-minute HttpOnly SameSite=Lax cookie, bound to the authenticated Supabase user and checked with constant-time comparison. PKCE verifier is server-cookie-only. Callback consumes cookies and rejects provider errors.
- Tokens: AES-256-GCM with random IV and authenticated ciphertext, server-only 32-byte key. Token table has RLS, no authenticated grants, no browser select. Service credentials only in server modules.
- Refresh: server-side, retain existing refresh token if Google omits a new one. Provider failures return a reconnect message without token response bodies.
- Revocation: disconnect calls Google's revoke endpoint before deleting local tokens; local removal still happens on provider failure and the UI is told to revoke in Google account settings. Account deletion also attempts revocation.
- Sending: POST origin check, authenticated owner lookup, do-not-contact enforcement, 10-message request maximum, 30 attempts/hour per user using a PostgreSQL advisory lock. Durable unique attempt UUID prevents replay. No automatic retries. Reserved or ambiguous attempts consume the rate limit.
- Delivery ambiguity: an HTTP timeout can occur after Gmail accepted a message. Record attempt as uncertain, explain that Gmail Sent should be checked, and do not auto-retry. Database failure after delivery has the same treatment. Google delivery and PostgreSQL cannot be committed atomically.
- Header protection: validated recipient address; CR/LF rejected in subject; Unicode subject encoded; plain-text body base64 MIME encoded. Each API send contains one recipient.
- Logs: event name and safe error category only. Never log OAuth URLs, token bodies, recipient content or credentials.
- Residual review: deployment HTTPS, OAuth consent screen, Google verification requirements, redirect allowlists, key backup/rotation procedures, provider quota behavior and a live test mailbox must be reviewed by the operator before production.

Official references: https://developers.google.com/identity/protocols/oauth2/web-server and https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send .
