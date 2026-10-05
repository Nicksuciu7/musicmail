import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { recoverySession } from "../src/lib/server/recovery";
const uid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function db(
  method = "recovery",
  timestamp = Date.now() / 1000,
  error: unknown = null,
  userId = uid,
) {
  return {
    auth: {
      getClaims: async () => ({
        data: {
          claims: { sub: uid, session_id: sid, amr: [{ method, timestamp }] },
        },
        error,
      }),
      getUser: async () => ({
        data: { user: { id: userId, email_confirmed_at: "2026-09-30" } },
        error: null,
      }),
    },
  } as unknown as SupabaseClient;
}
describe("provider-verified recovery sessions", () => {
  it("accepts a fresh recovery method", async () =>
    expect(await recoverySession(db())).toEqual({
      userId: uid,
      sessionId: sid,
    }));
  it.each(["password", "oauth", "otp"])(
    "rejects ordinary %s sessions regardless of UI flags",
    async (method) => expect(await recoverySession(db(method))).toBeNull(),
  );
  it("rejects expired recovery authorization", async () =>
    expect(
      await recoverySession(db("recovery", Date.now() / 1000 - 901)),
    ).toBeNull());
  it("rejects future-dated authorization", async () =>
    expect(
      await recoverySession(db("recovery", Date.now() / 1000 + 120)),
    ).toBeNull());
  it("rejects unverified JWT claims", async () =>
    expect(
      await recoverySession(
        db("recovery", Date.now() / 1000, { message: "bad signature" }),
      ),
    ).toBeNull());
  it("rejects mismatched authenticated identity", async () =>
    expect(
      await recoverySession(db("recovery", Date.now() / 1000, null, sid)),
    ).toBeNull());
});
