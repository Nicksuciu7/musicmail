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

export function canonicalRedirect(requestUrl: string, method: string) {
  if (!process.env.VERCEL || !["GET", "HEAD"].includes(method)) return null;
  const source = new URL(requestUrl);
  const destination = new URL(appOrigin());
  const knownOrigins = [
    "https://musicmail.vercel.app",
    "https://app.musicmailapp.uk",
  ];
  if (
    !knownOrigins.includes(source.origin) ||
    !knownOrigins.includes(destination.origin) ||
    source.origin === destination.origin
  )
    return null;
  // Assign the path, rather than resolving it: //evil.example stays a path.
  destination.pathname = source.pathname;
  destination.search = source.search;
  return destination;
}
