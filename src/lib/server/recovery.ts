import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
// getClaims verifies the JWT signature/expiry. Never infer recovery from query
// parameters, SDK redirectType (cookie state), or unverified decoded JWTs.
export async function recoverySession(db: SupabaseClient) {
  const { data, error } = await db.auth.getClaims();
  if (error) return null;
  const parsed = z
    .object({
      sub: z.uuid(),
      session_id: z.uuid(),
      amr: z.array(z.object({ method: z.string(), timestamp: z.number() })),
    })
    .safeParse(data?.claims);
  if (!parsed.success) return null;
  const now = Date.now() / 1000;
  if (
    !parsed.data.amr.some(
      (m) =>
        m.method === "recovery" &&
        m.timestamp > now - 900 &&
        m.timestamp <= now + 60,
    )
  )
    return null;
  const user = await db.auth.getUser();
  if (
    user.error ||
    user.data.user?.id !== parsed.data.sub ||
    !user.data.user.email_confirmed_at
  )
    return null;
  return { userId: parsed.data.sub, sessionId: parsed.data.session_id };
}
