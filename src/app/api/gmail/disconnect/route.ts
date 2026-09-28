import { NextResponse } from "next/server";
import { identity } from "@/lib/server/supabase";
import { disconnect } from "@/lib/server/gmail";
import { body, errorResponse } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    await body(request);
    const user = await identity();
    if (user.demo) return NextResponse.json({ ok: true });
    const revoked = await disconnect(user.id);
    return NextResponse.json({
      ok: true,
      revoked,
      warning: revoked
        ? null
        : "Local tokens removed. Also revoke MusicMail in your Google account permissions.",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
