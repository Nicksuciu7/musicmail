import { recoverySession } from "@/lib/server/recovery";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase, demoEnabled, serviceClient } from "@/lib/server/supabase";
import { body, errorResponse, ApiError } from "@/lib/server/http";
import { appOrigin } from "@/lib/server/config";
import { rateLimit } from "@/lib/server/rate-limit";
import { authSchema } from "@/lib/auth-validation";
import type { AuthError } from "@supabase/supabase-js";
function authError(error: AuthError | null, message: string) {
  if (!error) return;
  if (error.status === 429)
    throw new ApiError(
      "The sign-in service has temporarily limited requests. Please wait before trying again; requesting more emails will not clear the limit.",
      429,
    );
  throw new ApiError(message);
}
export async function POST(request: Request) {
  try {
    const input = authSchema.parse(await body(request, 16000));
    if (demoEnabled()) {
      if (input.action === "logout") {
        (await cookies()).delete("musicmail-demo");
        return NextResponse.json({ url: "/login" });
      }
      throw new ApiError("Authentication is unavailable in the local demo.");
    }
    const db = await supabase();
    const redirectTo = new URL("/auth/callback", appOrigin()).toString();
    if (input.action === "logout") {
      const { error } = await db.auth.signOut({ scope: "local" });
      authError(error, "Unable to sign out. Please retry.");
      return NextResponse.json({ url: "/login" });
    }
    await rateLimit("auth-total", "application", 300, 60);
    if ("email" in input)
      await rateLimit(
        input.action === "login" ? "login" : "auth-email",
        input.email,
        input.action === "login" ? 10 : 3,
        input.action === "login" ? 600 : 3600,
      );
    if (
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
      ["login", "signup", "forgot", "resend"].includes(input.action) &&
      (!("captchaToken" in input) || !input.captchaToken)
    )
      throw new ApiError("Complete the verification challenge.");
    if (input.action === "google") {
      const { data, error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, scopes: "openid email profile" },
      });
      authError(error, "Google sign-in could not start. Please try again.");
      return NextResponse.json({ url: data.url });
    }
    if (input.action === "forgot" || input.action === "resend") {
      const result =
        input.action === "forgot"
          ? await db.auth.resetPasswordForEmail(input.email, {
              redirectTo,
              captchaToken: input.captchaToken,
            })
          : await db.auth.resend({
              type: "signup",
              email: input.email,
              options: {
                emailRedirectTo: redirectTo,
                captchaToken: input.captchaToken,
              },
            });
      if (result.error?.code === "captcha_failed")
        throw new ApiError(
          "Verification failed. Complete a new challenge and try again.",
        );
      if (result.error?.status === 429)
        authError(result.error, "Please try again later.");
      return NextResponse.json({
        message:
          "If this address is eligible, an email will arrive shortly. Check your inbox and spam folder, use the latest link, and avoid repeated requests.",
      });
    }
    if (input.action === "verify") {
      const result = await db.auth.verifyOtp({
        type: "signup",
        token_hash: input.tokenHash,
      });
      authError(
        result.error,
        "This verification link is invalid or expired. Request a new email.",
      );
      return NextResponse.json({ url: "/login?verified=1" });
    }
    if (input.action === "reset") {
      if (input.tokenHash) {
        const result = await db.auth.verifyOtp({
          type: "recovery",
          token_hash: input.tokenHash,
        });
        authError(
          result.error,
          "This reset link is invalid or expired. Request a new email.",
        );
        if (!result.data.user?.email_confirmed_at)
          throw new ApiError("Please verify your email before continuing.");
      } else {
        const proof = await recoverySession(db);
        if (!proof)
          throw new ApiError(
            "This reset link is invalid or expired. Request a new email.",
            403,
          );
        const grant = await serviceClient().rpc("consume_recovery_grant", {
          sid: proof.sessionId,
          uid: proof.userId,
        });
        if (grant.error || grant.data !== true)
          throw new ApiError(
            "This reset link has expired or was already used. Request a new email.",
            403,
          );
      }
      const changed = await db.auth.updateUser({ password: input.password });
      authError(
        changed.error,
        "Unable to reset this password. Request a new reset email and try again.",
      );
      authError(
        (await db.auth.signOut({ scope: "global" })).error,
        "Password changed. Please sign out and sign in again.",
      );
      return NextResponse.json({ url: "/login?reset=1" });
    }
    if (input.action === "change") {
      const current = await db.auth.getUser();
      if (current.error || !current.data.user?.email_confirmed_at)
        throw new ApiError("Please sign in to continue.", 401);
      await rateLimit("password-change", current.data.user.id, 5, 600);
      // Fresh password proof is required even when Supabase considers a 24h session recent.
      const reauth = await db.auth.signInWithPassword({
        email: current.data.user.email!,
        password: input.currentPassword,
        options: { captchaToken: input.captchaToken },
      });
      authError(reauth.error, "Current password could not be verified.");
      if (reauth.data.user?.id !== current.data.user.id)
        throw new ApiError("Account could not be verified.", 403);
      const result = await db.auth.updateUser({
        password: input.password,
        current_password: input.currentPassword,
      });
      authError(
        result.error,
        "Unable to change this password. Check the requirements and try again.",
      );
      authError(
        (await db.auth.signOut({ scope: "global" })).error,
        "Password changed. Please sign out and sign in again.",
      );
      return NextResponse.json({ url: "/login?changed=1" });
    }
    if (input.action === "signup") {
      const result = await db.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: redirectTo,
          captchaToken: input.captchaToken,
          data: { name: input.name },
        },
      });
      authError(
        result.error,
        "Unable to create an account. Check the password requirements or try signing in.",
      );
      // Never grant access from this handler when a project is accidentally autoconfirming.
      if (result.data.session) await db.auth.signOut({ scope: "local" });
      return NextResponse.json({ url: "/verify-email" });
    }
    const result = await db.auth.signInWithPassword({
      email: input.email,
      password: input.password,
      options: { captchaToken: input.captchaToken },
    });
    authError(
      result.error,
      "Unable to sign in with those credentials. Check your email is verified.",
    );
    if (!result.data.user?.email_confirmed_at) {
      await db.auth.signOut();
      throw new ApiError("Please verify your email before signing in.");
    }
    const prefs = await db
      .from("user_preferences")
      .select("onboarding_completed")
      .eq("user_id", result.data.user.id)
      .maybeSingle();
    if (prefs.error)
      throw new ApiError("Unable to load your account. Please try again.", 503);
    return NextResponse.json({
      url: prefs.data?.onboarding_completed ? "/home" : "/onboarding",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
