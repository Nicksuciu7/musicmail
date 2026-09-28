import { NextResponse } from "next/server";
import { identity, supabase, checked } from "@/lib/server/supabase";
import { readDemo } from "@/lib/server/demo";
import { filterSchema, matchesContact, contactName } from "@/lib/domain";
import { errorResponse } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("filters");
    const filters = filterSchema.parse(raw ? JSON.parse(raw) : {});
    const user = await identity();
    if (user.demo) {
      const w = readDemo(user.id);
      const contacts = w.contacts
        .filter((c) =>
          matchesContact(
            c,
            filters,
            w.members,
            new Date().toLocaleDateString("en-CA", {
              timeZone: w.profile?.timezone || "Europe/London",
            }),
          ),
        )
        .sort((a, b) =>
          filters.sort === "recent"
            ? b.created_at.localeCompare(a.created_at)
            : contactName(a).localeCompare(contactName(b)),
        );
      return NextResponse.json({
        items: contacts.slice((filters.page - 1) * 12, filters.page * 12),
        total: contacts.length,
      });
    }
    return NextResponse.json(
      checked(await (await supabase()).rpc("network_contacts", { filters })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
