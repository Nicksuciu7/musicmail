import { NextResponse } from "next/server";
import { z } from "zod";
import { body, errorResponse } from "@/lib/server/http";
import {
  calendarEvents,
  calendarQuery,
  saveEvent,
  deleteEvent,
  checkItem,
} from "@/lib/server/calendar";
const actions = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      id: z.string().uuid().optional(),
      event: z.unknown(),
    })
    .strict(),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal("check"),
      id: z.string().uuid(),
      itemId: z.string().uuid(),
      completed: z.boolean(),
    })
    .strict(),
]);
export async function GET(request: Request) {
  try {
    const query = calendarQuery.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return NextResponse.json(
      { events: await calendarEvents(query) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const v = actions.parse(await body(request, 100000));
    const event =
      v.action === "save"
        ? await saveEvent(v.event, v.id)
        : v.action === "check"
          ? await checkItem(v.id, v.itemId, v.completed)
          : await deleteEvent(v.id);
    return NextResponse.json(
      { event: event || null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
