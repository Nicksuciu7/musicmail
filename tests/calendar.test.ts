import { describe, it, expect } from "vitest";
import ICAL from "ical.js";
import {
  normaliseEvent,
  eventToInput,
  eventDate,
  eventLastDate,
  monthDays,
  calendarDate,
  type CalendarEvent,
} from "../src/lib/calendar";
import { eventICS, googleCalendarURL } from "../src/lib/calendar-export";
import { exportWorkspace } from "../src/lib/export";
import { demoWorkspace } from "../src/lib/fixtures";
import { parseTheme } from "../src/lib/theme";
const id = "30000000-0000-4000-8000-000000000001";
function fixture(input: Record<string, unknown> = {}): CalendarEvent {
  const v = normaliseEvent({
    title: "Night at the Lantern Room",
    date: "2026-10-12",
    start_time: "19:30",
    end_time: "22:00",
    location_name: "Lantern Room",
    address: "Fictional Street",
    notes: "Private notes",
    ...input,
  });
  return {
    ...v.event,
    id,
    workspace_id: id,
    created_at: "2026-10-05T10:00:00Z",
    updated_at: "2026-10-05T11:00:00Z",
    items: v.items.map((i, n) => ({
      ...i,
      id: `40000000-0000-4000-8000-00000000000${n}`,
      workspace_id: id,
      event_id: id,
      sort_order: n,
      created_at: "2026-10-05T10:00:00Z",
      updated_at: "2026-10-05T10:00:00Z",
    })),
  };
}
describe("calendar dates and validation", () => {
  it("creates a date-only event from just title and date", () => {
    const e = normaliseEvent({ title: "Quick gig", date: "2026-10-12" }).event;
    expect(e).toMatchObject({
      all_day: true,
      starts_at: null,
      ends_at: null,
      start_date: "2026-10-12",
      end_date: "2026-10-13",
      event_type: "Gig",
    });
  });
  it.each([
    "2026-02-29",
    "2026-13-01",
    "2026-00-01",
    "2201-01-01",
    "2026-10-12T10:00Z",
  ])("rejects invalid date %s", (date) =>
    expect(calendarDate.safeParse(date).success).toBe(false),
  );
  it("converts BST to exact UTC and provides one-hour default", () => {
    const e = fixture({ end_time: "" });
    expect(e.starts_at).toBe("2026-10-12T18:30:00Z");
    expect(e.ends_at).toBe("2026-10-12T19:30:00Z");
  });
  it("uses winter GMT", () => {
    expect(fixture({ date: "2026-12-12" }).starts_at).toBe(
      "2026-12-12T19:30:00Z",
    );
  });
  it("rejects a skipped spring clock time", () =>
    expect(() =>
      fixture({ date: "2026-03-29", start_time: "01:30", end_time: "03:30" }),
    ).toThrow(/clocks change/));
  it("asks for an explicit choice during the repeated autumn hour", () =>
    expect(() =>
      fixture({ date: "2026-10-25", start_time: "01:30", end_time: "03:30" }),
    ).toThrow(/clocks change/));
  it("supports both explicitly chosen autumn occurrences", () => {
    const base = { date: "2026-10-25", start_time: "01:30", end_time: "03:30" };
    expect(fixture({ ...base, disambiguation: "earlier" }).starts_at).toBe(
      "2026-10-25T00:30:00Z",
    );
    expect(fixture({ ...base, disambiguation: "later" }).starts_at).toBe(
      "2026-10-25T01:30:00Z",
    );
  });
  it("rejects end before start and supports overnight events", () => {
    expect(() => fixture({ end_time: "18:00" })).toThrow(/after start/);
    expect(fixture({ end_time: "02:00", end_date: "2026-10-13" }).ends_at).toBe(
      "2026-10-13T01:00:00Z",
    );
  });
  it("keeps all-day dates stable across DST and viewer zones", () => {
    const e = fixture({
      date: "2026-03-29",
      start_time: "",
      end_time: "",
      all_day: true,
    });
    expect(e.end_date).toBe("2026-03-30");
    expect(eventDate(e, "America/Los_Angeles")).toBe("2026-03-29");
    expect(eventLastDate(e, "Asia/Tokyo")).toBe("2026-03-29");
  });
  it("displays exact timed events in the viewer timezone", () => {
    const e = fixture({ start_time: "00:30", end_time: "01:30" });
    expect(eventDate(e, "America/Los_Angeles")).toBe("2026-10-11");
  });
  it("keeps inclusive UI end dates separate from exclusive all-day storage", () => {
    const e = fixture({
      all_day: true,
      start_time: "",
      end_time: "",
      end_date: "2026-10-14",
    });
    expect(e.end_date).toBe("2026-10-15");
    expect(eventToInput(e).end_date).toBe("2026-10-14");
  });
  it("round-trips repeated-hour edits without moving the event", () => {
    const e = fixture({
      date: "2026-10-25",
      start_time: "01:30",
      end_time: "03:30",
      disambiguation: "later",
    });
    expect(normaliseEvent(eventToInput(e)).event.starts_at).toBe(e.starts_at);
  });
  it("validates timezone, type, bounds and ownership injection", () => {
    for (const patch of [
      { timezone: "not-a-zone" },
      { event_type: "Ticket sale" },
      { title: " " },
      { workspace_id: id },
      { user_id: id },
      { venue_entity_id: "garbage" },
      { ticket_url: "javascript:alert(1)" },
      { ticket_url: "https://user:pass@example.test" },
      { items: [{ label: " " }] },
      { items: [{ label: "mics", quantity: 0 }] },
    ])
      expect(() => fixture(patch)).toThrow();
  });
  it("starts a six-row month grid on Monday", () => {
    const days = monthDays("2026-10");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-09-28");
    expect(days[41]).toBe("2026-11-08");
  });
  it("retains arbitrary equipment, quantities and checked states", () => {
    expect(
      fixture({
        items: [
          { label: "Martin D-28" },
          { label: "mics", quantity: 2, completed: true },
        ],
      }).items,
    ).toMatchObject([
      { label: "Martin D-28", quantity: null, completed: false },
      { label: "mics", quantity: 2, completed: true },
    ]);
  });
});
it("never silently shifts a skipped time, even with an explicit occurrence choice", () => {
  for (const disambiguation of ["earlier", "later"])
    expect(() =>
      fixture({
        date: "2026-03-29",
        start_time: "01:30",
        end_time: "03:30",
        disambiguation,
      }),
    ).toThrow(/clocks change/);
});
it("rejects duplicated checklist IDs before saving", () =>
  expect(() =>
    fixture({
      items: [
        { id, label: "A" },
        { id, label: "B" },
      ],
    }),
  ).toThrow(/once/));
describe("independently parsed calendar exports", () => {
  it("parses UTC instants, stable UID and full event details", () => {
    const e = fixture({
      load_in_time: "17:30",
      items: [{ label: "Martin D-28" }, { label: "mics", quantity: 2 }],
    });
    const component = new ICAL.Component(ICAL.parse(eventICS(e)));
    const vevent = new ICAL.Event(component.getFirstSubcomponent("vevent")!);
    expect(vevent.uid).toBe(id + "@musicmailapp.uk");
    expect(vevent.startDate.toJSDate().toISOString()).toBe(
      "2026-10-12T18:30:00.000Z",
    );
    expect(vevent.endDate.toJSDate().toISOString()).toBe(
      "2026-10-12T21:00:00.000Z",
    );
    expect(vevent.location).toBe("Lantern Room, Fictional Street");
    expect(vevent.description).toContain("2 × mics");
    expect(vevent.description).toContain("Load-in: 17:30");
  });
  it("exports exclusive all-day end dates as DATE, not floating timestamps", () => {
    const e = fixture({ all_day: true, start_time: "", end_time: "" });
    const component = new ICAL.Component(
      ICAL.parse(eventICS(e)),
    ).getFirstSubcomponent("vevent")!;
    const start = component.getFirstPropertyValue("dtstart") as ICAL.Time;
    const end = component.getFirstPropertyValue("dtend") as ICAL.Time;
    expect(start.isDate).toBe(true);
    expect(start.toString()).toBe("2026-10-12");
    expect(end.toString()).toBe("2026-10-13");
  });
  it("escapes line injection, separators, backslashes and UTF-8 folding", () => {
    const title = "🎸,;\\".repeat(45) + "\r\nEND:VEVENT\r\nBEGIN:VEVENT";
    const e = fixture({
      title: title.slice(0, 195),
      notes: "é🎸\\;,".repeat(600) + "\r\nA new line",
    });
    const ics = eventICS(e);
    for (const line of ics.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const root = new ICAL.Component(ICAL.parse(ics));
    expect(root.getAllSubcomponents("vevent")).toHaveLength(1);
    const v = new ICAL.Event(root.getFirstSubcomponent("vevent")!);
    expect(v.summary).toBe(e.title.replace(/\r\n/g, "\n"));
    expect(v.description).toContain(e.notes.replace(/\r\n/g, "\n"));
    expect(ics.endsWith("\r\n")).toBe(true);
  });
  it("prefills Google without requesting OAuth scopes", () => {
    const e = fixture();
    const url = new URL(googleCalendarURL(e));
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe(
      "20261012T183000Z/20261012T210000Z",
    );
    expect(url.searchParams.get("text")).toBe(e.title);
    expect(url.searchParams.get("ctz")).toBe("Europe/London");
    expect(url.searchParams.get("details")).toContain("Private notes");
    expect(url.searchParams.has("scope")).toBe(false);
  });
  it("prefills all-day Google dates with an exclusive end", () => {
    const e = fixture({ all_day: true, start_time: "", end_time: "" });
    expect(new URL(googleCalendarURL(e)).searchParams.get("dates")).toBe(
      "20261012/20261013",
    );
  });
  it("full-account export includes calendar/checklists but no provider fields", () => {
    const w = demoWorkspace(),
      e = fixture({ items: [{ label: "Martin D-28" }] });
    Object.assign(e, { refresh_token: "calendar-token-sentinel" });
    Object.assign(e.items[0], { access_token: "calendar-item-sentinel" });
    w.calendarEvents = [e];
    const exported = exportWorkspace(w);
    expect(exported.formatVersion).toBe(2);
    expect(exported.calendarEvents[0]).toMatchObject({
      title: e.title,
      workspace_id: id,
      items: [{ label: "Martin D-28" }],
    });
    const text = JSON.stringify(exported);
    expect(text).not.toContain("calendar-token-sentinel");
    expect(text).not.toContain("calendar-item-sentinel");
  });
});
describe("theme preference validation", () => {
  it.each(["system", "light", "dark"])("accepts %s", (mode) =>
    expect(parseTheme(mode)).toBe(mode),
  );
  it("defaults absent or invalid preferences to system", () => {
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("auto<script>")).toBe("system");
  });
});
