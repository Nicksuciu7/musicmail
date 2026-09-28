import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { identity } from "@/lib/server/supabase";
import { gmailConfig } from "@/lib/server/gmail";
import { errorResponse } from "@/lib/server/http";
export async function GET() {
  try {
    const user = await identity();
    if (user.demo) throw new Error("Gmail is disabled in demo mode.");
    const config = gmailConfig();
    const state = randomBytes(32).toString("base64url"),
      verifier = randomBytes(32).toString("base64url");
    const jar = await cookies();
    jar.set(
      "musicmail-oauth",
      JSON.stringify({
        state,
        userId: user.id,
        verifier,
        expires: Date.now() + 600000,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/api/gmail",
        maxAge: 600,
      },
    );
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callback,
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/gmail.send",
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return NextResponse.redirect(url);
  } catch (e) {
    return errorResponse(e);
  }
}
