import { writeFileSync } from "node:fs";
import {
  entities,
  genres,
  emotions,
  cities,
  roleNames,
  orgTypes,
} from "../src/lib/fixtures";
const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
let sql =
  "-- All entity records in this seed are FICTIONAL. Reserved .example addresses cannot receive mail.\n";
const lookup = (table: string, names: string[]) => {
  for (const name of names)
    sql += `insert into ${table}(name,slug) values(${quote(name)},${quote(slug(name))}) on conflict(slug) do nothing;\n`;
};
lookup("roles", [
  ...roleNames,
  "A&R",
  "Publicist",
  "Engineer",
  "Session musician",
  "Music supervisor",
  "Festival booker",
  "Label manager",
  "Editor",
  "Songwriter",
  "Composer",
  "Tour manager",
  "Videographer",
  "Designer",
  "Radio producer",
]);
lookup("organisation_types", [
  ...orgTypes,
  "Music blog",
  "PR agency",
  "Publisher",
  "Distributor",
  "Arts organisation",
  "Music charity",
  "Playlist curator",
  "Music school",
  "Equipment company",
  "Other",
]);
lookup("venue_types", ["Listening room", "Club", "Concert hall", "Pub"]);
lookup("relationship_types", [
  "Member of",
  "Managed by",
  "Represented by",
  "Signed to",
  "Distributed by",
  "Works at",
  "Writes for",
  "Promotes",
  "Books",
  "Owns",
  "Parent of",
  "Subsidiary of",
  "Associated with",
  "Resident at",
]);
lookup("genres", [
  ...genres,
  "Rock",
  "Folk Rock",
  "Traditional Folk",
  "Contemporary Folk",
  "Freak Folk",
  "Art Rock",
  "Post-Rock",
  "Punk",
  "House",
  "Techno",
  "IDM",
  "Experimental Electronic",
]);
const families: Record<string, string[]> = {
  Melancholy: ["Melancholic", "Sad", "Wistful", "Mournful", "Sorrowful"],
  Intimacy: [
    "Intimate",
    "Vulnerable",
    "Tender",
    "Personal",
    "Confessional",
    "Raw",
  ],
  Nostalgia: ["Nostalgic", "Sentimental", "Reflective", "Yearning"],
  Darkness: ["Dark", "Bleak", "Ominous", "Haunting", "Unsettling"],
  Warmth: ["Warm", "Comforting", "Affectionate", "Gentle"],
  Hope: ["Hopeful", "Uplifting", "Optimistic"],
  Joy: ["Joyful", "Celebratory", "Playful", "Euphoric"],
  Anger: ["Angry", "Aggressive", "Confrontational", "Frustrated"],
  Anxiety: ["Anxious", "Nervous", "Tense", "Claustrophobic"],
  Romance: ["Romantic", "Sensual", "Longing", "Heartbreak"],
  Serenity: ["Calm", "Peaceful", "Meditative", "Dreamy"],
  Alienation: ["Detached", "Lonely", "Isolated", "Numb"],
  Mystery: ["Mysterious", "Surreal", "Uncanny", "Enigmatic"],
  Energy: ["Energetic", "Urgent", "Explosive", "Chaotic"],
  Defiance: ["Rebellious", "Resistant", "Provocative"],
  Spirituality: ["Spiritual", "Transcendent", "Devotional"],
  Wonder: ["Awe", "Magical", "Expansive"],
  Humour: ["Funny", "Ironic", "Absurd"],
};
lookup("emotion_families", Object.keys(families));
lookup("emotions", [
  ...new Set([...emotions, ...Object.values(families).flat()]),
]);
for (const [family, names] of Object.entries(families))
  sql += `update emotions set family_id=(select id from emotion_families where name=${quote(family)}) where name in (${names.map(quote).join(",")});\n`;
for (const [parent, children] of Object.entries({
  Folk: [
    "Indie Folk",
    "Singer-Songwriter",
    "Folk Rock",
    "Traditional Folk",
    "Contemporary Folk",
    "Freak Folk",
  ],
  Rock: [
    "Indie Rock",
    "Alternative Rock",
    "Shoegaze",
    "Art Rock",
    "Post-Rock",
    "Punk",
  ],
  Electronic: ["Ambient", "House", "Techno", "IDM", "Experimental Electronic"],
}))
  sql += `update genres set parent_genre_id=(select id from genres where name=${quote(parent)}) where name in (${children.map(quote).join(",")});\n`;
for (const city of cities)
  sql += `insert into locations(city,slug) values(${quote(city)},${quote(slug(city))}) on conflict(slug) do nothing;\n`;
for (const e of entities) {
  sql += `insert into entities(id,entity_type,display_name,description,slug,primary_location_id) values('${e.id}',${quote(e.entity_type)},${quote(e.display_name)},${quote(e.description)},${quote(slug(e.display_name))},(select id from locations where city=${quote(e.location)})) on conflict(id) do nothing;\n`;
  for (const alias of e.aliases)
    sql += `insert into entity_aliases(entity_id,alias,normalised_alias) values('${e.id}',${quote(alias)},${quote(alias.toLowerCase())}) on conflict do nothing;\n`;
  const sub =
    e.entity_type === "organisation"
      ? `insert into organisations(entity_id,organisation_type_id) values('${e.id}',(select id from organisation_types where name=${quote(e.organisation_type)}))`
      : e.entity_type === "person"
        ? `insert into people(entity_id,first_name,last_name) values('${e.id}',${quote(e.display_name.split(" ")[0])},${quote(e.display_name.split(" ")[1])})`
        : e.entity_type === "venue"
          ? `insert into venues(entity_id,capacity_max) values('${e.id}',${e.capacity})`
          : `insert into artist_projects(entity_id,artist_type) values('${e.id}','band')`;
  sql += sub + " on conflict do nothing;\n";
  for (const [table, lookupTable, col, values] of [
    ["entity_genres", "genres", "genre_id", e.genres],
    ["entity_emotions", "emotions", "emotion_id", e.emotions],
  ] as const)
    for (const name of values)
      sql += `insert into ${table}(entity_id,${col}) select '${e.id}',id from ${lookupTable} where name=${quote(name)} on conflict do nothing;\n`;
  for (const role of e.roles)
    sql += `insert into entity_roles(entity_id,role_id) select '${e.id}',id from roles where name=${quote(role)} and not exists(select 1 from entity_roles where entity_id='${e.id}' and role_id=roles.id);\n`;
  sql += `insert into entity_contact_methods(entity_id,contact_type,value,purpose) select '${e.id}','email',${quote(e.email)},'general' where not exists(select 1 from entity_contact_methods where entity_id='${e.id}');\ninsert into submission_channels(entity_id,submission_type,status,instructions) select '${e.id}',${quote(e.submission_type)},${quote(e.submission_status)},${quote(e.submission_instructions)} where not exists(select 1 from submission_channels where entity_id='${e.id}');\ninsert into entity_sources(entity_id,source_type,source_name) select '${e.id}','synthetic',${quote(e.source)} where not exists(select 1 from entity_sources where entity_id='${e.id}');\n`;
}
writeFileSync("supabase/seed.sql", sql);
