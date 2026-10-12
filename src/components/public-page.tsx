import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/common";
import { appOrigin } from "@/lib/server/config";

export function PublicPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="landing-nav">
        <Brand />
        <Link className="button" href={`${appOrigin()}/login`}>
          Log in
        </Link>
      </header>
      <main className="public-document">
        <div className="eyebrow">MUSICMAIL</div>
        <h1>{title}</h1>
        {children}
        <footer className="public-footer">
          <Link href="/">MusicMail</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/support">Support</Link>
        </footer>
      </main>
    </>
  );
}
