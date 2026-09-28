import { workspace } from "@/lib/server/repository";
import { exportCsv } from "@/lib/csv";
import { errorResponse } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    const w = await workspace(true);
    const json = new URL(request.url).searchParams.get("format") === "json";
    return new Response(json ? JSON.stringify(w, null, 2) : exportCsv(w), {
      headers: {
        "Content-Type": json ? "application/json" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="musicmail-export.${json ? "json" : "csv"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
