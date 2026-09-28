import { NextResponse } from "next/server";
import { body, errorResponse } from "@/lib/server/http";
import { sendSchema, sendMessages } from "@/lib/server/gmail";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    return NextResponse.json(
      await sendMessages(sendSchema.parse(await body(request))),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
