import { z } from "zod";
import { appOrigin } from "@/lib/server/config";
import { rateLimit } from "@/lib/server/rate-limit";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { identity } from "@/lib/server/supabase";
import { exchangeCode } from "@/lib/server/gmail";
export async function GET(request: Request) {
  const jar = await cookies();
  const raw = jar.get("musicmail-oauth")?.value;
  jar.set("musicmail-oauth", "", { path: "/api/gmail", maxAge: 0 });
  try {
    const user = await identity();
    if (user.demo) throw new Error();
    await rateLimit("gmail-callback", user.id, 10, 600);
    const url = new URL(request.url);
    const state = url.searchParams.get("state") || "",
      code = url.searchParams.get("code");
    if (!raw || !code || url.searchParams.has("error")) throw new Error();
    if (code.length > 2048) throw new Error();
    const saved = z
      .object({
        userId: z.uuid(),
        state: z.string().max(128),
        verifier: z.string().max(128),
        expires: z.number(),
      })
      .parse(JSON.parse(raw));
    if (
      saved.userId !== user.id ||
      saved.expires < Date.now() ||
      state.length !== saved.state.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))
    )
      throw new Error();
    await exchangeCode(user.id, code, saved.verifier);
    return NextResponse.redirect(
      new URL("/settings?gmail=connected", appOrigin()),
    );
  } catch {
    console.error(
      JSON.stringify({ event: "oauth_failure", category: "gmail_callback" }),
    );
    return NextResponse.redirect(
      new URL("/settings?gmail=failed", appOrigin()),
    );
  }
}
