import { describe, it, expect } from "vitest";
import {
  filterSchema,
  serializeFilters,
  parseFilters,
  mergeTemplate,
  matchesEntity,
  duplicateKey,
  privateContactSchema,
  actionSchema,
  matchesContact,
} from "../src/lib/domain";
import { entities, demoWorkspace } from "../src/lib/fixtures";
import { parseCsv, validateRows, csvSafe, exportCsv } from "../src/lib/csv";
import { encrypt, decrypt } from "../src/lib/server/crypto";
describe("music-specific filtering", () => {
  it("roundtrips validated filter definitions", () => {
    const f = filterSchema.parse({
      genres: ["Indie Folk"],
      emotions: ["Intimate"],
      roles: ["Promoter"],
      locations: ["London"],
    });
    expect(parseFilters(serializeFilters(f))).toEqual(f);
    expect(
      entities.filter((e) => matchesEntity(e, f)).map((e) => e.display_name),
    ).toEqual(["Mosslight Presents", "Rowan Ellis", "Orchard Sessions"]);
  });
  it("uses OR within categories and AND between categories", () => {
    const f = filterSchema.parse({
      locations: ["London", "Brighton"],
      roles: ["Promoter"],
    });
    expect(entities.filter((e) => matchesEntity(e, f))).toHaveLength(3);
  });
  it("does not fabricate verification", () =>
    expect(
      entities.filter((e) =>
        matchesEntity(e, filterSchema.parse({ verified: true })),
      ),
    ).toHaveLength(0));
  it("matches aliases and excludes selected moods", () => {
    expect(
      matchesEntity(
        { ...entities[0], aliases: ["Secret Session"] },
        filterSchema.parse({ q: "secret" }),
      ),
    ).toBe(true);
    expect(
      matchesEntity(entities[0], filterSchema.parse({ exclude: ["Intimate"] })),
    ).toBe(false);
  });
  it("rejects arbitrary SQL and excessive page values", () => {
    expect(filterSchema.safeParse({ page: -1 }).success).toBe(false);
    expect(
      filterSchema.parse({ sql: "drop table entities" }),
    ).not.toHaveProperty("sql");
  });
});
describe("personalisation and validation", () => {
  it("replaces only supported merge variables", () => {
    expect(
      mergeTemplate("Hi {{ first_name }}, {{artist_name}} here", {
        first_name: "Rowan",
        organisation: "Mosslight",
        artist_name: "Quiet Hours",
        contact_name: "Rowan Ellis",
      }),
    ).toBe("Hi Rowan, Quiet Hours here");
    expect(() =>
      mergeTemplate("{{password}}", {
        first_name: "",
        organisation: "",
        artist_name: "",
        contact_name: "",
      }),
    ).toThrow("Unsupported variable");
  });
  it("normalises duplicate emails", () =>
    expect(duplicateKey(" HELLO@Example.test ", "A", "B")).toBe(
      duplicateKey("hello@example.test", "C", "D"),
    ));
  it("requires a name and validates private addresses", () => {
    expect(
      privateContactSchema.safeParse({ name: " ", email: "foo" }).success,
    ).toBe(false);
    expect(privateContactSchema.parse({ name: "Booker" }).relationship).toBe(
      "unknown",
    );
  });
  it("keeps relationship and outreach distinct", () => {
    expect(
      actionSchema.safeParse({
        action: "update",
        id: crypto.randomUUID(),
        patch: { relationship_status: "replied" },
      }).success,
    ).toBe(false);
    expect(
      actionSchema.safeParse({
        action: "update",
        id: crypto.randomUUID(),
        patch: { outreach_status: "do_not_contact" },
      }).success,
    ).toBe(true);
  });
});
describe("CSV portability and safety", () => {
  it("reads quoted commas and multiline notes", () => {
    const csv =
      'Name,Email,Notes\n"Ellis, Rowan",rowan@example.test,"Met at show\nSend EP"';
    const r = parseCsv(csv);
    expect(r.rows[0].Name).toBe("Ellis, Rowan");
    expect(r.rows[0].Notes).toContain("\n");
  });
  it("surfaces duplicates within the import and invalid rows", () => {
    const r = parseCsv(
      "name,email\nRowan,a@example.test\nOther,A@example.test\nInvalid,nope",
    );
    const rows = validateRows(
      r.rows,
      {
        name: "name",
        email: "email",
        organisation: "",
        role: "",
        location: "",
        genres: "",
        notes: "",
        relationship: "",
      },
      [],
    );
    expect(rows[1].duplicate).toBe(true);
    expect(rows[2].error).toContain("email");
  });
  it("neutralises spreadsheet formula injection", () => {
    expect(csvSafe('=HYPERLINK("evil")')).toBe('\'=HYPERLINK("evil")');
    expect(csvSafe("Name")).toBe("Name");
    expect(csvSafe("  =1+1")).toBe("'  =1+1");
    expect(csvSafe("\n=1+1")).toBe("'\n=1+1");
  });
  it("exports private notes and shared references", () => {
    const w = demoWorkspace();
    w.contacts = [
      {
        id: crypto.randomUUID(),
        entity_id: entities[0].id,
        entity: entities[0],
        private_display_name: null,
        private_email: null,
        private_details: {},
        relationship_status: "warm",
        outreach_status: "replied",
        priority: "high",
        follow_up_at: "2026-10-01",
        last_contacted_at: null,
        relationship_origin: null,
        archived: false,
        created_at: new Date().toISOString(),
      },
    ];
    w.notes = [
      {
        id: crypto.randomUUID(),
        user_contact_id: w.contacts[0].id,
        body: "Private note",
        pinned: false,
        created_at: new Date().toISOString(),
      },
    ];
    expect(exportCsv(w)).toContain("Private note");
    expect(exportCsv(w)).toContain(entities[0].id);
    expect(
      matchesContact(
        w.contacts[0],
        filterSchema.parse({ followUp: "overdue" }),
        [],
        "2026-10-02",
      ),
    ).toBe(true);
  });
});
describe("authenticated encryption", () => {
  it("roundtrips and rejects tampering", () => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const ciphertext = encrypt({ refresh_token: "test-only" });
    expect(ciphertext).not.toContain("test-only");
    expect(decrypt(ciphertext)).toEqual({ refresh_token: "test-only" });
    const altered = Buffer.from(ciphertext, "base64");
    altered[30] ^= 1;
    expect(() => decrypt(altered.toString("base64"))).toThrow();
  });
  it("fails closed without a valid key", () => {
    delete process.env.APP_ENCRYPTION_KEY;
    expect(() => encrypt({})).toThrow("not configured");
  });
});

describe("genre hierarchy", () => {
  it("includes child styles when a parent genre is selected", () => {
    expect(
      matchesEntity(entities[0], filterSchema.parse({ genres: ["Folk"] })),
    ).toBe(true);
    expect(
      matchesEntity(
        entities[0],
        filterSchema.parse({ genres: ["Electronic"] }),
      ),
    ).toBe(false);
  });
});
