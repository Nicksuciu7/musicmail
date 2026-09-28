import { NextResponse } from "next/server";
import { supabase } from "@/lib/server/supabase";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const db = await supabase();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const prefs = await db
        .from("user_preferences")
        .select("onboarding_completed")
        .eq("user_id", data.user.id)
        .maybeSingle();
      return NextResponse.redirect(
        new URL(
          prefs.data?.onboarding_completed ? "/home" : "/onboarding",
          process.env.NEXT_PUBLIC_APP_URL,
        ),
      );
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=callback", process.env.NEXT_PUBLIC_APP_URL),
  );
}
