# Dependency security review — 2026-10-12

`npm audit` reports **five high findings, one underlying advisory**. `npm audit --omit=dev` reports **zero vulnerabilities**. No dependency version was changed just to hide these findings.

## Compatible production patches

The October 12 audit found two affected production packages in the previous lockfile. Both were patched without a major upgrade or security exception:

- **Next.js 16.3.6 → 16.3.8**, with the matching ESLint configuration/plugin. [The upstream security release](https://github.com/vercel/next.js/releases/tag/v16.3.8) fixes image-optimization SSRF, cache poisoning/disclosure, metadata-image authorization and development MCP disclosure advisories. MusicMail has no remote image allowlist, Draft Mode or `use cache` configuration, but the production dependency gate still rejects affected versions.
- **source-map-js 1.2.1 → 1.2.2**, the compatible transitive patch used by Next/PostCSS, Tailwind and development jsdom. [The maintainer release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) fixes indexed-source-map denial of service (CVE-2026-93749). MusicMail does not accept source maps from user requests.

The lockfile retains cross-platform optional dependencies and passed a fresh `npm ci` using Node 22/npm 10. Production audit is again zero. The development exception below remains restricted to the same advisory and dependency path; only the reviewed matching Next lint package versions changed to 16.3.8. Full audit remains nonzero.

## Remaining development advisory

The advisory is [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): recursive brace-pattern parsing/compilation/expansion can exhaust the Node.js stack when given a deeply nested attacker-controlled glob. Affected `braces` versions are <=3.0.3; the advisory and npm registry currently list no patched release. Recheck before subsequent releases.

| npm finding              | Installed version | Dependency path from MusicMail                | Classification / production reachability            |
| ------------------------ | ----------------- | --------------------------------------------- | --------------------------------------------------- |
| eslint-config-next       | 16.3.8            | direct development dependency                 | lint configuration; no runtime request input        |
| @next/eslint-plugin-next | 16.3.8            | eslint-config-next → @next/eslint-plugin-next | development lint rules                              |
| fast-glob                | 3.3.1             | above → fast-glob                             | development root-directory glob discovery           |
| micromatch               | 4.0.8             | above → micromatch                            | transitive development pattern matching             |
| braces                   | 3.0.3             | above → braces                                | vulnerable recursive walker; development dependency |

All five findings inherit the same advisory; they are not five independent production vulnerabilities. These dependency directories were absent from the generated `.next/**/*.nft.json` production traces. Application source imports none of them. Browser assets contain no imported ESLint pipeline. This describes the audited dependency chain, not a guarantee about every vendored utility inside framework packages.

The Next ESLint plugin's `dist/utils/get-root-dirs.js` calls fast-glob using `context.settings.next.rootDir`, when configured. MusicMail does not accept this value from HTTP, CRM, CSV, or Auth input; the default is the trusted working directory. An attacker would need to influence development lint configuration/glob input. Code from untrusted repositories/PRs still needs normal isolated CI handling. Do not expose this lint/glob pipeline as a public service.

No safe patched `braces` release is currently available. npm suggests moving eslint-config-next to **14.2.35**, explicitly a SemVer-major change and a downgrade from the Next 16 configuration. That would abandon the matching framework lint rules and is not a valid safe remediation. No `npm audit fix --force`, overrides to an incompatible matcher, or framework downgrade was applied. Upgrade the lint dependency chain when a compatible patched version exists, then rerun lint and the full audit.

**Decision: NON-BLOCKING HARDENING** for this deployment because the audited code is development-only and not reachable through deployed MusicMail input. Production-only audit remains a release gate. Full audit intentionally remains nonzero and is reported honestly.

`npm run check:dependencies` runs and retains both full and production audits. CI accepts only this exact advisory chain at the reviewed installed versions, verifies every affected lockfile node is marked development-only, and rejects any production vulnerability or new/changed finding. Raw audit reports are retained as CI artifacts. No unit, browser, database or isolation test was removed or relaxed. Remove this narrowly scoped exception when a compatible patch is available.
