# Gmail verification demo handoff — 2026-10-14

Google project `musicmail-510518` is External / **In production**. Branding is verified and published. Data Access declares only `openid`, `userinfo.email` and `gmail.send`; there are no restricted scopes. The actual runtime request remains `openid email https://www.googleapis.com/auth/gmail.send`.

Google's **Verification Center → Prepare for verification** reports: **Missing the following fields for one or more requested scopes: demo video.** Nothing has been submitted for sensitive-scope review. MusicMail v1 remains unpublished.

## Record the real flow

Record a short English demonstration using your own account and a disposable self-addressed contact. The operator must complete the Google consent and recording/upload steps; no account password or provider secret belongs in the video or repository. Do not include unrelated private CRM data or an email verification/reset link.

1. Show `https://app.musicmailapp.uk/` and its Privacy link. Sign in before recording passwords; return to MusicMail Settings.
2. Select **Connect Gmail**. Record the full Google consent flow, MusicMail's app name, and the browser address bar showing the OAuth client ID. Show the send permission and complete consent yourself. Include an unverified-app notice if Google displays one; do not conceal it from the reviewer.
3. Show MusicMail Settings displaying the connected account. Only `gmail.send` is requested for Gmail; Google identity login is separate and disabled.
4. Create a private contact named **MusicMail verification demo**, with your own connected Gmail address. Review a single message to that address, then send it once:

   **Subject:** `MusicMail Gmail verification demo`

   **Body:** `This self-addressed message demonstrates MusicMail's optional Gmail send feature for Google's OAuth verification.`

5. Show the app's successful send result and private sent metadata. Optionally show only that received message in Gmail; no inbox contents are imported into MusicMail. Disconnecting afterward demonstrates removal of the saved Gmail connection; reconnecting requires consent again.

Google requires an actual demonstration of granting and using the sensitive scope, with all OAuth clients assigned to the project represented. This project has one Gmail web client. A mock animation or a successful automated initiation test does not replace this recording. See [Google's sensitive-scope verification instructions](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

## Exact field and save action

- Put the recording on YouTube with **Visibility: Unlisted**.
- Open [Google Auth Platform → Data Access](https://console.cloud.google.com/auth/scopes?project=musicmail-510518).
- Under **Demo video: how will the scopes will be used? → YouTube link**, enter the recording's actual YouTube watch URL.
- Click **Save**. Do not paste a token, password, secret, or a placeholder URL.
- Share only the unlisted video URL for review, or report that it is saved. Do not submit the verification request yet.

Afterward, verify the video is accessible, shows the matching client/consent/send flow, and the missing-video error clears. Review the complete submission and any attestations before the final provider submission. Google's approval, new-origin inbox confirmation/recovery and the outstanding CAPTCHA-gated hosted regressions remain release gates.

## Saved scope justification

The following 695-character explanation is saved in Data Access and persists after reload:

> MusicMail uses gmail.send only when a signed-in user explicitly connects Gmail and sends a reviewed outreach message from their own account. Users select a private CRM contact, review the recipient, subject and body, then confirm Send. Our server calls Gmail users.messages.send; it does not read or modify the inbox. gmail.send is the narrowest scope that permits sending. openid and userinfo.email identify the verified connected sender and display the account in Settings. Tokens are encrypted on the server and isolated by user; disconnect revokes access and removes saved tokens. Google data is used only for this user-requested feature, as disclosed at https://app.musicmailapp.uk/privacy.
