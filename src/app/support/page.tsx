import type { Metadata } from "next";
import Link from "next/link";
import { PublicPage } from "@/components/public-page";

export const metadata: Metadata = {
  title: "Support — MusicMail",
  description: "Contact MusicMail support and its operator, Nicholas Suciu.",
};

export default function SupportPage() {
  return (
    <PublicPage title="Here to help">
      <p>
        For account help, MusicMail questions or privacy requests, contact{" "}
        <a href="mailto:musicmailsupport@gmail.com">
          musicmailsupport@gmail.com
        </a>
        . MusicMail is operated by Nicholas Suciu.
      </p>
      <p>
        Include the problem and the page where it happened. Keep passwords,
        verification/reset links, API keys and connection tokens out of support
        messages.
      </p>
      <p>
        Account settings include private-data export, account deletion and Gmail
        disconnect. Our <Link href="/privacy">privacy notice</Link> explains how
        those features handle your information.
      </p>
    </PublicPage>
  );
}
