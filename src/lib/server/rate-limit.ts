import "server-only";
import { createHmac } from "node:crypto";
import { serviceClient, demoEnabled } from "./supabase";
import { ApiError } from "./http";
export async function rateLimit(
  scope: string,
  subject: string,
  maximum: number,
  seconds: number,
) {
  if (demoEnabled()) return;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new ApiError("Service unavailable. Please try again later.", 503);
  const digest = createHmac("sha256", key)
    .update(`${scope}:${subject}`)
    .digest("hex");
  const { data, error } = await serviceClient().rpc("consume_request_limit", {
    bucket_key: digest,
    maximum,
    window_seconds: seconds,
  });
  if (error)
    throw new ApiError("Service unavailable. Please try again later.", 503);
  if (data > 0)
    throw new ApiError(
      `Too many attempts. Try again in ${Math.ceil(data / 60)} minute${Math.ceil(data / 60) === 1 ? "" : "s"}.`,
      429,
      data,
    );
}
