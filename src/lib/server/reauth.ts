import "server-only";
import { supabase } from "./supabase";
import { ApiError } from "./http";
import { rateLimit } from "./rate-limit";
export async function requireRecentAuthentication(
  userId: string,
  password?: string,
  captchaToken?: string,
) {
  const db = await supabase();
  const { data, error } = await db.auth.getUser();
  if (error || data.user?.id !== userId)
    throw new ApiError("Please sign in to continue.", 401);
  await rateLimit("sensitive-action", userId, 5, 600);
  if (password) {
    const result = await db.auth.signInWithPassword({
      email: data.user.email!,
      password,
      options: { captchaToken },
    });
    if (result.error || result.data.user?.id !== userId)
      throw new ApiError("Current password could not be verified.", 403);
    return;
  }
  const claims = await db.auth.getClaims();
  const methods = claims.data?.claims.amr;
  if (
    claims.error ||
    claims.data?.claims.sub !== userId ||
    !Array.isArray(methods) ||
    !methods.some(
      (m) =>
        typeof m !== "string" &&
        ["password", "oauth"].includes(m.method) &&
        m.timestamp > Date.now() / 1000 - 300,
    )
  )
    throw new ApiError(
      "Sign out and sign in again before deleting your account.",
      403,
    );
}
