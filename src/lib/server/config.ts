import "server-only";
export function appOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error("Application URL is not configured.");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (!local && url.protocol !== "https:") ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw new Error("Application URL is invalid.");
  return url.origin;
}
export function localDemo() {
  if (process.env.MUSICMAIL_DEMO !== "true") return false;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(appOrigin()).hostname,
  );
  if (!local || process.env.VERCEL)
    throw new Error("Demo mode is restricted to local development.");
  return true;
}
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: appOrigin().startsWith("https:"),
    path: "/",
  };
}
