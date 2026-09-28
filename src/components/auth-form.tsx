"use client";
import { useState } from "react";
import Link from "next/link";
import { Brand } from "./common";
import { request } from "@/lib/client";
export function AuthForm({
  signup = false,
  demo = false,
}: {
  signup?: boolean;
  demo?: boolean;
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (action: string, email?: string, password?: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ url?: string; message?: string }>(
        "/api/auth",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, email, password }),
        },
      );
      if (result.url) window.location.href = result.url;
      else setMessage(result.message || "Check your email.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link href="/">
          <Brand />
        </Link>
        <h1>
          {signup ? "Your next chapter starts here." : "Good to see you again."}
        </h1>
        <p>
          {demo
            ? "Try a private demo workspace with fictional industry contacts. No account or email connection needed."
            : "Discover your people. Keep your connections close."}
        </p>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {message && <p role="status">{message}</p>}
        {demo ? (
          <Link className="button primary" href="/onboarding">
            Enter demo workspace →
          </Link>
        ) : (
          <>
            <button
              className="button"
              disabled={busy}
              onClick={() => submit("google")}
            >
              Continue with Google
            </button>
            <p className="auth-foot">or with your email</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void submit(
                  signup ? "signup" : "login",
                  String(f.get("email")),
                  String(f.get("password")),
                );
              }}
            >
              <label className="field">
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="field">
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={8}
                  required
                />
              </label>
              <button className="button primary" disabled={busy}>
                {busy ? "One moment…" : signup ? "Create account" : "Log in"}
              </button>
            </form>
            <div className="auth-foot">
              {signup ? "Already at home here?" : "New to MusicMail?"}{" "}
              <Link href={signup ? "/login" : "/signup"}>
                {signup ? "Log in" : "Create an account"}
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
