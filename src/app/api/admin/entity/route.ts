import { NextResponse } from "next/server";
import { z } from "zod";
import { identity, supabase, checked } from "@/lib/server/supabase";
import { errorResponse } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    if ((await identity()).demo) throw new Error("Admin unavailable in demo.");
    const db = await supabase();
    if (!checked(await db.rpc("is_admin"))) throw new Error("Admin required.");
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    return NextResponse.json(checked(await db.rpc("get_entity", { eid: id })));
  } catch (e) {
    return errorResponse(e);
  }
}
