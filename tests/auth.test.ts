import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    verifyOtp: vi.fn(),
    updateUser: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    resend: vi.fn(),
  },
  limit: vi.fn(),
  prefs: vi.fn(),
  recovery: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../src/lib/server/supabase", () => ({
  serviceClient: () => ({ rpc: mocks.rpc }),
  demoEnabled: () => false,
  supabase: async () => ({
    auth: mocks.auth,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.prefs }) }),
    }),
  }),
}));
vi.mock("../src/lib/server/recovery", () => ({
  recoverySession: mocks.recovery,
}));
vi.mock("../src/lib/server/rate-limit", () => ({ rateLimit: mocks.limit }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: vi.fn() }) }));
import { POST } from "../src/app/api/auth/route";
import { authSchema, strongPassword } from "../src/lib/auth-validation";
import { ApiError, body, errorResponse } from "../src/lib/server/http";
import {
  appOrigin,
  localDemo,
  sessionCookieOptions,
} from "../src/lib/server/config";
const email = "auth-test@example.test",
  password = "Synthetic1!password";
const user = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email,
  email_confirmed_at: "2026-09-29T00:00:00Z",
};
function call(input: unknown, origin = "http://localhost:3000") {
  return POST(
    new Request("http://localhost:3000/api/auth", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.MUSICMAIL_DEMO = "false";
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.VERCEL;
  for (const f of Object.values(mocks.auth))
    f.mockResolvedValue({ data: { user, session: {} }, error: null });
  mocks.prefs.mockResolvedValue({
    data: { onboarding_completed: true },
    error: null,
  });
  mocks.limit.mockResolvedValue(undefined);
});
describe("password policy", () => {
  it.each([
    "abcdefghij",
    "Abcdefghij",
    "Abcdefgh1j",
    "abcdef1!xx",
    "ABCDEF1!XX",
    "Ab1!xy",
  ])("rejects synthetic weak password %s", (value) =>
    expect(strongPassword.safeParse(value).success).toBe(false),
  );
  it("accepts strong passwords without changing characters", () =>
    expect(strongPassword.parse(password)).toBe(password));
  it("requires confirmation and a name", () => {
    expect(
      authSchema.safeParse({
        action: "signup",
        email,
        password,
        confirmPassword: "different",
        name: "Tester",
      }).success,
    ).toBe(false);
    expect(
      authSchema.safeParse({
        action: "signup",
        email,
        password,
        confirmPassword: password,
      }).success,
    ).toBe(false);
  });
});
describe("auth handlers", () => {
  it("validates before calling Auth", async () => {
    expect(
      (
        await call({
          action: "signup",
          email,
          password: "abcdefghij",
          confirmPassword: "abcdefghij",
          name: "Tester",
        })
      ).status,
    ).toBe(400);
    expect(mocks.auth.signUp).not.toHaveBeenCalled();
  });
  it("creates accounts through Supabase with name metadata and verification pending", async () => {
    mocks.auth.signUp.mockResolvedValue({
      data: { user, session: null },
      error: null,
    });
    const r = await call({
      action: "signup",
      name: "Tester",
      email,
      password,
      confirmPassword: password,
    });
    expect(await r.json()).toEqual({ url: "/verify-email" });
    expect(mocks.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email,
        password,
        options: expect.objectContaining({
          data: { name: "Tester" },
          emailRedirectTo: "http://localhost:3000/auth/callback",
        }),
      }),
    );
  });
  it("does not grant application access from an autoconfirm signup", async () => {
    const r = await call({
      action: "signup",
      name: "Tester",
      email,
      password,
      confirmPassword: password,
    });
    expect(await r.json()).toEqual({ url: "/verify-email" });
    expect(mocks.auth.signOut).toHaveBeenCalled();
  });
  it("logs in verified accounts and derives routing from their preferences", async () => {
    expect(
      await (await call({ action: "login", email, password })).json(),
    ).toEqual({ url: "/home" });
  });
  it("does not reveal provider error details", async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({
      error: { message: "private SQL/token detail" },
      data: {},
    });
    const r = await call({ action: "login", email, password });
    expect(r.status).toBe(400);
    expect(JSON.stringify(await r.json())).not.toContain("private SQL");
  });
  it("rejects unverified sessions", async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({
      error: null,
      data: { user: { ...user, email_confirmed_at: null } },
    });
    expect((await call({ action: "login", email, password })).status).toBe(400);
    expect(mocks.auth.signOut).toHaveBeenCalled();
  });
  it("clears the local session on logout", async () => {
    expect(await (await call({ action: "logout" })).json()).toEqual({
      url: "/login",
    });
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("uses identity-only Google scopes and a fixed callback", async () => {
    mocks.auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://provider.example/authorize" },
      error: null,
    });
    await call({ action: "google", redirect: "https://malicious.example" });
    expect(mocks.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
        scopes: "openid email profile",
      },
    });
  });
  it("returns identical reset responses for unknown accounts", async () => {
    const a = await (await call({ action: "forgot", email })).json();
    mocks.auth.resetPasswordForEmail.mockResolvedValue({
      error: { code: "user_not_found" },
    });
    const b = await (
      await call({ action: "forgot", email: "unknown@example.test" })
    ).json();
    expect(a).toEqual(b);
  });
  it("verifies recovery purpose before changing any password", async () => {
    mocks.auth.verifyOtp.mockResolvedValue({
      error: { code: "otp_expired" },
      data: {},
    });
    const r = await call({
      action: "reset",
      tokenHash: "a".repeat(64),
      password,
      confirmPassword: password,
    });
    expect(r.status).toBe(400);
    expect(mocks.auth.verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "a".repeat(64),
    });
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
  });
  it("accepts a recovery proof and signs out other sessions after reset", async () => {
    const r = await call({
      action: "reset",
      tokenHash: "a".repeat(64),
      password,
      confirmPassword: password,
    });
    expect(await r.json()).toEqual({ url: "/login?reset=1" });
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
  it("requires current-password verification for a password change", async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials" },
      data: {},
    });
    expect(
      (
        await call({
          action: "change",
          currentPassword: "wrong",
          password,
          confirmPassword: password,
        })
      ).status,
    ).toBe(400);
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
  });
  it("returns 429 and Retry-After on exhausted shared limits", async () => {
    mocks.limit.mockRejectedValue(new ApiError("Too many attempts.", 429, 60));
    const r = await call({ action: "login", email, password });
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("60");
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests before calling Auth", async () => {
    expect(
      (
        await call(
          { action: "login", email, password },
          "https://malicious.example",
        )
      ).status,
    ).toBe(400);
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("requires a CAPTCHA token when configured", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
    expect((await call({ action: "login", email, password })).status).toBe(400);
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
describe("CAPTCHA provider enforcement", () => {
  const inputs = [
    { action: "login", email, password },
    {
      action: "signup",
      name: "Tester",
      email,
      password,
      confirmPassword: password,
    },
    { action: "forgot", email },
    { action: "resend", email },
  ];
  it.each(inputs)("rejects missing challenge for $action", async (input) => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
    expect((await call(input)).status).toBe(400);
    for (const name of [
      "signUp",
      "signInWithPassword",
      "resetPasswordForEmail",
      "resend",
    ] as const)
      expect(mocks.auth[name]).not.toHaveBeenCalled();
  });
  it.each(inputs)(
    "passes challenge to server-side Auth for $action",
    async (input) => {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
      await call({ ...input, captchaToken: "synthetic-challenge" });
      const name = {
        login: "signInWithPassword",
        signup: "signUp",
        forgot: "resetPasswordForEmail",
        resend: "resend",
      }[input.action] as keyof typeof mocks.auth;
      const args = mocks.auth[name].mock.calls[0];
      const options = input.action === "forgot" ? args[1] : args[0].options;
      expect(options.captchaToken).toBe("synthetic-challenge");
    },
  );
  it.each(inputs)(
    "rejects provider CAPTCHA failure for $action",
    async (input) => {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
      for (const name of [
        "signUp",
        "signInWithPassword",
        "resetPasswordForEmail",
        "resend",
      ] as const)
        mocks.auth[name].mockResolvedValue({
          error: { code: "captcha_failed", status: 400 },
          data: {},
        });
      expect(
        (await call({ ...input, captchaToken: "invalid-challenge" })).status,
      ).toBe(400);
    },
  );
});
describe("request and configuration boundaries", () => {
  it("rejects oversized streamed bodies without content length", async () => {
    const r = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body: "x".repeat(100),
    });
    await expect(body(r, 10)).rejects.toMatchObject({ status: 413 });
  });
  it("does not expose unexpected exceptions", async () =>
    expect(await errorResponse(new Error("private data")).json()).toEqual({
      error: "Unable to complete this request. Please try again.",
    }));
  it("rejects insecure production URLs and deployed demo mode", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://musicmail.example";
    expect(appOrigin).toThrow();
    process.env.NEXT_PUBLIC_APP_URL = "https://musicmail.example";
    process.env.MUSICMAIL_DEMO = "true";
    expect(localDemo).toThrow();
  });
  it("uses server-only secure cookies on HTTPS", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://musicmail.example";
    expect(sessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });
});

describe("default-template recovery authorization", () => {
  const input = { action: "reset", password, confirmPassword: password };
  it("rejects normal sessions without updating passwords", async () => {
    mocks.recovery.mockResolvedValue(null);
    expect((await call(input)).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
  });
  it.each([false, null])(
    "rejects missing or consumed grants (%s)",
    async (data) => {
      mocks.recovery.mockResolvedValue({
        userId: user.id,
        sessionId: "session",
      });
      mocks.rpc.mockResolvedValue({ data, error: null });
      expect((await call(input)).status).toBe(403);
      expect(mocks.auth.updateUser).not.toHaveBeenCalled();
    },
  );
  it("consumes the server grant before changing password", async () => {
    mocks.recovery.mockResolvedValue({ userId: user.id, sessionId: "session" });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect((await call(input)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("consume_recovery_grant", {
      sid: "session",
      uid: user.id,
    });
    expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password });
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.auth.updateUser.mock.invocationCallOrder[0],
    );
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});

it("does not invent a retry time for a provider rate limit", async () => {
  mocks.auth.resetPasswordForEmail.mockResolvedValue({
    data: {},
    error: { status: 429 },
  });
  const response = await call({ action: "forgot", email });
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBeNull();
  expect((await response.json()).error).toContain("temporarily limited");
});

describe("provider confirmation token formats", () => {
  it.each(["a".repeat(56), "pkce_" + "b".repeat(56)])(
    "passes supported tokens unchanged to Supabase",
    async (tokenHash) => {
      expect((await call({ action: "verify", tokenHash })).status).toBe(200);
      expect(mocks.auth.verifyOtp).toHaveBeenCalledWith({
        type: "signup",
        token_hash: tokenHash,
      });
    },
  );
  it("keeps expired or already-used prefixed tokens rejected by Supabase", async () => {
    mocks.auth.verifyOtp.mockResolvedValue({
      data: {},
      error: { code: "otp_expired" },
    });
    expect(
      (await call({ action: "verify", tokenHash: "pkce_" + "b".repeat(56) }))
        .status,
    ).toBe(400);
  });
  it("supports the same provider prefix for recovery without changing purpose", async () => {
    const tokenHash = "pkce_" + "c".repeat(56);
    expect(
      (
        await call({
          action: "reset",
          tokenHash,
          password,
          confirmPassword: password,
        })
      ).status,
    ).toBe(200);
    expect(mocks.auth.verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: tokenHash,
    });
  });
  it.each([
    "pkce_",
    "pkce_" + "a".repeat(129),
    "https://evil.test/token",
    "pkce_" + "a".repeat(56) + "&type=recovery",
  ])("rejects malformed token %s before provider calls", async (tokenHash) => {
    expect((await call({ action: "verify", tokenHash })).status).toBe(400);
    expect(mocks.auth.verifyOtp).not.toHaveBeenCalled();
  });
});
