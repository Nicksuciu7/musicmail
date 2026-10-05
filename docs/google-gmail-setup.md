# Gmail provider setup — required external action

Google Cloud has not yet been configured (operator clarification, 2026-10-03). Application code and mocked security checks are complete. This client is for Gmail permission, independent of optional Supabase Google sign-in.

1. Sign in at [Google Cloud Console](https://console.cloud.google.com/). Project selector → **New Project** → name **MusicMail** → **Create**; select it.
2. **APIs & Services → Library → Gmail API → Enable**.
3. **Google Auth Platform → Get started**: app name **MusicMail**, your support/contact email, audience **External**; save. **Audience**: initially **Testing**, add the Google account that will grant Gmail permission as a test user; save.
4. **Data Access → Add or remove scopes**: `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/gmail.send`. Save. No inbox/read/modify/full-mail scope.
5. **Clients → Create client → Web application**. Name **MusicMail Gmail**. Authorized redirect URI **`https://musicmail.vercel.app/api/gmail/callback`**; create/save. Optional separate local testing URI: `http://localhost:3000/api/gmail/callback`.
6. **Vercel → MusicMail → Settings → Environment Variables → Production**: save Client ID as `GOOGLE_CLIENT_ID`, Client secret as `GOOGLE_CLIENT_SECRET` (sensitive). No `NEXT_PUBLIC_` prefix. Keep the secret out of Git/chat. Preserve the existing encryption key.

After “Google saved,” Codex redeploys and verifies the exact consent URL, send-only scopes, PKCE/state cookie and callback rejection automatically. One human Google consent screen is then necessary. Controlled sending uses the consenting account/recipient; token encryption, metadata, refresh and disconnect are checked afterward. No existing verified Auth/SMTP flows need manual repetition.

Google testing audience is not unrestricted public availability. Review the dashboard's token/user limits and verification requirements before broad rollout. `gmail.send` is sensitive but not an inbox/restricted scope. See [Google consent configuration](https://developers.google.com/workspace/guides/configure-oauth-consent), [scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), and [server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).
