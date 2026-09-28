import { NextResponse } from "next/server";
import { identity, supabase, checked } from "@/lib/server/supabase";
import { genres, emotions, cities, roleNames, orgTypes } from "@/lib/fixtures";
import { errorResponse } from "@/lib/server/http";
export async function GET() {
  try {
    const user = await identity();
    if (user.demo)
      return NextResponse.json({
        genres,
        emotions,
        cities,
        roles: roleNames,
        organisationTypes: orgTypes,
      });
    const db = await supabase();
    const values = await Promise.all(
      ["genres", "emotions", "locations", "roles", "organisation_types"].map(
        async (table) => ({
          table,
          rows: checked(
            await db
              .from(table)
              .select(table === "locations" ? "city" : "name")
              .order(table === "locations" ? "city" : "name"),
          ),
        }),
      ),
    );
    const names = (table: string) =>
      values
        .find((v) => v.table === table)
        ?.rows.map((r) =>
          "city" in r ? String(r.city) : "name" in r ? String(r.name) : "",
        )
        .filter(Boolean) || [];
    return NextResponse.json({
      genres: names("genres"),
      emotions: names("emotions"),
      cities: names("locations"),
      roles: names("roles"),
      organisationTypes: names("organisation_types"),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
