import { z } from "zod";
import { requireRecentAuthentication } from "@/lib/server/reauth";
import { disconnect } from "@/lib/server/gmail";
import { NextResponse } from "next/server";
import { identity, serviceClient, supabase } from "@/lib/server/supabase";
import { body, errorResponse } from "@/lib/server/http";
import { writeDemo } from "@/lib/server/demo";
import { demoWorkspace } from "@/lib/fixtures";
export async function DELETE(request: Request) {
  try {
    const input = z
      .object({
        confirmation: z.literal("DELETE"),
        password: z.string().max(200).optional(),
        captchaToken: z.string().max(4096).optional(),
      })
      .parse(await body(request, 16000));
    if (input.confirmation !== "DELETE")
      throw new Error("Type DELETE to confirm account deletion.");
    const user = await identity();
    if (user.demo) writeDemo(user.id, demoWorkspace());
    else {
      await requireRecentAuthentication(
        user.id,
        input.password,
        input.captchaToken,
      );
      await disconnect(user.id);
      const { error } = await serviceClient().auth.admin.deleteUser(user.id);
      if (error) throw new Error("Account deletion failed. Please retry.");
      await (await supabase()).auth.signOut();
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
