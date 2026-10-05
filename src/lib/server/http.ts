import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { appOrigin } from "./config";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  const status = error instanceof ApiError ? error.status : 400;
  const message =
    error instanceof ZodError
      ? error.issues.map((i) => i.message).join("; ")
      : error instanceof ApiError
        ? error.message
        : "Unable to complete this request. Please try again.";
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(error instanceof ApiError && error.retryAfter
          ? { "Retry-After": String(error.retryAfter) }
          : {}),
      },
    },
  );
}
export function assertOrigin(request: Request) {
  if (request.headers.get("origin") !== appOrigin())
    throw new ApiError("Request origin could not be verified.");
}
export async function body(request: Request, limit = 2_000_000) {
  assertOrigin(request);
  if (Number(request.headers.get("content-length")) > limit)
    throw new ApiError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError("Request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    data.set(c, offset);
    offset += c.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch {
    throw new ApiError("Request must contain valid UTF-8 JSON.");
  }
}
