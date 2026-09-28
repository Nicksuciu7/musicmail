import { NextResponse } from "next/server";
import { z } from "zod";
import { identity, supabase, checked } from "@/lib/server/supabase";
import { readDemo } from "@/lib/server/demo";
import { errorResponse } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(new URL(request.url).searchParams.get("page") || 1);
    const u = await identity();
    if (u.demo) {
      const sent = readDemo(u.id).sent;
      return NextResponse.json({
        items: sent.slice((page - 1) * 20, page * 20),
        total: sent.length,
      });
    }
    const result = await (
      await supabase()
    )
      .from("sent_emails")
      .select("*", { count: "exact" })
      .order("sent_at", { ascending: false })
      .range((page - 1) * 20, page * 20 - 1);
    return NextResponse.json(
      { items: checked(result), total: result.count || 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
