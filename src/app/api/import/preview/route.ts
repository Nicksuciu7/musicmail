import { NextResponse } from "next/server";
import { z } from "zod";
import { body, errorResponse } from "@/lib/server/http";
import { workspace } from "@/lib/server/repository";
import {
  privateContactSchema,
  duplicateKey,
  contactEmail,
  contactName,
} from "@/lib/domain";
export async function POST(request: Request) {
  try {
    const input = z
      .object({ contacts: z.array(privateContactSchema).min(1).max(500) })
      .parse(await body(request));
    const w = await workspace(true);
    const keys = new Set(
      w.contacts.map((c) =>
        duplicateKey(
          contactEmail(c),
          contactName(c),
          c.private_details.organisation || c.entity?.organisation || "",
        ),
      ),
    );
    const duplicates: number[] = [];
    input.contacts.forEach((c, i) => {
      const key = duplicateKey(c.email, c.name, c.organisation);
      if (keys.has(key)) duplicates.push(i);
      keys.add(key);
    });
    return NextResponse.json({ duplicates });
  } catch (e) {
    return errorResponse(e);
  }
}
