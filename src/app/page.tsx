import Link from "next/link";
import { Brand } from "@/components/common";
import { ArrowUpRight, Compass, Users, Mail } from "lucide-react";
import { demoEnabled } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default function Landing() {
  return (
    <>
      <header className="landing-nav">
        <Brand />
        <div className="actions">
          <Link className="button" href="/login">
            Log in
          </Link>
          <Link className="button primary" href="/signup">
            Get started <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>
      <main className="landing-main">
        <div className="eyebrow">INDEPENDENT. TOGETHER.</div>
        <h1>Your music industry network, organised.</h1>
        <p className="lead">
          Find the right people. Build meaningful relationships. Give your music
          somewhere to go.
        </p>
        <div className="actions">
          <Link className="button primary" href="/signup">
            Start your next chapter <ArrowUpRight size={15} />
          </Link>
          {demoEnabled() && (
            <Link className="button" href="/explore">
              Explore the demo
            </Link>
          )}
        </div>
        <section className="landing-features">
          <div>
            <Compass size={24} />
            <h2>Find your people.</h2>
            <p>
              Discover venues, promoters, labels and more. Find a fit through
              genre, location and the feeling of your music.
            </p>
          </div>
          <div>
            <Users size={24} />
            <h2>Keep the connection.</h2>
            <p>
              Your notes, your relationships, your next follow-up. A private
              space for the people in your music world.
            </p>
          </div>
          <div>
            <Mail size={24} />
            <h2>Make it personal.</h2>
            <p>
              Thoughtful outreach from your own Gmail. A starting point for a
              real conversation, with every message made your own.
            </p>
          </div>
        </section>
        <footer className="muted">
          MusicMail · A GreenRoom Network product
          {demoEnabled()
            ? " · Demo collection contains fictional contacts"
            : ""}
        </footer>
      </main>
    </>
  );
}
