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
    const url = new URL(request.url);
    const state = url.searchParams.get("state") || "",
      code = url.searchParams.get("code");
    if (!raw || !code || url.searchParams.has("error")) throw new Error();
    const saved = JSON.parse(raw);
    if (
      saved.userId !== user.id ||
      saved.expires < Date.now() ||
      state.length !== saved.state.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))
    )
      throw new Error();
    await exchangeCode(user.id, code, saved.verifier);
    return NextResponse.redirect(
      new URL("/settings?gmail=connected", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch {
    console.error(
      JSON.stringify({ event: "oauth_failure", category: "gmail_callback" }),
    );
    return NextResponse.redirect(
      new URL("/settings?gmail=failed", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
