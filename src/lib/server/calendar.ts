import "server-only";
import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { identity, supabase, checked } from "./supabase";
import { readDemo, writeDemo } from "./demo";
import { entities } from "../fixtures";
import { ApiError } from "./http";
import { rateLimit } from "./rate-limit";
import {
  normaliseEvent,
  calendarDate,
  calendarTimezone,
  eventDate,
  eventLastDate,
  type CalendarEvent,
} from "../calendar";
export const calendarQuery = z
  .object({
    from: calendarDate,
    to: calendarDate,
    timezone: calendarTimezone,
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .refine(
    (v) =>
      v.to > v.from &&
      Temporal.PlainDate.from(v.to).since(Temporal.PlainDate.from(v.from))
        .days <= 366,
    "Choose a range of up to one year.",
  );
export async function calendarEvents(
  query?: z.infer<typeof calendarQuery>,
): Promise<CalendarEvent[]> {
  const user = await identity();
  let events: CalendarEvent[];
  if (user.demo) events = readDemo(user.id).calendarEvents || [];
  else {
    await rateLimit("calendar-read", user.id, 180, 60);
    const db = await supabase();
    let q = db
      .from("calendar_events")
      .select("*,items:calendar_event_items(*)")
      .order("start_date")
      .order("id");
    if (query) {
      const start = Temporal.PlainDate.from(query.from)
          .toZonedDateTime(query.timezone)
          .toInstant()
          .toString(),
        end = Temporal.PlainDate.from(query.to)
          .toZonedDateTime(query.timezone)
          .toInstant()
          .toString();
      q = q
        .eq("workspace_id", user.id)
        .or(
          `and(all_day.eq.true,start_date.lt.${query.to},end_date.gt.${query.from}),and(all_day.eq.false,starts_at.lt.${end},ends_at.gt.${start})`,
        )
        .range(query.offset, query.offset + 99);
    }
    // Full export is explicitly paged, so Supabase's default row cap cannot silently
    // discard calendar events or their equipment lists.
    if (query) events = checked(await q) as CalendarEvent[];
    else {
      events = [];
      for (let offset = 0; ; offset += 500) {
        const page = checked(
          await q.range(offset, offset + 499),
        ) as CalendarEvent[];
        events.push(...page);
        if (page.length < 500) break;
      }
    }
  }
  events = events.map((e) => ({
    ...e,
    items: [...e.items].sort(
      (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
    ),
  }));
  if (query && user.demo)
    events = events
      .filter(
        (e) =>
          eventDate(e, query.timezone) < query.to &&
          eventLastDate(e, query.timezone) >= query.from,
      )
      .sort(
        (a, b) =>
          a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id),
      )
      .slice(query.offset, query.offset + 100);
  return events;
}
export async function calendarEvent(id: string) {
  z.string().uuid().parse(id);
  const user = await identity();
  if (!user.demo) await rateLimit("calendar-read", user.id, 180, 60);
  const e = user.demo
    ? (readDemo(user.id).calendarEvents || []).find((e) => e.id === id)
    : (checked(
        await (
          await supabase()
        )
          .from("calendar_events")
          .select("*,items:calendar_event_items(*)")
          .eq("id", id)
          .eq("workspace_id", user.id)
          .maybeSingle(),
      ) as CalendarEvent | null);
  if (!e) throw new ApiError("Event unavailable.", 404);
  return {
    ...e,
    items: [...e.items].sort((a, b) => a.sort_order - b.sort_order),
  };
}
export async function saveEvent(input: unknown, id?: string) {
  const user = await identity();
  if (id) z.string().uuid().parse(id);
  let value: ReturnType<typeof normaliseEvent>;
  try {
    value = normaliseEvent(input);
  } catch (e) {
    throw new ApiError((e as Error).message);
  }
  if (user.demo) {
    const w = readDemo(user.id),
      all = w.calendarEvents || [];
    const old = id ? all.find((e) => e.id === id) : undefined;
    if (id && !old) throw new ApiError("Event unavailable.", 404);
    const v = value.event;
    if (v.contact_id && !w.contacts.some((c) => c.id === v.contact_id))
      throw new ApiError("Contact unavailable.");
    if (
      v.venue_entity_id &&
      !entities.some(
        (e) => e.id === v.venue_entity_id && e.entity_type === "venue",
      )
    )
      throw new ApiError("Venue unavailable.");
    if (v.artist_entity_id && v.artist_entity_id !== w.artist?.id)
      throw new ApiError("Project unavailable.");
    if (
      value.items.some(
        (i) => i.id && !old?.items.some((old) => old.id === i.id),
      )
    )
      throw new ApiError("Checklist item unavailable.");
    const eid = id || crypto.randomUUID(),
      now = new Date().toISOString();
    const event: CalendarEvent = {
      ...v,
      id: eid,
      workspace_id: user.id,
      user_id: old?.user_id || user.id,
      created_at: old?.created_at || now,
      updated_at: now,
      items: value.items.map((i, sort_order) => ({
        ...i,
        id: i.id || crypto.randomUUID(),
        event_id: eid,
        workspace_id: user.id,
        user_id: user.id,
        sort_order,
        created_at: old?.items.find((o) => o.id === i.id)?.created_at || now,
        updated_at: now,
      })),
    };
    w.calendarEvents = [...all.filter((e) => e.id !== eid), event];
    writeDemo(user.id, w);
    return event;
  }
  await rateLimit("calendar-write", user.id, 120, 60);
  const eid = checked(
    await (
      await supabase()
    ).rpc("save_calendar_event", {
      event_id: id || null,
      payload: value.event,
      checklist: value.items,
    }),
  );
  return calendarEvent(eid);
}
export async function deleteEvent(id: string) {
  const user = await identity();
  await calendarEvent(id);
  if (user.demo) {
    const w = readDemo(user.id);
    w.calendarEvents = (w.calendarEvents || []).filter((e) => e.id !== id);
    writeDemo(user.id, w);
  } else {
    await rateLimit("calendar-write", user.id, 120, 60);
    checked(
      await (
        await supabase()
      )
        .from("calendar_events")
        .delete()
        .eq("id", id)
        .eq("workspace_id", user.id),
    );
  }
}
export async function checkItem(
  eventId: string,
  itemId: string,
  completed: boolean,
) {
  z.string().uuid().parse(itemId);
  const user = await identity();
  const e = await calendarEvent(eventId);
  const item = e.items.find((i) => i.id === itemId);
  if (!item) throw new ApiError("Checklist item unavailable.", 404);
  if (user.demo) {
    const w = readDemo(user.id);
    w.calendarEvents = (w.calendarEvents || []).map((old) =>
      old.id === eventId
        ? {
            ...old,
            items: old.items.map((i) =>
              i.id === itemId ? { ...i, completed } : i,
            ),
          }
        : old,
    );
    writeDemo(user.id, w);
  } else {
    await rateLimit("calendar-write", user.id, 120, 60);
    checked(
      await (
        await supabase()
      )
        .from("calendar_event_items")
        .update({ completed })
        .eq("workspace_id", user.id)
        .eq("event_id", eventId)
        .eq("id", itemId),
    );
  }
  return calendarEvent(eventId);
}
