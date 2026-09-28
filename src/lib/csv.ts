import Papa from "papaparse";
import {
  contactEmail,
  contactName,
  duplicateKey,
  privateContactSchema,
  type Contact,
  type Workspace,
} from "./domain";
export const csvFields = [
  "name",
  "email",
  "organisation",
  "role",
  "location",
  "genres",
  "notes",
  "relationship",
] as const;
export type CsvField = (typeof csvFields)[number];
export function parseCsv(text: string) {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length)
    throw new Error(`CSV could not be read: ${result.errors[0].message}`);
  if (!result.meta.fields?.length || result.data.length > 500)
    throw new Error("Choose a CSV with headers and at most 500 contacts.");
  return { headers: result.meta.fields, rows: result.data };
}
export function validateRows(
  rows: Record<string, string>[],
  mapping: Record<CsvField, string>,
  existing: Contact[],
) {
  const keys = new Set(
    existing.map((c) =>
      duplicateKey(
        contactEmail(c),
        contactName(c),
        c.private_details.organisation || c.entity?.organisation || "",
      ),
    ),
  );
  return rows.map((row, index) => {
    const input = Object.fromEntries(
      csvFields.map((f) => [
        f,
        row[mapping[f]] || (f === "relationship" ? "unknown" : ""),
      ]),
    );
    const result = privateContactSchema.safeParse(input);
    const key = duplicateKey(input.email, input.name, input.organisation);
    const duplicate = keys.has(key);
    keys.add(key);
    return {
      index: index + 2,
      input,
      contact: result.success ? result.data : null,
      error: result.success
        ? ""
        : result.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
      duplicate,
    };
  });
}
export function csvSafe(v: unknown) {
  const s = String(v ?? "");
  return /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(s) ? `'${s}` : s;
}
export function exportCsv(w: Workspace) {
  return Papa.unparse(
    w.contacts.map((c) =>
      Object.fromEntries(
        Object.entries({
          name: contactName(c),
          entity_id: c.entity_id,
          email: contactEmail(c),
          role: c.entity?.roles.join("; ") || c.private_details.role,
          organisation:
            c.entity?.organisation || c.private_details.organisation,
          location: c.entity?.location || c.private_details.location,
          genres: c.entity?.genres.join("; ") || c.private_details.genres,
          emotions: c.entity?.emotions.join("; "),
          relationship: c.relationship_status,
          outreach: c.outreach_status,
          priority: c.priority,
          follow_up: c.follow_up_at,
          archived: c.archived,
          notes: w.notes
            .filter((n) => n.user_contact_id === c.id)
            .map((n) => n.body)
            .join("\n"),
        }).map(([k, v]) => [k, csvSafe(v)]),
      ),
    ),
  );
}
