import { NextResponse } from "next/server";
import { discover } from "@/lib/server/repository";
import { filterSchema } from "@/lib/domain";
import { errorResponse } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("filters");
    return NextResponse.json(
      await discover(filterSchema.parse(raw ? JSON.parse(raw) : {})),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
