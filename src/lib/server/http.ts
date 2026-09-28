import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
export function errorResponse(error: unknown) {
  const message =
    error instanceof ZodError
      ? error.issues.map((i) => i.message).join("; ")
      : error instanceof Error
        ? error.message
        : "Something went wrong. Please try again.";
  return NextResponse.json(
    { error: message },
    { status: message.includes("sign in") ? 401 : 400 },
  );
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !expected || new URL(expected).origin !== origin)
    throw new Error("Request origin could not be verified.");
}
export async function body(request: Request) {
  assertOrigin(request);
  const raw = await request.text();
  if (raw.length > 2_000_000) throw new Error("Request is too large.");
  return JSON.parse(raw);
}
