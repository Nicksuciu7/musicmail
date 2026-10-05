import "server-only";
import { cookies } from "next/headers";
import { demoEnabled, supabase } from "./supabase";
import { parseTheme, type Theme } from "../theme";
export async function initialTheme(): Promise<Theme> {
  const jar = await cookies();
  const local = parseTheme(jar.get("musicmail-theme")?.value);
  if (demoEnabled()) return local;
  const db = await supabase();
  const { data } = await db.auth.getUser();
  if (!data.user) return local;
  const { data: profile } = await db
    .from("profiles")
    .select("theme")
    .eq("id", data.user.id)
    .maybeSingle();
  return parseTheme(profile?.theme);
}
