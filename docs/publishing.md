# GitHub publication handoff

Local preparation is complete. GitHub publication has not happened: `gh` is not installed in this environment, and the available connector does not expose repository creation or release creation. No remote was added, no push was attempted, and no GitHub release was created.

## Preserved version

`v0.9.0` is an annotated tag at `7d9397121961a51b0a6f3851f64f0f0a4090c4c1`, subject `docs: document local beta and hosted release setup`. It correctly identifies the original local beta. Repository preparation follows it as a documentation/configuration commit. The package remains 0.9.0; do not move the tag or create 0.9.1.

## Publish manually

Install GitHub CLI (on macOS with Homebrew):

```bash
brew install gh
gh auth login
gh auth setup-git
cd /Users/nicksuciu/Downloads/MusicMail
gh api user --jq .login
git remote -v
```

Inspect your account before creating a repository:

```bash
gh repo list --limit 1000 --json name,url,visibility
```

Use an existing appropriate `musicmail` repository if present. Inspect its branches/content before connecting; do not overwrite unrelated history. Otherwise create the preferred name. If it is occupied by an unrelated project, inspect and use `greenroom-musicmail` instead. The following commands assume `musicmail` is available, no remote exists, and you have confirmed the intended account:

```bash
gh repo create musicmail --public --source=. --remote=origin --description 'MusicMail — a music-industry discovery, CRM and outreach tool for independent musicians.'
git remote -v
git push -u origin main
git push origin v0.9.0
gh repo edit --default-branch main --add-topic music,crm,nextjs,typescript,supabase,music-industry,creator-tools
gh release create v0.9.0 --verify-tag --prerelease --title 'MusicMail v0.9.0 — Local Beta' --notes-file docs/release-v0.9.0.md
```

For an existing correct empty repository, use `git remote add origin YOUR_CONFIRMED_REPOSITORY_URL` instead of repository creation. Never force-push. Do not create a remote README, enable Pages or replace an existing valid origin.

## Verify publication

```bash
git status
git branch --show-current
git remote -v
git log --oneline -5
git tag
gh repo view --json url,visibility,defaultBranchRef
git ls-remote origin refs/heads/main refs/tags/v0.9.0 'refs/tags/v0.9.0^{}'
gh release view v0.9.0
gh api repos/{owner}/{repo}/git/trees/main --jq '.tree[].path'
```

Confirm source, `supabase/migrations`, tests, README, docs, CHANGELOG, `.env.example` and `.gitignore` are visible. `.env.local`, `.data`, build output and private datasets must remain absent. Review GitHub Actions results separately; local test success does not assert hosted CI success.

## Pre-publication safety review — 29 September 2026

Reviewed all 134 unique file blobs reachable from the seven existing commits/tags, tracked filenames, environment use, fixtures and synthetic screenshots. Pattern checks covered provider keys, JWTs, private keys, credential URLs and literal token/secret assignments. Four candidate locations were explicit `test-only`, `test-access` and `test-refresh` test fixtures. No actual credentials or private contact datasets were found; no credential rotation is indicated by this review. This is a bounded repository review, not a guarantee that pattern matching detects every possible secret.

Only `.env.example` is tracked; its credential values are blank. `.env*` is ignored except that template. Local demo data, database files, build/test output and Supabase caches are ignored. Commit identity uses the owner's GitHub noreply address. No license has been selected.
