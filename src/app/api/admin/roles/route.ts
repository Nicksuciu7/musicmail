import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRequest } from "@/lib/server/admin";
import { checked } from "@/lib/server/supabase";
import { body, errorResponse } from "@/lib/server/http";
const input = z
  .object({
    userId: z.uuid(),
    role: z.enum(["member", "admin"]),
    confirmed: z.literal(true),
  })
  .strict();
export async function POST(request: Request) {
  try {
    const { db } = await requireAdminRequest(true);
    const data = input.parse(await body(request, 16000));
    checked(
      await db.rpc("admin_change_role", {
        target_user_id: data.userId,
        new_role: data.role,
        confirmed: data.confirmed,
      }),
    );
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
