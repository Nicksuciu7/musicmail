import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRequest } from "@/lib/server/admin";
import { checked } from "@/lib/server/supabase";
import { errorResponse } from "@/lib/server/http";
const query = z.object({
  view: z.enum(["users", "workspaces", "records", "audit"]),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  userId: z.uuid().optional(),
  workspaceId: z.uuid().optional(),
  section: z
    .enum([
      "contacts",
      "notes",
      "lists",
      "list_members",
      "saved_views",
      "interactions",
      "email_metadata",
      "calendar_events",
      "equipment",
      "gmail_status",
    ])
    .optional(),
});
export async function GET(request: Request) {
  try {
    const { db } = await requireAdminRequest();
    const q = query.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    let data;
    if (q.view === "users")
      data = checked(
        await db.rpc("admin_users_page", {
          page_offset: q.offset,
          selected_user_id: q.userId || null,
        }),
      );
    else if (q.view === "workspaces")
      data = checked(
        await db.rpc("admin_workspaces_page", { page_offset: q.offset }),
      );
    else if (q.view === "records") {
      const workspace = z.uuid().parse(q.workspaceId);
      const section = z.string().parse(q.section);
      data = checked(
        await db.rpc("admin_workspace_records", {
          selected_workspace_id: workspace,
          section,
          page_offset: q.offset,
        }),
      );
    } else {
      const result = await db
        .from("admin_audit_log")
        .select(
          "id,admin_user_id,action,target_type,target_id,metadata,created_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(q.offset, q.offset + 49);
      data = { items: checked(result), total: result.count };
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
