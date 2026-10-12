import type { Metadata } from "next";
import { PublicPage } from "@/components/public-page";

export const metadata: Metadata = {
  title: "Privacy — MusicMail",
  description:
    "How MusicMail handles account, workspace and optional Gmail data.",
};

export default function PrivacyPage() {
  return (
    <PublicPage title="Your privacy">
      <p className="muted">Updated 12 October 2026</p>
      <p>
        MusicMail is operated by Nicholas Suciu and presented as a GreenRoom
        Network product. For privacy questions or support, email{" "}
        <a href="mailto:musicmailsupport@gmail.com">
          musicmailsupport@gmail.com
        </a>
        .
      </p>
      <section aria-labelledby="information">
        <h2 id="information">The information we use</h2>
        <p>
          Your account includes your email address, display name, authentication
          information managed by Supabase, and preferences. Your workspace can
          contain contacts, notes, lists, saved views, relationship and outreach
          states, follow-ups, interactions, message templates, sent-message
          records, calendar events and equipment checklists. We use this
          information to provide the features you choose to use.
        </p>
        <p>
          Shared music-industry records are separate from your private workspace
          records. Importing a private contact does not publish it. Contact data
          you add may concern other people; you are responsible for having an
          appropriate basis to use it and for respecting objections to outreach.
        </p>
        <p>
          Security and service providers also process request metadata such as
          IP addresses, authentication and email-delivery events, and audit
          records. We use necessary session and OAuth-state cookies, a cookie
          for your appearance preference, and Cloudflare Turnstile to protect
          account access. These functions are separate from advertising.
        </p>
      </section>
      <section aria-labelledby="gmail">
        <h2 id="gmail">Gmail is optional and sends only</h2>
        <p>
          Connecting Gmail is separate from signing into MusicMail. With your
          permission, Google supplies your account email and access/refresh
          tokens so MusicMail can identify your sending account and send the
          messages you initiate. The requested permissions are basic account
          identity and Gmail sending. MusicMail does not request access to read
          your inbox, modify received messages or access your full mailbox.
        </p>
        <p>
          Connection tokens are encrypted in server storage and are not sent to
          the MusicMail browser interface. Your private workspace retains the
          outgoing recipient, subject, body, time, send result and message
          identifier to help you track outreach. Sending passes your message to
          Google and its recipients. MusicMail does not automatically retry a
          message whose delivery result is uncertain.
        </p>
        <p>
          MusicMail follows the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements. Google data is used for
          MusicMail&apos;s visible features, not sold, used for advertising or
          used to train general-purpose AI models. Human access to Google data
          is limited to your specific permission, necessary security or legal
          purposes, or permitted aggregated internal operations. Transfers are
          limited to providing the features you authorize, security, legal
          obligations or other transfers allowed by that policy.
        </p>
        <p>
          Disconnecting Gmail attempts to revoke Google&apos;s permission and
          removes MusicMail&apos;s stored connection. If revocation fails,
          remove MusicMail from your Google account&apos;s connected apps.
          Disconnecting retains your private sent-message history. Account
          deletion also attempts revocation.
        </p>
      </section>
      <section aria-labelledby="providers">
        <h2 id="providers">Providers and protected access</h2>
        <p>
          MusicMail uses Vercel for hosting, Supabase for authentication and
          database services, Resend for account emails, Cloudflare for bot
          protection, and Google when you connect Gmail. They process the
          information needed for those services. Processing may take place
          outside your country under the providers&apos; applicable
          arrangements. Contact us for information about the arrangements
          relevant to your data.
        </p>
        <p>
          Workspace membership and database access controls separate ordinary
          users&apos; private records. Authorized administrators have audited
          support access to account and workspace records, including private CRM
          information and selected sent-email metadata. This does not give other
          ordinary users access to your workspace. Google data remains subject
          to the access limits above.
        </p>
      </section>
      <section aria-labelledby="retention">
        <h2 id="retention">Retention, export and deletion</h2>
        <p>
          Account and workspace information stays available while your account
          or workspace exists. Archiving a contact retains its private records.
          Account settings let you export your workspace data and delete your
          account through a protected confirmation flow. Exports exclude
          passwords, sessions, connection tokens and server credentials.
        </p>
        <p>
          Account deletion removes sole-member workspaces and their private
          records. A shared workspace with another owner, shared public
          music-industry records and retained security/audit evidence may
          remain. Removal from the live application does not promise immediate
          removal from provider backups or logs; those follow applicable
          provider lifecycles. Data may also be retained where necessary for
          security or legal obligations. Contact us about the retention
          applicable to a specific record.
        </p>
      </section>
      <section aria-labelledby="rights">
        <h2 id="rights">Your choices and requests</h2>
        <p>
          Providing the account information is necessary to use protected
          MusicMail features. Gmail connection is optional and can be withdrawn.
          We process account and workspace data to perform our agreement to
          provide the service you request. We rely on legitimate interests in
          protecting the service for security and abuse prevention, and on legal
          obligations where applicable. Depending on applicable law, you may
          request access, correction, deletion or restriction of your data,
          object to processing, or request a portable copy. Email the address
          above; we may need to verify your identity before acting. You can also
          complain to the UK{" "}
          <a href="https://ico.org.uk/make-a-complaint/">
            Information Commissioner&apos;s Office
          </a>{" "}
          or your relevant data-protection authority.
        </p>
        <p>
          We will update this notice when data practices change. A new use of
          Google data requires appropriate disclosure and renewed permission
          before that use begins.
        </p>
      </section>
    </PublicPage>
  );
}
