# Handoff: Neon DB Integration + Validation Blockers

> **For next session:** Start with `superpowers:finishing-a-development-branch` using this document.
>
> **Created:** 2026-07-09

---

## TL;DR

Neon DB integration + validation blockers are **implemented and green** in the worktree, but **integration work is split across committed migration/fallow fixes and a large uncommitted Neon app layer**. Before merge/PR, **stage and commit remaining worktree changes**, reconcile branches (`neon-db-integration-sdd` vs `neon-setup`), then run `finishing-a-development-branch`.

**Last verified:** `npm run validate:app` exit 0 in worktree `app/` (~13s).

---

## Repository Layout

| Location | Branch | Role |
| --- | --- | --- |
| `/Users/levi/Development/dart-analytics` | `neon-setup` (ahead of `origin/neon-setup` by 3) | Main repo; **docs only** committed here (design, plan, spec status) |
| `/Users/levi/Development/dart-analytics/.worktrees/neon-db-integration` | `neon-db-integration-sdd` @ `e29fd6e` | **Implementation worktree**; 10 commits on top of `af2d127` |

**Base branch:** `main` @ `af2d127` (both branches fork from here).

```bash
git worktree list
# .../.worktrees/neon-db-integration  e29fd6e  [neon-db-integration-sdd]
# .../dart-analytics                    acd8642  [neon-setup]
```

---

## What Was Completed

### Phase A — Neon DB integration (prior session, mostly **uncommitted**)

From `docs/superpowers/plans/2026-07-09-neon-db-integration-implementation.md` Tasks 1–8:

- `app/package.json` scripts: `db:*`, `validate:app`
- `neon.ts`, `src/lib/env.ts`, `src/db/client.ts`, middleware, player provision API stack
- Drizzle introspected `schema.ts`, seeds, tests
- Architecture doc updates (partially uncommitted)

### Phase B — Validation blockers (**committed** in worktree)

From `docs/superpowers/plans/2026-07-09-validation-blockers-implementation.md`:

| SHA | Summary |
| --- | --- |
| `cd0e1a8` | Migrations 0001–0004 → dbmate format |
| `76f6b0a` | Migrations 0005–0008 → dbmate format |
| `d8a4050` | Migrations 0009–0012 → dbmate format |
| `1223a4c` | Introspected schema + meta committed |
| `87919fb` | Fixed stale 0012 header |
| `d116262` | **Added missing `stage_types` to 0002** |
| `9e86842` | dbmate format docs |
| `12a53b6` | Fallow component fixes (AppLayout, BaseLayout, NavBtn; delete Btn.astro) |
| `61f7453` | `tablesFilter` for pg_stat_statements; oid column type fix |
| `e29fd6e` | `.fallowrc.jsonc`; `client.ts` imports `env` |

### Phase B — Docs on `neon-setup` (main repo)

| SHA | Summary |
| --- | --- |
| `3885077` | `docs/superpowers/specs/2026-07-09-validation-blockers-design.md` |
| `0e6d281` | `docs/superpowers/plans/2026-07-09-validation-blockers-implementation.md` |
| `acd8642` | Spec status → **Implemented** |

---

## Validation Evidence

Run from worktree `app/` (requires `.env` with `DATABASE_URL_POOLED`; **not committed**):

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration/app
npm run validate:app
```

Expected (verified 2026-07-09):

| Step | Result |
| --- | --- |
| `db:status` | 12/12 applied, 0 pending |
| `db:migrate` | exit 0 (no-op when current) |
| `db:introspect` | 33 tables → `schema.ts` |
| `npx fallow` | 0 dead-code failures, 0 dupe failures |
| `astro check` | 0 errors |

---

## Uncommitted Work (CRITICAL before merge/PR)

Worktree `git status` still shows **modified + untracked** files from Neon integration Phase A:

**Modified (not in validation-blocker commits):**
- `app/package.json`, `app/package-lock.json`
- `app/README.md`, `app/.gitignore`, `app/tsconfig.json`
- `app/src/db/schema.ts` (post-validate introspect drift possible)
- `architecture/000_master_context.md`
- `architecture/docs/architecture/05-Database/06-Database-Specification.md`
- `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md`

**Untracked (Neon integration app layer):**
- `app/.env.example`, `app/AGENT.md`, `app/neon.ts`
- `app/scripts/seed.ts`
- `app/src/lib/env.ts`, `app/src/lib/id.ts`, `app/src/env.d.ts`
- `app/src/middleware.ts`
- `app/src/pages/api/players/provision.ts` + test
- `app/src/repositories/player.repository.ts`
- `app/src/services/player.service.ts`
- `app/src/db/relations.ts`, `app/src/db/AGENT.md`
- `app/src/db/0000_goofy_marten_broadcloak.sql` (legacy drizzle artifact — review before commit)

**Action for next session:** Audit, group into logical commits, commit **before** merge/PR. Do not merge with dirty worktree.

---

## Discoveries Beyond Original Plans

### 1. dbmate format mismatch (planned fix — done)

Migration files were plain `BEGIN`/`COMMIT` SQL. dbmate requires `-- migrate:up` / `-- migrate:down`. All 12 files converted.

### 2. Missing `stage_types` in 0002 (unplanned bug fix — done, `d116262`)

- `0005_runtime_core.sql` FK `exercise_stages.stage_type_id → stage_types(id)`
- `0009_views.sql` JOINs `stage_types`
- Seeds reference `stage_types`
- **0002 only had 10 tables; spec expects 11.** Fresh migrate failed at 0005 until fixed.

### 3. `dart_zones` was outside transaction in 0002 (fixed during Task 1)

Pre-conversion `COMMIT` ran before `dart_zones` CREATE. Moved into `-- migrate:up`.

### 4. Dev branch was NOT empty (assumption wrong)

Design assumed empty Neon `dev` branch. Actual state:

- Neon project: `my-dart-counter` (`royal-math-16249645`), region `aws-eu-central-1`
- Branch `dev` (`br-late-bonus-asj1n92a`) created from `production` with **parent data**
- Introspection pulls **legacy tables** not in dbmate migrations: `game_catalog`, `game_sessions`, `user_preferences`, etc. (33 tables total vs ~25 from migrations)

**Follow-up options (not done):**
- Dedicated clean Neon branch for architecture-only schema
- `tablesFilter` / schema filters in `drizzle.config.ts` for legacy tables
- Document which tables are in scope for v1

### 5. `pg_stat_statements` breaks `astro check` after introspect

`0001_extensions.sql` enables extension; introspect maps `userid`/`dbid` as `unknown()`.

**Fix applied (`61f7453`):**
- `drizzle.config.ts`: `tablesFilter: ["!pg_stat_statements", "!pg_stat_statements_info"]`
- Manual `integer()` for oid columns if they reappear after introspect

### 6. fallow `env.ts` unreachable without wiring

`neon.ts` entry alone doesn't trace to `src/lib/env.ts`. **Fix:** `client.ts` imports `env` (`e29fd6e`). Also added `postgres` to `ignoreDependencies`.

### 7. Neon CLI unavailable in agent environment

`neon` not on PATH; `npx neonctl link` is interactive. Agents used Neon MCP `get_connection_string` to create local `.env` (never commit).

### 8. Branch/doc split across two git contexts

- Implementation commits: `neon-db-integration-sdd` in worktree
- Superpowers docs: `neon-setup` on main repo path
- **Must reconcile** into one integration branch/PR or merge docs into worktree branch before PR.

---

## Key Files to Know

| File | Notes |
| --- | --- |
| `architecture/docs/database/migrations/0001–0012.sql` | dbmate format; source of truth |
| `app/drizzle.config.ts` | introspect-only; `tablesFilter` for extensions |
| `app/.fallowrc.jsonc` | entry points + ignores |
| `app/package.json` | `validate:app` chain |
| `docs/superpowers/specs/2026-07-09-validation-blockers-design.md` | Status: Implemented |
| `docs/superpowers/plans/2026-07-09-validation-blockers-implementation.md` | Completed |
| `docs/superpowers/plans/2026-07-09-neon-db-integration-implementation.md` | Prior plan (app layer mostly uncommitted) |

---

## Environment Setup (local)

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration/app
# Option A: Neon CLI
neon link
neon env pull
# Ensure pooled URL alias:
grep -q DATABASE_URL_POOLED .env || echo "DATABASE_URL_POOLED=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" >> .env

# Option B: copy .env from prior session (never commit)
```

`.env` exists in worktree locally but is gitignored.

---

## Finishing-a-Development-Branch Checklist

**Skill:** `superpowers:finishing-a-development-branch`

### Step 1 — Verify tests (before offering options)

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration/app
npm run validate:app
```

If fail → fix first. Do not proceed.

### Step 2 — Pre-merge hygiene (do BEFORE options)

1. Review uncommitted files (see section above)
2. Commit Neon integration app layer in logical chunks
3. Decide target integration branch:
   - Merge `neon-setup` docs into `neon-db-integration-sdd`, OR
   - Cherry-pick worktree commits onto `neon-setup`, OR
   - Single new branch containing everything
4. Re-run `validate:app` after final commits

### Step 3 — Base branch

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration
git merge-base HEAD main
# → af2d127
```

Base: **`main`**

### Step 4 — Present exactly these 4 options

```
Implementation complete. What would you like to do?

1. Merge back to main locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

### Step 5 — Suggested PR summary (if Option 2)

**Title:** `feat: Neon Postgres integration with dbmate migrations and validation gate`

**Summary bullets:**
- Convert migrations 0001–0012 to dbmate format with structural down blocks
- Add missing `stage_types` reference table to 0002
- Wire Neon app layer: db client, middleware, player provision API, seeds
- Add fallow config + component fixes; `validate:app` passes end-to-end
- Document dbmate format in architecture docs

**Test plan:**
- [ ] `npm run validate:app` in `app/`
- [ ] `npm run db:rollback` + `db:migrate` smoke on dev branch
- [ ] Manual: provision player via API after Neon Auth login

### Step 6 — Worktree cleanup

| Option | Remove worktree? |
| --- | --- |
| 1. Merge locally | Yes, after merge |
| 2. Create PR | No (keep until PR merged) |
| 3. Keep as-is | No |
| 4. Discard | Yes, after confirmation |

```bash
git worktree remove /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration
```

---

## Open Follow-ups (post-merge, not blocking validate:app)

1. **Legacy Neon tables on dev branch** — filter or reset branch for clean architecture schema
2. **Remove `app/src/db/0000_goofy_marten_broadcloak.sql`** if obsolete vs introspect output
3. **CI pipeline** — wire `validate:app` on push (documented, not implemented)
4. **Reconcile `neon-setup` vs `neon-db-integration-sdd`** doc commits into one branch
5. **Update `06-Database-Specification.md`** if `stage_types` table definition needs sync with committed 0002

---

## Copy-Paste Prompt for New Chat

```
Continue Neon DB integration using finishing-a-development-branch.

Read handoff: docs/superpowers/handoffs/2026-07-09-neon-db-integration-handoff.md

Worktree: /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration
Branch: neon-db-integration-sdd @ e29fd6e

First: commit remaining uncommitted Neon app files, reconcile with neon-setup docs branch.
Then: run validate:app, present finishing-a-development-branch options.
```
