"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Brand } from "./common";
import { request } from "@/lib/client";
import { passwordRequirements, authSchema } from "@/lib/auth-validation";
import { Captcha } from "./captcha";
type Mode = "login" | "signup" | "forgot" | "reset" | "verify" | "change";
export function AuthForm({
  signup = false,
  demo = false,
  googleEnabled = false,
  mode: specified,
}: {
  signup?: boolean;
  demo?: boolean;
  googleEnabled?: boolean;
  mode?: Mode;
}) {
  const mode = specified || (signup ? "signup" : "login");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState(""),
    [tokenHash, setTokenHash] = useState(""),
    [recoveryReady, setRecoveryReady] = useState(false),
    [captchaToken, setCaptchaToken] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.has("token_hash")) {
      setTokenHash(hash.get("token_hash") || "");
      window.history.replaceState(null, "", window.location.pathname);
    }
    const q = new URLSearchParams(window.location.search);
    setRecoveryReady(q.get("recovery") === "1");
    if (q.has("error"))
      setError(
        "This link could not complete sign-in. Open the latest email in the same browser and device where you requested it. If you already confirmed your email, sign in below. For a password reset, request a new link after any rate limit clears.",
      );
    else if (q.has("reset") || q.has("changed"))
      setMessage("Password updated. Sign in with your new password.");
    else if (q.has("verified"))
      setMessage("Your email is verified. You can sign in.");
  }, []);
  const newPassword = ["signup", "reset", "change"].includes(mode);
  const title = {
    login: "Good to see you again.",
    signup: "Create your MusicMail account",
    forgot: "Reset your password",
    reset: "Choose a new password",
    verify: "Verify your email",
    change: "Change your password",
  }[mode];
  async function submit(action: string, fields: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const input = authSchema.safeParse({
        action,
        ...fields,
        tokenHash: tokenHash || undefined,
        captchaToken,
      });
      if (!input.success)
        throw new Error(input.error.issues.map((i) => i.message).join(" "));
      const result = await request<{ url?: string; message?: string }>(
        "/api/auth",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.data),
        },
      );
      if (result.url) window.location.assign(result.url);
      else setMessage(result.message || "Check your email.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setCaptchaToken("");
      setAttempt((n) => n + 1);
    }
  }
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link href="/">
          <Brand />
        </Link>
        <h1>{title}</h1>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {message && <p role="status">{message}</p>}
        {demo ? (
          <>
            <p>
              Try a private demo workspace with fictional industry contacts. No
              account or email connection needed.
            </p>
            <Link className="button primary" href="/onboarding">
              Enter demo workspace →
            </Link>
          </>
        ) : (
          <>
            {googleEnabled && ["login", "signup"].includes(mode) && (
              <>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => submit("google")}
                >
                  Continue with Google
                </button>
                <p className="auth-foot">or with your email</p>
              </>
            )}
            {mode === "verify" && (
              <p>
                Open the latest verification email, then select Verify email
                here. Opening this page alone does not verify your account. If
                your email is already verified, you can sign in.
              </p>
            )}
            {mode === "forgot" && (
              <p>
                Request one reset email, then open its link to choose your new
                password. Use the latest email and avoid repeated requests.
              </p>
            )}
            {mode === "verify" && tokenHash ? (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => submit("verify")}
              >
                Verify email
              </button>
            ) : mode === "reset" && !tokenHash && !recoveryReady ? (
              <p>
                This reset link is missing or expired.{" "}
                <Link href="/forgot-password">Request a new reset email</Link>.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(
                    mode === "verify" ? "resend" : mode,
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                }}
              >
                {mode === "signup" && (
                  <label className="field">
                    Name
                    <input
                      name="name"
                      autoComplete="name"
                      maxLength={100}
                      required
                    />
                  </label>
                )}
                {["login", "signup", "forgot", "verify"].includes(mode) && (
                  <label className="field">
                    Email
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      required
                    />
                  </label>
                )}
                {mode === "change" && (
                  <label className="field">
                    Current password
                    <input
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                )}
                {["login", "signup", "reset", "change"].includes(mode) && (
                  <label className="field">
                    {newPassword ? "New password" : "Password"}
                    <input
                      name="password"
                      type="password"
                      autoComplete={
                        newPassword ? "new-password" : "current-password"
                      }
                      minLength={newPassword ? 10 : 1}
                      maxLength={200}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </label>
                )}
                {newPassword && (
                  <>
                    <ul aria-label="Password requirements">
                      {passwordRequirements.map((r) => (
                        <li key={r.label}>
                          {r.test(password) ? "✓" : "○"} {r.label}
                        </li>
                      ))}
                    </ul>
                    <label className="field">
                      Confirm password
                      <input
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        maxLength={200}
                        required
                      />
                    </label>
                  </>
                )}
                {["login", "signup", "forgot", "verify", "change"].includes(
                  mode,
                ) && <Captcha key={attempt} onToken={setCaptchaToken} />}
                <button className="button primary" disabled={busy}>
                  {busy
                    ? "One moment…"
                    : {
                        login: "Sign in",
                        signup: "Create account",
                        forgot: "Send reset email",
                        verify: "Resend verification email",
                        reset: "Reset password",
                        change: "Change password",
                      }[mode]}
                </button>
              </form>
            )}
            <div className="auth-foot">
              {mode === "login" ? (
                <>
                  <Link href="/forgot-password">Forgot password?</Link>
                  <br />
                  <Link href="/signup">Create account</Link>
                  <br />
                  <Link href="/verify-email">Resend verification email</Link>
                </>
              ) : (
                <Link href={mode === "change" ? "/settings" : "/login"}>
                  {mode === "change" ? "Back to settings" : "Back to sign in"}
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
