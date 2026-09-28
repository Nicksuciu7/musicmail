import { describe, it, expect, vi, beforeEach } from "vitest";
import { demoWorkspace, entities } from "../src/lib/fixtures";
import { encrypt } from "../src/lib/server/crypto";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  workspace: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../src/lib/server/supabase", () => ({
  identity: mocks.identity,
  serviceClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw new Error("Database error");
    return r.data;
  },
}));
vi.mock("../src/lib/server/repository", () => ({ workspace: mocks.workspace }));
import { mimeMessage, sendSchema, sendMessages } from "../src/lib/server/gmail";
const cid = "aaaaaaaa-0000-4000-8000-000000000001";
const message = () => ({
  confirmed: true as const,
  messages: [
    {
      attemptId: crypto.randomUUID(),
      contactId: cid,
      subject: "Hello from Quiet Hours",
      body: "A personal message.",
    },
  ],
});
beforeEach(() => {
  vi.resetAllMocks();
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
  mocks.identity.mockResolvedValue({ id: "user-a", demo: false });
  const w = demoWorkspace();
  w.demo = false;
  w.gmailEmail = "artist@example.test";
  w.contacts = [
    {
      id: cid,
      entity_id: entities[0].id,
      entity: entities[0],
      private_email: "recipient@example.test",
      private_display_name: null,
      private_details: {},
      relationship_status: "warm",
      outreach_status: "not_contacted",
      priority: null,
      follow_up_at: null,
      last_contacted_at: null,
      relationship_origin: null,
      archived: false,
      created_at: new Date().toISOString(),
    },
  ];
  mocks.workspace.mockResolvedValue(w);
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.from.mockImplementation((table: string) => {
    const chain = {
      select: () => chain,
      update: () => chain,
      eq: () => chain,
      single: async () => ({
        data:
          table === "gmail_connections"
            ? {
                encrypted_tokens: encrypt({
                  access_token: "test-access",
                  refresh_token: "test-refresh",
                  expires_at: Date.now() + 3600000,
                }),
              }
            : { outreach_status: "not_contacted", archived: false },
        error: null,
      }),
    };
    return chain;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "gmail-message-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});
describe("Gmail send boundary", () => {
  it("sends one recipient and commits metadata only after success", async () => {
    const result = await sendMessages(message());
    expect(result.results[0].status).toBe("sent");
    expect(mocks.rpc.mock.calls.map((c) => c[0])).toEqual([
      "reserve_email",
      "record_sent",
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const args = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(args[1]?.body));
    expect(Buffer.from(payload.raw, "base64url").toString()).toContain(
      "To: recipient@example.test\r\n",
    );
    expect(Buffer.from(payload.raw, "base64url").toString()).not.toContain(
      "Bcc:",
    );
  });
  it("blocks suppressed contacts before Gmail access", async () => {
    const w = await mocks.workspace();
    w.contacts[0].outreach_status = "do_not_contact";
    const result = await sendMessages(message());
    expect(result.results[0].status).toBe("failed");
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not send in demo mode", async () => {
    mocks.identity.mockResolvedValue({ id: "demo", demo: true });
    await expect(sendMessages(message())).rejects.toThrow("Demo mode");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not resend a reserved attempt", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "duplicate" },
    });
    const result = await sendMessages(message());
    expect(result.results[0].status).toBe("failed");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("marks ambiguous transport failures uncertain without retry", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("timeout"));
    const result = await sendMessages(message());
    expect(result.results[0].status).toBe("uncertain");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls.map((c) => c[0])).toEqual(["reserve_email"]);
  });
  it("requires confirmation, bounded batches and safe subjects", () => {
    expect(
      sendSchema.safeParse({ messages: message().messages, confirmed: false })
        .success,
    ).toBe(false);
    expect(
      sendSchema.safeParse({
        messages: Array.from({ length: 11 }, () => message().messages[0]),
        confirmed: true,
      }).success,
    ).toBe(false);
    expect(() =>
      mimeMessage(
        "to@example.test",
        "subject\r\nBcc: other@example.test",
        "body",
      ),
    ).toThrow();
    expect(() => mimeMessage("bad address", "subject", "body")).toThrow();
  });
});
