import type { CalendarEvent } from "./calendar";
import { timeLabel } from "./calendar";
// Provider boundary: manual exports today; explicit account-level consent and
// selection will be required before any future sync adapter is added.
export interface CalendarExportProvider {
  name: string;
  export(event: CalendarEvent): string;
}
const stamp = (v: string) =>
  new Date(v)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function eventDetails(e: CalendarEvent) {
  return [
    e.event_type,
    e.notes,
    e.promoter && `Promoter: ${e.promoter}`,
    e.fee && `Fee: ${e.fee}`,
    e.ticket_url && `Tickets: ${e.ticket_url}`,
    ...(
      [
        ["Load-in", e.load_in_at],
        ["Soundcheck", e.soundcheck_at],
        ["Doors", e.doors_at],
        ["Stage", e.stage_at],
      ] as const
    ).flatMap(([n, v]) =>
      v ? [`${n}: ${timeLabel(v, e.timezone)} (${e.timezone})`] : [],
    ),
    e.items.length &&
      `What to bring:\n${e.items.map((i) => `${i.completed ? "[x]" : "[ ]"} ${i.quantity ? `${i.quantity} × ` : ""}${i.label}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
const escapeText = (v: string) =>
  v
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
export function foldLine(v: string) {
  let out = "",
    line = "",
    bytes = 0;
  for (const c of v) {
    const size = new TextEncoder().encode(c).length;
    if (bytes + size > 75) {
      out += line + "\r\n";
      line = " ";
      bytes = 1;
    }
    line += c;
    bytes += size;
  }
  return out + line;
}
export function eventICS(e: CalendarEvent) {
  const dates = e.all_day
    ? [
        `DTSTART;VALUE=DATE:${e.start_date.replaceAll("-", "")}`,
        `DTEND;VALUE=DATE:${e.end_date.replaceAll("-", "")}`,
      ]
    : [`DTSTART:${stamp(e.starts_at!)}`, `DTEND:${stamp(e.ends_at!)}`];
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MusicMail//Workspace Calendar//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${e.id}@musicmailapp.uk`,
      `DTSTAMP:${stamp(e.updated_at)}`,
      `CREATED:${stamp(e.created_at)}`,
      `LAST-MODIFIED:${stamp(e.updated_at)}`,
      ...dates,
      `SUMMARY:${escapeText(e.title)}`,
      `LOCATION:${escapeText([e.location_name, e.address].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${escapeText(eventDetails(e))}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(foldLine)
      .join("\r\n") + "\r\n"
  );
}
export function googleCalendarURL(e: CalendarEvent) {
  const u = new URL("https://calendar.google.com/calendar/render");
  u.search = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: e.all_day
      ? `${e.start_date.replaceAll("-", "")}/${e.end_date.replaceAll("-", "")}`
      : `${stamp(e.starts_at!)}/${stamp(e.ends_at!)}`,
    ctz: e.timezone,
    location: [e.location_name, e.address].filter(Boolean).join(", "),
    details: eventDetails(e).slice(0, 2000),
  }).toString();
  return u.toString();
}
export const icsProvider: CalendarExportProvider = {
  name: "Apple / Outlook (.ics)",
  export: eventICS,
};
export const googleProvider: CalendarExportProvider = {
  name: "Google Calendar",
  export: googleCalendarURL,
};
