import { NextResponse } from "next/server";
import { z } from "zod";
import { checked } from "@/lib/server/supabase";
import { requireAdminRequest } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    const { db } = await requireAdminRequest();
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    return NextResponse.json(checked(await db.rpc("get_entity", { eid: id })), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
