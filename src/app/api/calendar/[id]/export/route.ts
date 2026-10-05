import { calendarEvent } from "@/lib/server/calendar";
import { eventICS } from "@/lib/calendar-export";
import { errorResponse } from "@/lib/server/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const e = await calendarEvent(id);
    return new Response(eventICS(e), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="musicmail-${e.id}.ics"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
