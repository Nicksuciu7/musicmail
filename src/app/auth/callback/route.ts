import { NextResponse } from "next/server";
import { recoverySession } from "@/lib/server/recovery";
import { supabase, serviceClient } from "@/lib/server/supabase";
import { appOrigin } from "@/lib/server/config";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code && code.length <= 2048) {
    const db = await supabase();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email_confirmed_at) {
      const recovery = await recoverySession(db);
      if (recovery) {
        const result = await serviceClient()
          .from("recovery_grants")
          .insert({
            session_id: recovery.sessionId,
            user_id: recovery.userId,
            expires_at: new Date(Date.now() + 900000).toISOString(),
          });
        if (!result.error)
          return NextResponse.redirect(
            new URL("/reset-password?recovery=1", appOrigin()),
          );
        return NextResponse.redirect(
          new URL("/login?error=callback", appOrigin()),
        );
      }
      const prefs = await db
        .from("user_preferences")
        .select("onboarding_completed")
        .eq("user_id", data.user.id)
        .maybeSingle();
      return NextResponse.redirect(
        new URL(
          prefs.data?.onboarding_completed ? "/home" : "/onboarding",
          appOrigin(),
        ),
      );
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", appOrigin()));
}
