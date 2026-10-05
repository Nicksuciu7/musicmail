import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
export const eventTypes = [
  "Gig",
  "Rehearsal",
  "Recording",
  "Meeting",
  "Travel",
  "Other",
] as const;
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    try {
      Temporal.PlainDate.from(v);
      return v >= "1900-01-01" && v <= "2200-12-31";
    } catch {
      return false;
    }
  }, "Choose a valid date between 1900 and 2200.");
export const calendarTimezone = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return v.includes("/") || v === "UTC";
    } catch {
      return false;
    }
  }, "Choose an IANA time zone, such as Europe/London.");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .or(z.literal(""));
const text = (max: number) => z.string().trim().max(max).default("");
const link = z.string().uuid().nullable().default(null);
export const itemInput = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(1).max(999).nullable().default(null),
    completed: z.boolean().default(false),
  })
  .strict();
export const eventInput = z
  .object({
    title: z.string().trim().min(1, "Give the event a title.").max(200),
    event_type: z.enum(eventTypes).default("Gig"),
    date: calendarDate,
    end_date: calendarDate.optional(),
    start_time: time.default(""),
    end_time: time.default(""),
    all_day: z.boolean().default(false),
    timezone: calendarTimezone.default("Europe/London"),
    location_name: text(200),
    address: text(500),
    venue_entity_id: link,
    contact_id: link,
    artist_entity_id: link,
    promoter: text(200),
    load_in_time: time.default(""),
    soundcheck_time: time.default(""),
    doors_time: time.default(""),
    stage_time: time.default(""),
    fee: text(100),
    ticket_url: text(2000).refine(
      (v) =>
        !v ||
        (/^https?:\/\//i.test(v) &&
          (() => {
            try {
              const u = new URL(v);
              return !u.username && !u.password;
            } catch {
              return false;
            }
          })()),
      "Use a full http or https ticket URL without credentials.",
    ),
    notes: text(10000),
    items: z.array(itemInput).max(100).default([]),
    disambiguation: z.enum(["reject", "earlier", "later"]).default("reject"),
  })
  .strict();
export type EventInput = z.input<typeof eventInput>;
export type CalendarItem = {
  id: string;
  event_id: string;
  workspace_id: string;
  user_id?: string | null;
  label: string;
  quantity: number | null;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
export type CalendarEvent = {
  id: string;
  workspace_id: string;
  user_id?: string | null;
  title: string;
  event_type: (typeof eventTypes)[number];
  start_date: string;
  end_date: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  timezone: string;
  location_name: string;
  address: string;
  venue_entity_id: string | null;
  contact_id: string | null;
  artist_entity_id: string | null;
  promoter: string;
  load_in_at: string | null;
  soundcheck_at: string | null;
  doors_at: string | null;
  stage_at: string | null;
  fee: string;
  ticket_url: string;
  notes: string;
  created_at: string;
  updated_at: string;
  items: CalendarItem[];
};
export type EventRecord = Omit<
  CalendarEvent,
  "id" | "workspace_id" | "user_id" | "created_at" | "updated_at" | "items"
>;
export function normaliseEvent(input: unknown): {
  event: EventRecord;
  items: z.infer<typeof itemInput>[];
} {
  const v = eventInput.parse(input);
  const allDay = v.all_day || !v.start_time;
  const ids = v.items.flatMap((i) => (i.id ? [i.id] : []));
  if (new Set(ids).size !== ids.length)
    throw new Error("A checklist item can only appear once.");
  const instant = (date: string, t: string) => {
    try {
      const local = Temporal.PlainDateTime.from(`${date}T${t}`);
      const zoned = local.toZonedDateTime(v.timezone, {
        disambiguation: v.disambiguation,
      });
      if (!zoned.toPlainDateTime().equals(local))
        throw new Error("Skipped local time");
      return zoned.toInstant().toString();
    } catch {
      throw new Error(
        "This time is skipped or repeated when the clocks change. Choose another time, or select the earlier/later occurrence in More options.",
      );
    }
  };
  if (!allDay && v.end_time && (v.end_date || v.date) < v.date)
    throw new Error("The end date must follow the start date.");
  if (allDay && v.end_time)
    throw new Error("Remove the end time for an all-day event.");
  if (allDay && v.end_date && v.end_date < v.date)
    throw new Error("The end date must follow the start date.");
  const start = allDay ? null : instant(v.date, v.start_time);
  const end = allDay
    ? null
    : v.end_time
      ? instant(v.end_date || v.date, v.end_time)
      : Temporal.Instant.from(start!).add({ hours: 1 }).toString();
  if (start && end && Temporal.Instant.compare(start, end) >= 0)
    throw new Error(
      "End time must be after start time. For overnight events, set the end date in More options.",
    );
  if (!allDay && v.end_date && !v.end_time)
    throw new Error("Add an end time when setting a separate end date.");
  const lastDate = allDay
    ? v.end_date || v.date
    : Temporal.Instant.from(end!)
        .toZonedDateTimeISO(v.timezone)
        .toPlainDate()
        .toString();
  const timing = (t: string) =>
    v.event_type === "Gig" && t ? instant(v.date, t) : null;
  return {
    event: {
      title: v.title,
      event_type: v.event_type,
      start_date: v.date,
      end_date: allDay
        ? Temporal.PlainDate.from(lastDate).add({ days: 1 }).toString()
        : lastDate,
      starts_at: start,
      ends_at: end,
      all_day: allDay,
      timezone: v.timezone,
      location_name: v.location_name,
      address: v.address,
      venue_entity_id: v.venue_entity_id,
      contact_id: v.contact_id,
      artist_entity_id: v.artist_entity_id,
      promoter: v.promoter,
      load_in_at: timing(v.load_in_time),
      soundcheck_at: timing(v.soundcheck_time),
      doors_at: timing(v.doors_time),
      stage_at: timing(v.stage_time),
      fee: v.fee,
      ticket_url: v.ticket_url,
      notes: v.notes,
    },
    items: v.items,
  };
}
export function eventDate(e: CalendarEvent, zone: string) {
  return e.all_day
    ? e.start_date
    : Temporal.Instant.from(e.starts_at!)
        .toZonedDateTimeISO(zone)
        .toPlainDate()
        .toString();
}
export function eventLastDate(e: CalendarEvent, zone: string) {
  return e.all_day
    ? Temporal.PlainDate.from(e.end_date).subtract({ days: 1 }).toString()
    : Temporal.Instant.from(e.ends_at!)
        .subtract({ nanoseconds: 1 })
        .toZonedDateTimeISO(zone)
        .toPlainDate()
        .toString();
}
export function todayIn(zone: string) {
  return Temporal.Now.zonedDateTimeISO(zone).toPlainDate().toString();
}
export function dateLabel(date: string, year = false) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...(year ? { year: "numeric" as const } : {}),
  }).format(new Date(date + "T12:00:00Z"));
}
export function timeLabel(timestamp: string, zone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
  }).format(new Date(timestamp));
}
export function eventTime(e: CalendarEvent, zone: string) {
  return e.all_day
    ? "All day"
    : `${timeLabel(e.starts_at!, zone)}–${timeLabel(e.ends_at!, zone)}`;
}
export function monthDays(month: string) {
  const first = Temporal.PlainDate.from(month + "-01");
  const start = first.subtract({ days: first.dayOfWeek - 1 });
  return Array.from({ length: 42 }, (_, i) =>
    start.add({ days: i }).toString(),
  );
}
export function eventToInput(e: CalendarEvent): EventInput {
  const local = (s: string | null) =>
    s
      ? Temporal.Instant.from(s)
          .toZonedDateTimeISO(e.timezone)
          .toPlainTime()
          .toString()
          .slice(0, 5)
      : "";
  return {
    title: e.title,
    event_type: e.event_type,
    date: e.start_date,
    end_date: e.all_day
      ? Temporal.PlainDate.from(e.end_date).subtract({ days: 1 }).toString()
      : e.end_date,
    start_time: local(e.starts_at),
    end_time: local(e.ends_at),
    all_day: e.all_day,
    timezone: e.timezone,
    location_name: e.location_name,
    address: e.address,
    venue_entity_id: e.venue_entity_id,
    contact_id: e.contact_id,
    artist_entity_id: e.artist_entity_id,
    promoter: e.promoter,
    load_in_time: local(e.load_in_at),
    soundcheck_time: local(e.soundcheck_at),
    doors_time: local(e.doors_at),
    stage_time: local(e.stage_at),
    fee: e.fee,
    ticket_url: e.ticket_url,
    notes: e.notes,
    items: e.items.map((i) => ({
      id: i.id,
      label: i.label,
      quantity: i.quantity,
      completed: i.completed,
    })),
    disambiguation:
      e.starts_at &&
      Temporal.Instant.from(e.starts_at).toZonedDateTimeISO(e.timezone)
        .offset ===
        Temporal.PlainDateTime.from(
          `${e.start_date}T${local(e.starts_at)}`,
        ).toZonedDateTime(e.timezone, { disambiguation: "later" }).offset
        ? "later"
        : "earlier",
  };
}
