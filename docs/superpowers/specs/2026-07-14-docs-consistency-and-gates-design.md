# Docs Consistency Sweep & Quality-Gate Hardening Design

> **Date:** 2026-07-14
> **Status:** proposed design (autonomous architecture review — awaiting user approval)
> **Scope:** targeted fixes for the stale/self-contradictory doc details found by the 2026-07-14 review, plus CI enforcement of the existing quality gates. Minimal diffs only — no regeneration.
> **Branch:** `claude/darts-analytics-arch-review-nvyboi`

---

## Problem

The context system is structurally strong (the checker passes; packs, authority order, and front-matter are consistent), but a review sweep found accumulated point defects, and the gates that keep them out run only on developer machines — nothing enforces them at PR time.

---

## Decision 1 — Targeted doc fixes (one commit, one line each where possible)

| # | File | Defect | Fix |
| - | ---- | ------ | --- |
| 1 | `architecture/docs/architecture/README.md` | Hierarchy, tree comment, and Document Index omit `07-Frontend/05-Astro-Components.md` ("00–04, 10") despite same-day version bump to 1.5.0 | register `05` in all three places |
| 2 | `00-Context-Map.md` | `04-Architecture-patterns.md` described as "15 recurring design patterns" — the doc has 17 | update count (or drop counts entirely — preferred, they rot) |
| 3 | `00-Context-Map.md` | `01-Principles.md` described as "15 key rules" — the doc enumerates no such list | replace with a stable description |
| 4 | `04-Architecture-patterns.md` | Pattern 4 and Pattern 5 share the title "Configuration Snapshot" | rename Pattern 4 → "Template → Snapshot Lifecycle" (concept) leaving Pattern 5 (JSONB modelling) as is; verify no inbound references break |
| 5 | `05-Database/CHECKLIST.md` | "Files that should be present" omits `11-Neon-Integration.md`, `06-Spec/01–06`, and `CHECKLIST.md` itself | update the list |
| 6 | `06-API/02-Middleware-And-Layering.md` | Module heading says `lib/db/client.ts`; the authoritative tree (and D78, and the code) put it at `src/db/client.ts` | fix heading |
| 7 | `06-API/02` + `00-Overview`/`DECISIONS` | Same route class named both "provision-exempt" (D62, flow diagram) and "authenticated-unprovisioned" (route-class table) | pick **authenticated-unprovisioned** (more precise) and alias the other once |
| 8 | `05-Database/03-Migrations.md` | Hypothetical example migration numbers (`0013_add_dart_coordinates`, `0013_add_nickname_column`, `0013_runtime_update`, `0014_migrate_existing_nicknames`) collide with real applied migrations | renumber examples to `0017+`/`NNNN` placeholders |
| 9 | `07-Frontend/02-Folder-Structure.md` | Authoritative tree/alias table omit `src/icons/` (`@icons`), `src/styles/` (`@styles`), and `@lib` — all present in `tsconfig.json` and used by real code; `src/lib/shared/nav/is-nav-active.ts` sits in an undocumented `lib/shared/` area whose documented home is `src/utils/` (`@utils`) | add `icons/`/`styles/` + aliases to the doc; move `is-nav-active.ts` to `src/utils/` (code fix, matches the doc's own rule) |
| 10 | `05-Database/00-OVERVIEW.md` | Runtime Event Model section renders each word in its own broken code fence | collapse to one fence (cosmetic) |

All fixes follow the Context Maintenance protocol (ISO dates on changed rows, checker pass, graph refresh).

---

## Decision 2 — CI workflow enforcing the gates

**Decision:** add `.github/workflows/checks.yml` running on every PR to `main`:

1. `bash scripts/check-context-map.sh`
2. `cd app && npm ci && npx astro check` (type gate)
3. `npx fallow` (stale-usage gate)

DB-touching steps (`db:status`, `db:migrate`, introspect) stay local-only for now — they need Neon credentials; wiring a CI branch database is deferred and recorded as an open item. Graphify refresh stays a local/commit-hook concern (the committed graph is reviewed like any artifact).

Alternative considered: full `validate:app` in CI with a Neon `preview` branch — better coverage, but requires secret management and branch-per-PR automation; deferred post-v1 rather than blocking the first CI step.

---

## Decision 3 — Checker extensions (small, targeted)

Extend `scripts/check-context-map.sh` with two cheap checks that would have caught this review's findings:

1. **Pack-target resolution:** every backtick path in the Context Packs table must resolve (already covered by rule 1 — verify it fires for pack rows; add test).
2. **README index completeness:** every canonical file registered in `00-Context-Map.md`'s Foundation/API/Frontend/DB tables must appear in `architecture/docs/architecture/README.md`'s Document Index *or* the README drops per-file indexing in favour of pointing at the context map (preferred — one less duplicate registry; the README keeps philosophy + reading order only).

Preferred resolution for 3.2 is the **de-duplication**: the README's Document Index duplicates the context map's inventory and has already drifted once. Removing it honours "every rule lives in exactly one place" better than checking two copies stay equal.

---

## Success criteria

1. All table-1 defects fixed; `check-context-map.sh` passes.
2. CI runs the checker + `astro check` + `fallow` on every PR to `main` and is required.
3. The README no longer maintains a second per-file index (or the checker proves the two indexes equal).
