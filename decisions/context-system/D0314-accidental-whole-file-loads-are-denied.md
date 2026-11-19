---
id: D0314
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, skill, gate, CI, husky, pre-commit, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Accidental whole-file loads are denied at the tool boundary, and the skill tree is registered

## Context and Problem Statement
D311 found that none of the eight vendored skill copies was registered in the inventory, so no gate script ever read them and every upstream drift landed unobserved; the registration assertions close that for the files the repo owns. The denies address a different failure — not drift but volume: `graphify-out/graph.json` is 7.7 MB, roughly 1.9M tokens read whole, while root `CLAUDE.md` invites exactly that read; a worktree is a second full copy of the repo; and `schema.ts` is regenerated output whose authority is `database/migrations/`. Grep over the graph is untouched, because grep is what the manual actually wants. The gate lands before the `.claude/rules/` tree exists so that tree is born covered — a gate landing after the tree it checks has nothing to say about how that tree was built.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`.claude/settings.json` denies `Read` on the four paths nothing should ever load entire — `graphify-out/graph.json`, `.worktrees/**`, `.claude/worktrees/**`, and the `drizzle-kit`-generated `app/src/db/schema.ts` — and sets `claudeMdExcludes` so a `CLAUDE.md` inside a worktree copy is not auto-loaded beside the real one. A new gate, `scripts/check-skill-pointers.sh`, asserts that every `.claude/skills/*/SKILL.md` and every `.claude/rules/*.md` carries a row in `00-File-Inventory.md`, and that every `superpowers:<name>` named in a live tracked Markdown file resolves under the installed plugin cache. It is wired into `run-all-gates` §Always run, `quality.yml`'s structure job and `.husky/pre-commit`. `check-doc-links.sh`'s scan set gains `.claude/rules/*.md`.".

### Consequences
`superpowers:` pointer resolution is a local-only check. CI installs no plugins, so it prints `SKIP` and passes there; making it hard-fail would leave a permanently red check CI cannot fix, which is the "advisory gate" failure mode in a different costume. `claudeMdExcludes` is ships-and-hopes: `strings` on binary 2.1.236 confirms the identifier exists in the build, which is not confirmation that this key name and glob syntax are honoured — an unrecognised settings key is ignored, so the downside of being wrong is that it silently does nothing rather than that it breaks something. The same uncertainty is load-bearing for the path-scoped-rules branch, which is why that branch owes a live probe before it commits to six files. `.claude/skills/**/*.md` is not yet in the link gate's scan set: widening it today fails on 8 dangling `references/*.md` pointers in `graphify/SKILL.md` — inherited from a fork that copied the file without upstream's `references/` directory — and the next branch deletes that file, so the widening travels with the deletion rather than fixing text twice.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-18
