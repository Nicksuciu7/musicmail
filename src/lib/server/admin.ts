import "server-only";
import { identity, supabase, checked, demoEnabled } from "./supabase";
import { ApiError } from "./http";
import { rateLimit } from "./rate-limit";
import { notFound, redirect } from "next/navigation";

/** Recheck verified Auth identity and trusted database state on every request.
 * is_admin also enforces user_roles.require_aal2 when enabled by a trusted DBA.
 * Metadata, email domains, client flags and demo identity never grant access.
 */
export async function requireAdmin() {
  if (demoEnabled()) throw new ApiError("Administrator access required.", 403);
  const user = await identity();
  if (user.demo) throw new ApiError("Administrator access required.", 403);
  const db = await supabase();
  if (!checked(await db.rpc("is_admin")))
    throw new ApiError("Administrator access required.", 403);
  return { user, db };
}
export async function requireAdminRequest(mutation = false) {
  const result = await requireAdmin();
  await rateLimit(
    mutation ? "admin-write" : "admin-read",
    result.user.id,
    mutation ? 60 : 180,
    60,
  );
  return result;
}
export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    if (error instanceof ApiError && error.status === 403) notFound();
    throw error;
  }
}
