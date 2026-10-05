// Keep both audits visible. Accept only the reviewed, exact development chain;
// any production finding or changed/unreviewed finding still blocks CI.
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const reviewed = {
  "eslint-config-next": "16.3.6",
  "@next/eslint-plugin-next": "16.3.6",
  "fast-glob": "3.3.1",
  micromatch: "4.0.8",
  braces: "3.0.3",
};
const advisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
function audit(production) {
  const result = spawnSync(
    "npm",
    ["audit", "--json", ...(production ? ["--omit=dev"] : [])],
    { encoding: "utf8", maxBuffer: 10_000_000 },
  );
  const data = JSON.parse(result.stdout);
  assert.ok(
    [0, 1].includes(result.status) &&
      !data.error &&
      data.metadata?.vulnerabilities &&
      data.vulnerabilities,
    "Dependency audit failed to obtain a valid report",
  );
  mkdirSync(".data/audit", { recursive: true });
  writeFileSync(
    `.data/audit/npm-${production ? "production" : "full"}.json`,
    JSON.stringify(data, null, 2),
  );
  console.log(
    `${production ? "Production" : "Full"} npm audit: ${JSON.stringify(data.metadata.vulnerabilities)}`,
  );
  return data;
}
const production = audit(true);
assert.equal(
  production.metadata.vulnerabilities.total,
  0,
  "Production dependency vulnerability blocks release",
);
const full = audit(false);
for (const [name, finding] of Object.entries(full.vulnerabilities)) {
  assert.ok(
    name in reviewed && finding.severity === "high",
    "Unreviewed dependency finding: " + name,
  );
  for (const node of finding.nodes) {
    assert.equal(
      lock.packages[node]?.dev,
      true,
      "Reviewed chain is no longer development-only: " + name,
    );
    assert.equal(
      lock.packages[node]?.version,
      reviewed[name],
      "Reviewed package version changed: " + name,
    );
  }
  for (const via of finding.via)
    assert.ok(
      typeof via === "string" ? via in reviewed : via.url === advisory,
      "New advisory in reviewed package: " + name,
    );
}
console.log(
  "Dependency gate passed: production clean; only exact reviewed development findings permitted. Full audit remains visible; see docs/dependency-audit.md. No force-fix/downgrade.",
);
