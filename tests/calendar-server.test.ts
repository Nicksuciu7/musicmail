import { beforeEach, it, expect, vi } from "vitest";
import { demoWorkspace, entities } from "../src/lib/fixtures";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  readDemo: vi.fn(),
  writeDemo: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("../src/lib/server/supabase", () => ({
  identity: mocks.identity,
  supabase: vi.fn(),
  checked: vi.fn(),
}));
vi.mock("../src/lib/server/demo", () => ({
  readDemo: mocks.readDemo,
  writeDemo: mocks.writeDemo,
}));
vi.mock("../src/lib/server/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
import {
  saveEvent,
  calendarEvent,
  checkItem,
  deleteEvent,
  calendarEvents,
  calendarQuery,
} from "../src/lib/server/calendar";
import { POST, GET } from "../src/app/api/calendar/route";
import { GET as ICS } from "../src/app/api/calendar/[id]/export/route";
const uid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  mocks.identity.mockResolvedValue({ id: uid, demo: true });
  let w = demoWorkspace();
  w.calendarEvents = [];
  mocks.readDemo.mockImplementation(() => structuredClone(w));
  mocks.writeDemo.mockImplementation((_id, state) => {
    w = structuredClone(state);
  });
});
it("creates, edits and deletes an event and its checklist", async () => {
  const created = await saveEvent({
    title: "Private gig",
    date: "2026-10-12",
    items: [{ label: "Martin D-28" }],
  });
  expect(created.workspace_id).toBe(uid);
  expect(created.user_id).toBe(uid);
  const edited = await saveEvent(
    {
      title: "Updated gig",
      date: "2026-10-13",
      items: [{ id: created.items[0].id, label: "Martin D-28" }],
    },
    created.id,
  );
  expect(edited.created_at).toBe(created.created_at);
  expect(edited.items[0].id).toBe(created.items[0].id);
  await checkItem(created.id, created.items[0].id, true);
  expect((await calendarEvent(created.id)).items[0].completed).toBe(true);
  await deleteEvent(created.id);
  await expect(calendarEvent(created.id)).rejects.toThrow(/unavailable/);
  expect(mocks.readDemo(uid).calendarEvents).toHaveLength(0);
});
it("rejects another demo session's event and item IDs", async () => {
  const created = await saveEvent({
    title: "Private gig",
    date: "2026-10-12",
    items: [{ label: "Guitar" }],
  });
  mocks.readDemo.mockReturnValue({ ...demoWorkspace(), calendarEvents: [] });
  await expect(calendarEvent(created.id)).rejects.toThrow(/unavailable/);
  await expect(
    saveEvent({ title: "Hijack", date: "2026-10-12" }, created.id),
  ).rejects.toThrow(/unavailable/);
  await expect(
    checkItem(created.id, created.items[0].id, true),
  ).rejects.toThrow(/unavailable/);
  await expect(deleteEvent(created.id)).rejects.toThrow(/unavailable/);
});
it("allows a canonical venue without creating or deleting shared entities", async () => {
  const venue = entities.find((e) => e.entity_type === "venue")!;
  const length = entities.length;
  const e = await saveEvent({
    title: "Linked gig",
    date: "2026-10-12",
    venue_entity_id: venue.id,
  });
  expect(e.venue_entity_id).toBe(venue.id);
  await deleteEvent(e.id);
  expect(entities.length).toBe(length);
  expect(entities.find((e) => e.id === venue.id)).toBeDefined();
});
it("rejects cross-workspace contacts/projects and non-venue entities", async () => {
  for (const patch of [
    { contact_id: uid },
    { artist_entity_id: uid },
    { venue_entity_id: entities.find((e) => e.entity_type === "person")!.id },
  ])
    await expect(
      saveEvent({ title: "Gig", date: "2026-10-12", ...patch }),
    ).rejects.toThrow(/unavailable/);
});
it("rejects checklist IDs stolen from a different event", async () => {
  const a = await saveEvent({
    title: "A",
    date: "2026-10-12",
    items: [{ label: "Guitar" }],
  });
  const b = await saveEvent({ title: "B", date: "2026-10-12" });
  await expect(
    saveEvent(
      {
        title: "B",
        date: "2026-10-12",
        items: [{ id: a.items[0].id, label: "Stolen" }],
      },
      b.id,
    ),
  ).rejects.toThrow(/unavailable/);
  expect((await calendarEvent(a.id)).items).toHaveLength(1);
});
it("queries multi-day events overlapping the range and bounds pagination", async () => {
  await saveEvent({
    title: "Tour",
    date: "2026-10-10",
    end_date: "2026-10-15",
  });
  await saveEvent({ title: "Later", date: "2026-11-01" });
  const q = calendarQuery.parse({
    from: "2026-10-12",
    to: "2026-10-13",
    timezone: "Europe/London",
  });
  expect((await calendarEvents(q)).map((e) => e.title)).toEqual(["Tour"]);
  expect(calendarQuery.safeParse({ ...q, to: "2028-10-13" }).success).toBe(
    false,
  );
  expect(calendarQuery.safeParse({ ...q, offset: -1 }).success).toBe(false);
});
it("enforces CSRF and request size before performing a mutation", async () => {
  const data = { action: "save", event: { title: "Gig", date: "2026-10-12" } };
  const request = (origin: string, value: unknown) =>
    new Request("http://localhost:3000/api/calendar", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify(value),
    });
  expect((await POST(request("https://evil.example", data))).status).toBe(400);
  expect(mocks.writeDemo).not.toHaveBeenCalled();
  expect(
    (
      await POST(
        request("http://localhost:3000", {
          ...data,
          event: { ...data.event, notes: "x".repeat(100001) },
        }),
      )
    ).status,
  ).toBe(413);
  expect((await POST(request("http://localhost:3000", data))).status).toBe(200);
});
it("protects reads, exports and mutations with verified identity", async () => {
  mocks.identity.mockRejectedValue(new Error("Authentication required"));
  expect(
    (
      await GET(
        new Request(
          "http://localhost:3000/api/calendar?from=2026-10-12&to=2026-10-13&timezone=Europe/London",
        ),
      )
    ).status,
  ).toBe(400);
  const response = await ICS(new Request("http://localhost:3000"), {
    params: Promise.resolve({ id: uid }),
  });
  expect(response.status).toBe(400);
  await expect(saveEvent({ title: "A", date: "2026-10-12" })).rejects.toThrow(
    /Authentication/,
  );
});
