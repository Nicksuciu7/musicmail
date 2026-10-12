// Value-based scan; output locations only, never secret values or matching lines.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: 50_000_000,
  });
  if (result.status !== 0) throw new Error("Git scan failed");
  return result.stdout;
}
const names = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "APP_ENCRYPTION_KEY",
  "GOOGLE_CLIENT_SECRET",
  "TURNSTILE_SECRET_KEY",
  "RESEND_API_KEY",
  "SUPABASE_ACCESS_TOKEN",
];
const values = names.flatMap((name) =>
  process.env[name] ? [{ name, value: process.env[name] }] : [],
);
if (process.env.SUPABASE_DB_URL)
  values.push({
    name: "database password",
    value: decodeURIComponent(new URL(process.env.SUPABASE_DB_URL).password),
  });
const findings = [];
function scan(content, location) {
  for (const { name, value } of values)
    if (value.length >= 12 && content.includes(value))
      findings.push(`${location}: ${name}`);
  if (
    /sb_secret_[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{24,}|GOCSPX-[A-Za-z0-9_-]{20,}/.test(
      content,
    )
  )
    findings.push(`${location}: provider secret pattern`);
}
const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
assert.ok(
  !tracked.some(
    (p) => /(^|\/)\.env(\.|$)/.test(p) && !p.endsWith(".env.example"),
  ),
  "Private environment file tracked",
);
const files = [
  ...new Set([
    ...tracked,
    ...git(["ls-files", "--others", "--exclude-standard", "-z"])
      .split("\0")
      .filter(Boolean),
  ]),
];
for (const file of files) scan(readFileSync(file).toString(), file);
const history = git(["rev-list", "--objects", "--all"])
  .split("\n")
  .filter(Boolean);
let blobs = 0;
for (const entry of history) {
  const id = entry.split(" ")[0];
  if (git(["cat-file", "-t", id]).trim() !== "blob") continue;
  blobs++;
  const path = entry.slice(id.length + 1);
  if (/(^|\/)\.env(\.|$)/.test(path) && !path.endsWith(".env.example"))
    findings.push("Git history: private environment file");
  scan(git(["cat-file", "blob", id]), "Git blob " + id.slice(0, 12));
}
let browserFiles = 0;
function browserScan(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = `${directory}/${item.name}`;
    if (item.isDirectory()) browserScan(file);
    else {
      browserFiles++;
      scan(readFileSync(file).toString(), file);
    }
  }
}
browserScan(".next/static");
let remoteAssets = 0;
if (process.env.MUSICMAIL_SCAN_PRODUCTION === "true") {
  const response = await fetch("https://musicmail.vercel.app/login", {
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, "Production page inaccessible");
  const origin = new URL(response.url).origin;
  assert.ok(
    ["https://musicmail.vercel.app", "https://app.musicmailapp.uk"].includes(
      origin,
    ),
    "Unexpected production redirect host",
  );
  const html = await response.text();
  scan(html, "production login HTML");
  const assets = [
    ...new Set(
      [...html.matchAll(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/g)].map(
        (m) => m[1].replaceAll("&amp;", "&"),
      ),
    ),
  ];
  assert.ok(assets.length > 0, "No production assets found");
  for (const asset of assets) {
    const url = new URL(asset, origin);
    assert.equal(url.origin, origin, "Unexpected production asset host");
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    assert.equal(r.status, 200);
    const content = await r.text();
    scan(content, "production browser asset " + url.pathname);
    assert.ok(
      !/SUPABASE_SERVICE_ROLE_KEY|APP_ENCRYPTION_KEY|GOOGLE_CLIENT_SECRET|TURNSTILE_SECRET_KEY/.test(
        content,
      ),
      "Server environment reference in production browser asset",
    );
    remoteAssets++;
  }
}
assert.equal(findings.length, 0, "Secret scan found: " + findings.join(", "));
console.log(
  `Secret scan passed: ${files.length} repository files, ${blobs} historical blobs, ${browserFiles} local browser assets, ${remoteAssets} production assets; no known credential values/provider-secret patterns or private tracked env files. Unknown credentials require additional scanner rules.`,
);
