import { describe, expect, it, vi, beforeEach } from "vitest";
import { demoWorkspace, entities } from "../src/lib/fixtures";
import { exportWorkspace } from "../src/lib/export";
import { exportCsv, parseCsv } from "../src/lib/csv";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ workspace: vi.fn() }));
vi.mock("../src/lib/server/repository", () => ({ workspace: mocks.workspace }));
import { GET } from "../src/app/api/export/route";
import { ApiError } from "../src/lib/server/http";
function fixture() {
  const w = demoWorkspace();
  w.profile = {
    display_name: "Export test",
    timezone: "Europe/London",
    country: "GB",
  };
  const id = crypto.randomUUID();
  w.contacts = [
    {
      id,
      entity_id: entities[0].id,
      entity: structuredClone(entities[0]),
      private_display_name: "Private overlay",
      private_email: "overlay@example.test",
      private_details: { organisation: "Private organisation" },
      relationship_status: "warm",
      outreach_status: "follow_up_needed",
      priority: "high",
      follow_up_at: "2026-10-10",
      last_contacted_at: "2026-10-01",
      relationship_origin: "Met at concert",
      archived: false,
      created_at: "2026-10-01",
    },
  ];
  w.notes = [
    {
      id: crypto.randomUUID(),
      user_contact_id: id,
      body: "Private note",
      pinned: true,
      created_at: "2026-10-01",
    },
  ];
  w.interactions = [
    {
      id: crypto.randomUUID(),
      user_contact_id: id,
      type: "email_sent",
      title: "Private interaction",
      occurred_at: "2026-10-01",
    },
  ];
  w.lists = [{ id: crypto.randomUUID(), name: "Private list" }];
  w.members = [{ list_id: w.lists[0].id, user_contact_id: id }];
  w.sent = [
    {
      id: crypto.randomUUID(),
      user_contact_id: id,
      recipient: "overlay@example.test",
      subject: "Private subject",
      body: "Private email body",
      sent_at: "2026-10-01",
      gmail_message_id: "provider-message-id",
    },
  ];
  return w;
}
beforeEach(() => vi.resetAllMocks());
describe("private data export", () => {
  it("retains full CRM records and canonical references without summary truncation", () => {
    const w = fixture();
    w.contacts = Array.from({ length: 1001 }, (_, index) => ({
      ...w.contacts[0],
      id: String(index),
    }));
    const result = exportWorkspace(w);
    expect(result.contacts).toHaveLength(1001);
    expect(result.contacts[0]).toMatchObject({
      entity_id: entities[0].id,
      private_email: "overlay@example.test",
      relationship_status: "warm",
      outreach_status: "follow_up_needed",
      follow_up_at: "2026-10-10",
      priority: "high",
    });
    expect(result.notes).toEqual(w.notes);
    expect(result.lists).toEqual(w.lists);
    expect(result.members).toEqual(w.members);
    expect(result.interactions).toEqual(w.interactions);
    expect(result.sent).toEqual(w.sent);
    expect(result.views).toEqual(w.views);
    expect(result.templates).toEqual(w.templates);
    expect(result.goals).toEqual(w.goals);
  });
  it("does not serialize added credential columns or provider/session objects", () => {
    const w = fixture();
    const secrets = {
      password: "secret-password-sentinel",
      access_token: "secret-access-sentinel",
      refresh_token: "secret-refresh-sentinel",
      encrypted_tokens: "secret-gmail-sentinel",
      api_key: "secret-api-sentinel",
      database_url: "secret-db-sentinel",
      session: "secret-session-sentinel",
      service_role: "secret-service-sentinel",
    };
    Object.assign(w, secrets, { gmail_connections: secrets });
    for (const collection of [
      w.contacts,
      w.notes,
      w.interactions,
      w.lists,
      w.members,
      w.views,
      w.templates,
      w.sent,
    ])
      for (const row of collection) Object.assign(row, secrets);
    Object.assign(w.contacts[0].entity!, secrets);
    Object.assign(w.profile!, secrets);
    const output = JSON.stringify(exportWorkspace(w));
    for (const value of Object.values(secrets))
      expect(output).not.toContain(value);
    expect(output).toContain("Private note");
  });
  it("retains CRM text as data and protects CSV formulas", () => {
    const w = fixture();
    w.contacts[0].private_email = "";
    w.contacts[0].entity = null;
    w.contacts[0].private_display_name = '=HYPERLINK("https://example.test")';
    w.notes[0].body = "<script>alert(1)</script>";
    const csv = parseCsv(exportCsv(w)).rows[0];
    expect(csv.name).toMatch(/^'=/);
    expect(csv.notes).toBe(w.notes[0].body);
    expect(csv.follow_up).toBe("2026-10-10");
    expect(csv.outreach).toBe("follow_up_needed");
  });
  it("requests the full workspace and returns a noncached attachment", async () => {
    mocks.workspace.mockResolvedValue(fixture());
    const response = await GET(
      new Request("https://musicmail.vercel.app/api/export?format=json"),
    );
    expect(mocks.workspace).toHaveBeenCalledWith(true);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect((await response.json()).notes).toHaveLength(1);
  });
  it("requires workspace authorization", async () => {
    mocks.workspace.mockRejectedValue(new ApiError("Please sign in.", 401));
    const response = await GET(
      new Request("https://musicmail.vercel.app/api/export?format=json"),
    );
    expect(response.status).toBe(401);
  });
});
