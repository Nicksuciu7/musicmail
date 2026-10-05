import "server-only";
import { redirect } from "next/navigation";
import { supabase, demoEnabled } from "./supabase";
export async function requirePageUser() {
  if (demoEnabled()) return;
  const db = await supabase();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user?.email_confirmed_at) redirect("/login");
}
