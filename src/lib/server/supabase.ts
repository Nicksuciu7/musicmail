import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { localDemo, sessionCookieOptions } from "./config";
import { ApiError } from "./http";
export const demoEnabled = localDemo;
export async function supabase() {
  const jar = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Supabase is not configured. Follow the local setup in README.",
    );
  return createServerClient(url, key, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server components cannot write cookies; proxy refreshes sessions. */
        }
      },
    },
  });
}
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Server database configuration is missing.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function identity() {
  if (demoEnabled()) {
    const jar = await cookies();
    let id = jar.get("musicmail-demo")?.value;
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
      id = crypto.randomUUID();
      jar.set("musicmail-demo", id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 86400 * 7,
      });
    }
    return { id, email: "Demo workspace", demo: true };
  }
  const db = await supabase();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user || !data.user.email_confirmed_at)
    throw new ApiError(
      "Please sign in with a verified account to continue.",
      401,
    );
  return { id: data.user.id, email: data.user.email || "", demo: false };
}
export function checked<T>(r: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (r.error) {
    console.error(
      JSON.stringify({ event: "database_error", code: "query_failed" }),
    );
    throw new Error("The database could not complete this request.");
  }
  return r.data as NonNullable<T>;
}
