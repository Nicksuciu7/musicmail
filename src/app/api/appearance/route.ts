import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { identity, supabase, checked } from "@/lib/server/supabase";
import { sessionCookieOptions } from "@/lib/server/config";
import { body, errorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { themeSchema } from "@/lib/theme";
export async function POST(request: Request) {
  try {
    const { theme } = z
      .object({ theme: themeSchema })
      .strict()
      .parse(await body(request, 1000));
    const user = await identity();
    if (!user.demo) {
      await rateLimit("appearance", user.id, 60, 60);
      checked(
        await (
          await supabase()
        )
          .from("profiles")
          .update({ theme })
          .eq("id", user.id)
          .select("id")
          .single(),
      );
    }
    (await cookies()).set("musicmail-theme", theme, {
      ...sessionCookieOptions(),
      maxAge: 31536000,
    });
    return NextResponse.json(
      { theme },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
