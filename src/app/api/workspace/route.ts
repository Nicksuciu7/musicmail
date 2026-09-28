import { z } from "zod";
import { identity, supabase, checked } from "@/lib/server/supabase";
import { readDemo } from "@/lib/server/demo";
import { NextResponse } from "next/server";
import { workspace, mutate } from "@/lib/server/repository";
import { actionSchema } from "@/lib/domain";
import { body, errorResponse } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ids = z
      .array(z.uuid())
      .max(10)
      .parse(
        url.searchParams.get("contactIds")?.split(",").filter(Boolean) || [],
      );
    if (url.searchParams.has("entityId")) {
      const entityId = z.uuid().parse(url.searchParams.get("entityId"));
      const user = await identity();
      if (user.demo) {
        const c = readDemo(user.id).contacts.find(
          (c) => c.entity_id === entityId && !c.archived,
        );
        if (c) ids.push(c.id);
      } else {
        const row = checked(
          await (
            await supabase()
          )
            .from("user_contacts")
            .select("id")
            .eq("entity_id", entityId)
            .eq("archived", false)
            .maybeSingle(),
        );
        if (row) ids.push(row.id);
      }
    }
    return NextResponse.json(await workspace(false, ids), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    return NextResponse.json(
      await mutate(actionSchema.parse(await body(request))),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
