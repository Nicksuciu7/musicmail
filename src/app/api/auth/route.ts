import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase, demoEnabled } from "@/lib/server/supabase";
import { body, errorResponse } from "@/lib/server/http";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const input = z
      .object({
        action: z.enum(["login", "signup", "google", "logout"]),
        email: z.email().optional(),
        password: z.string().min(8).max(200).optional(),
      })
      .parse(await body(request));
    if (demoEnabled()) {
      if (input.action === "logout") {
        (await cookies()).delete("musicmail-demo");
        return NextResponse.json({ url: "/login" });
      }
      return NextResponse.json({ url: "/onboarding" });
    }
    const db = await supabase();
    const redirectTo = new URL(
      "/auth/callback",
      process.env.NEXT_PUBLIC_APP_URL,
    ).toString();
    if (input.action === "logout") {
      await db.auth.signOut();
      return NextResponse.json({ url: "/login" });
    }
    if (input.action === "google") {
      const { data, error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw new Error("Google sign-in could not start.");
      return NextResponse.json({ url: data.url });
    }
    if (!input.email || !input.password)
      throw new Error("Email and password are required.");
    const result =
      input.action === "signup"
        ? await db.auth.signUp({
            email: input.email,
            password: input.password,
            options: { emailRedirectTo: redirectTo },
          })
        : await db.auth.signInWithPassword({
            email: input.email,
            password: input.password,
          });
    if (result.error)
      throw new Error(
        "Unable to sign in. Check your details or confirm your email.",
      );
    const prefs =
      result.data.session && result.data.user
        ? await db
            .from("user_preferences")
            .select("onboarding_completed")
            .eq("user_id", result.data.user.id)
            .maybeSingle()
        : null;
    return NextResponse.json(
      result.data.session
        ? { url: prefs?.data?.onboarding_completed ? "/home" : "/onboarding" }
        : {
            message: "Check your email to confirm your account, then sign in.",
          },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
