# API v1 Freeze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile and freeze the `06-API/` documentation folder to a coherent v1 so the architecture phase can close and work can move to the frontend.

**Architecture:** Docs-only change. Amend the frozen `03-Shared-Conventions.md` (alias + barrel convention) as authorized by user instruction, reconcile `02` and `01` to it and to the real `app/src/` scaffold, freeze `01`/`02` at `1.0.0`, then run the mandatory context-maintenance protocol.

**Tech Stack:** Markdown docs under `architecture/docs/architecture/06-API/`; `architecture/DECISIONS.md`; `architecture/docs/architecture/00-Context-Map.md`; `scripts/check-context-map.sh` (bash validation gate).

## Global Constraints

- Source of truth: `docs/superpowers/specs/2026-07-13-api-v1-freeze-design.md`. Copy no value from memory; read the spec and the target doc before each edit.
- Scope is **docs only**: no `app/tsconfig.json` edits, no folder moves in `app/src/`, no creation of `types.ts` barrel files, no changes to `04-Endpoint-Contracts.md` response contracts.
- Minimal diffs; never regenerate a doc. Targeted edits only (root `CLAUDE.md` invariant).
- Import convention is `@`-prefixed aliases (e.g. `@services/types`), NOT `#`-prefixed.
- Barrel rule is "type-raising": types live next to source; each area's `types.ts` barrel re-exports them; consumers import `@<area>/types` — no deep paths.
- Statistics endpoints ship zero surface in v1 (D63); no doc may imply a v1 statistics endpoint.
- Target folder layout follows the real scaffold: top-level `src/services/`, `src/repositories/`, `src/db/client.ts`; `src/lib/{api,auth}/`, `src/lib/env.ts`, `src/lib/id.ts`.
- Every added/changed docs row carries ISO date `2026-07-13`.
- Commit after each task. End commit messages with the two trailer lines used on this branch (`Co-Authored-By` and `Claude-Session`), matching prior commits.
- The validation gate is `scripts/check-context-map.sh`; it must pass before the work is claimed done.
- Branch: `claude/api-folder-finalization-g5tzdh`. Do not merge to main; do not open a PR unless the user asks.

---

### Task 1: Amend `03-Shared-Conventions.md` — `@`-aliases + type-raising barrels, bump to 1.1.0

**Files:**
- Modify: `architecture/docs/architecture/06-API/03-Shared-Conventions.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the canonical alias convention (`@`-prefixed) and barrel wording that Task 2 (`02` folder tree + alias note) and Task 4 (context map) reference. Alias set naming used downstream: `@services`, `@repositories`, `@routes`, `@lib`, `@db`. Barrel import form: `@<area>/types`.

- [ ] **Step 1: Read the current file**

Read `architecture/docs/architecture/06-API/03-Shared-Conventions.md` in full. Note the three edit sites: the header version line (`> **Version:** 1.0.0 (frozen v1)`), the "Path aliases" bullet under `## Validation & Types`, the `types.ts` barrels bullet, and the Related Documents dates for `01`/`02`.

- [ ] **Step 2: Bump the version line**

Change:
```markdown
> **Version:** 1.0.0 (frozen v1)
```
to:
```markdown
> **Version:** 1.1.0 (frozen v1; alias + barrel convention amended 2026-07-13)
```

- [ ] **Step 3: Rewrite the `types.ts` barrels bullet as type-raising**

Replace the existing `### types.ts barrels` block. New content:

````markdown
### `types.ts` barrels (type-raising)

TypeScript types live as close as possible to their source. Each **area**
(`services`, `repositories`, `routes`, `lib`) exposes a `types.ts` barrel that
re-exports its contract types, *raising* them so every consumer imports a
shallow, stable path regardless of where the type is defined:

```typescript
// good: import from the area barrel — always one level deep
import type { CreateSessionRequest, SessionResponse } from '@services/types';

// bad: deep path into the defining module
import type { SessionResponse } from '@services/sessions/response';
```

A type never travels through a deeper import path than `@<area>/types`.
````

- [ ] **Step 4: Rewrite the Path aliases bullet to `@`-prefix**

Replace the `### Path aliases` block. New content:

````markdown
### Path aliases

All imports go through `tsconfig.json` path aliases, `@`-prefixed by area
(e.g. `@services/*`, `@repositories/*`, `@routes/*`, `@lib/*`, `@db/*`). Deep
relative import chains (`../../../`) are forbidden. (Barrel type imports use
the `@<area>/types` form above.) <!-- alias set is documented target; see
02-Middleware-And-Layering.md for tsconfig realization status --> <!-- 2026-07-13 -->
````

- [ ] **Step 5: Update the `import from '#types/sessions'` example under Response DTOs & Mapping**

Find any remaining `#`-prefixed alias examples in the file (there is at least the `### types.ts barrels` example that used `#types/sessions`, `#routes/sessions/schema`, `#lib/services/...`). All of these are replaced by Step 3's block. Search the file for a literal `#` in code fences and confirm none remain (`grep -n "#types\|#routes\|#services\|#lib" <file>` returns nothing).

- [ ] **Step 6: Refresh Related Documents dates for `01` and `02`**

In the Related Documents table, change the `2026-07-10` date on the `01-Implementation-Strategy.md` and `02-Middleware-And-Layering.md` rows to `2026-07-13`.

- [ ] **Step 7: Verify no stray `#`-aliases and version bumped**

Run: `grep -nE "#(types|routes|services|lib|db)/" architecture/docs/architecture/06-API/03-Shared-Conventions.md`
Expected: no output (exit 1).
Run: `grep -n "1.1.0" architecture/docs/architecture/06-API/03-Shared-Conventions.md`
Expected: the version line matches.

- [ ] **Step 8: Commit**

```bash
git add architecture/docs/architecture/06-API/03-Shared-Conventions.md
git commit -m "docs(api): adopt @-aliases and type-raising barrels in 03 (v1.1.0)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019di6mNyvRq8nHy2722Xc1X"
```

---

### Task 2: Reconcile & freeze `02-Middleware-And-Layering.md` to 1.0.0

**Files:**
- Modify: `architecture/docs/architecture/06-API/02-Middleware-And-Layering.md`

**Interfaces:**
- Consumes: the `@`-alias set and `@<area>/types` barrel convention from Task 1 (`03`).
- Produces: the canonical `app/src/` folder tree and route-class ownership that Task 3 (`01` flow pointer) references.

- [ ] **Step 1: Read the current file**

Read `architecture/docs/architecture/06-API/02-Middleware-And-Layering.md` in full. Edit sites: header version line (`> **Version:** 0.2.0`), the `# Recommended Folder Structure` tree (contains `statistics/` and `lib/`-nested `services`/`repositories`/`db`), and Related Documents (missing `03`/`04`).

- [ ] **Step 2: Bump the version line**

Change:
```markdown
> **Version:** 0.2.0
```
to:
```markdown
> **Version:** 1.0.0 (frozen v1)
```

- [ ] **Step 3: Rewrite the folder tree to the real scaffold + barrels, drop statistics**

Replace the entire fenced code block under `# Recommended Folder Structure` with:

````markdown
```
app/src/
├── middleware.ts
├── env.d.ts                         # App.Locals { auth, requestId }
├── pages/api/
│   ├── sessions/
│   │   ├── index.ts                 # POST, GET (list)
│   │   ├── active.ts                # GET
│   │   ├── types.ts                 # domain contract barrel (@routes/... via alias)
│   │   └── [sessionId]/
│   │       ├── index.ts             # GET, PATCH
│   │       ├── events/
│   │       │   └── batch.ts         # POST (maps to events:batch contract)
│   │       ├── replay.ts
│   │       └── darts.ts
│   ├── routines/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── [routineId]/
│   │       ├── index.ts
│   │       └── execution.ts
│   └── players/
│       └── provision.ts             # POST (authenticated-unprovisioned route)
├── lib/
│   ├── api/
│   │   ├── envelope.ts              # ok/error response helpers
│   │   └── errors.ts                # domain error codes and HTTP mapping (registry in 03)
│   └── auth/
│       ├── verify-jwt.ts
│       └── resolve-player.ts
├── db/
│   └── client.ts                    # neon client factory (http vs transaction)
├── services/
│   ├── session.service.ts
│   ├── types.ts                     # raised service contract types (@services/types)
│   └── ...
└── repositories/
    ├── session.repository.ts
    ├── types.ts
    └── ...
```
````

Note the deliberate changes: `statistics/` removed; `services`, `repositories`, and `db` moved to `src/` top level (matching the real scaffold); `players/provision.ts` shown; `types.ts` barrels added per area.

- [ ] **Step 4: Add a "statistics deferred" note under the tree**

Immediately after the `## Route file mapping note` subsection (or after the tree if that subsection is absent), add:

```markdown
## Statistics (deferred)

No `statistics/` route folder exists in v1. Statistics endpoints
(`overview`, `trends`, `checkouts`) are deferred post-v1 and must each be
view-backed when built (see `00-Overview.md` and D63). <!-- 2026-07-13 -->
```

- [ ] **Step 5: Add a "Path aliases & type barrels" note referencing 03**

Under `# Shared Library Modules` (at its end), add:

```markdown
## Path aliases & type barrels

Import conventions are owned by `03-Shared-Conventions.md`: `@`-prefixed
aliases and `@<area>/types` type-raising barrels. The target alias set is
`@services`, `@repositories`, `@routes`, `@lib`, `@db`. This alias set and the
per-area `types.ts` barrels are the documented target for the frontend/API
implementation phase; `app/tsconfig.json` currently defines only a subset
(`@lib`, `@components`, …) and is extended when the endpoints are built.
<!-- 2026-07-13 -->
```

- [ ] **Step 6: Add `03` and `04` to Related Documents**

In the Related Documents table, add two rows:
```markdown
| `03-Shared-Conventions.md`       | Envelope builders, header contract, pagination, error registry, alias/barrel conventions | 2026-07-13 |
| `04-Endpoint-Contracts.md`       | Per-domain request/response contracts                   | 2026-07-13 |
```
(If the existing table has no date column, add the rows without a date column but include a `<!-- 2026-07-13 -->` comment on each.)

- [ ] **Step 7: Verify statistics gone, version bumped, refs present**

Run: `grep -n "statistics/" architecture/docs/architecture/06-API/02-Middleware-And-Layering.md`
Expected: no match inside the folder tree (only the "Statistics (deferred)" prose remains, which uses `statistics` without a trailing-slash route path — confirm the tree no longer lists a `statistics/` folder).
Run: `grep -n "1.0.0 (frozen v1)\|03-Shared-Conventions\|04-Endpoint-Contracts" architecture/docs/architecture/06-API/02-Middleware-And-Layering.md`
Expected: version line + both new Related-Documents rows present.

- [ ] **Step 8: Commit**

```bash
git add architecture/docs/architecture/06-API/02-Middleware-And-Layering.md
git commit -m "docs(api): reconcile and freeze 02 middleware/layering to v1.0.0

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019di6mNyvRq8nHy2722Xc1X"
```

---

### Task 3: Reconcile & freeze `01-Implementation-Strategy.md` to 1.0.0

**Files:**
- Modify: `architecture/docs/architecture/06-API/01-Implementation-Strategy.md`

**Interfaces:**
- Consumes: `02`'s route-class ownership (Task 2) — the middleware flow points here rather than restating it.
- Produces: nothing downstream (leaf reconciliation).

- [ ] **Step 1: Read the current file**

Read `architecture/docs/architecture/06-API/01-Implementation-Strategy.md` in full. Edit sites: header version line (`> **Version:** 0.2.0`), the `# Recommended Request Flow` fenced diagram + the sentence after it, and Related Documents (missing `03`/`04`).

- [ ] **Step 2: Bump the version line**

Change:
```markdown
> **Version:** 0.2.0
```
to:
```markdown
> **Version:** 1.0.0 (frozen v1)
```

- [ ] **Step 3: Repoint the request-flow section at `02`'s route-class model**

The current `src/middleware.ts` block in the flow lists a flat `verify JWT / resolve playerId / assign requestId` sequence that predates `02`'s public/protected/provision-exempt classes. Replace the `src/middleware.ts` node's bullet lines inside the diagram with a route-class-aware summary, and add a pointer sentence after the fenced block. Change the middleware node from:

```
src/middleware.ts
  • verify JWT (sub, exp)
  • resolve playerId → locals.auth
  • assign requestId
```
to:
```
src/middleware.ts
  • assign requestId → locals.requestId
  • classify route (public / protected / provision-exempt)
  • verify JWT (sub, exp); resolve playerId per class → locals.auth
```

Then, immediately after the existing `See 02-Middleware-And-Layering.md ...` line (or add it if absent), ensure this sentence is present:

```markdown
Route classification and the exact per-class middleware behavior are owned by `02-Middleware-And-Layering.md`; this diagram is a summary and defers to it. <!-- 2026-07-13 -->
```

- [ ] **Step 4: Add `03` and `04` to Related Documents**

In the Related Documents table, add:
```markdown
| `03-Shared-Conventions.md`       | Envelope, headers, pagination, error registry, alias/barrel conventions | 2026-07-13 |
| `04-Endpoint-Contracts.md`       | Per-domain request/response contracts                            | 2026-07-13 |
```

- [ ] **Step 5: Verify version + refs + pointer**

Run: `grep -n "1.0.0 (frozen v1)\|route-class\|classify route\|03-Shared-Conventions\|04-Endpoint-Contracts" architecture/docs/architecture/06-API/01-Implementation-Strategy.md`
Expected: version line, the reworked flow lines, the pointer, and both Related-Documents rows all present.

- [ ] **Step 6: Commit**

```bash
git add architecture/docs/architecture/06-API/01-Implementation-Strategy.md
git commit -m "docs(api): reconcile and freeze 01 implementation-strategy to v1.0.0

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019di6mNyvRq8nHy2722Xc1X"
```

---

### Task 4: `00-Overview.md` light touch — refresh `01`/`02` dates

**Files:**
- Modify: `architecture/docs/architecture/06-API/00-Overview.md`

**Interfaces:**
- Consumes: the fact that `01`/`02` are now updated `2026-07-13` (Tasks 2–3).
- Produces: nothing downstream.

- [ ] **Step 1: Read the Related Documents section**

Read the `## Related Documents` table at the end of `architecture/docs/architecture/06-API/00-Overview.md`. The `01-Implementation-Strategy.md` and `02-Middleware-And-Layering.md` rows currently carry `(2026-07-09)` parenthetical dates in their Purpose text.

- [ ] **Step 2: Refresh the two dates**

Change the trailing `(2026-07-09)` on the `01-Implementation-Strategy.md` row and on the `02-Middleware-And-Layering.md` row to `(2026-07-13)`. Leave all other rows untouched. Do **not** bump the `00` version.

- [ ] **Step 3: Confirm no stale statistics file reference**

Run: `grep -n "statistics/overview.ts\|statistics/" architecture/docs/architecture/06-API/00-Overview.md`
Expected: no output — `00` references statistics only as deferred endpoints, never as a file path. If any file-path reference exists, remove it (it would be stale after Task 2).

- [ ] **Step 4: Commit**

```bash
git add architecture/docs/architecture/06-API/00-Overview.md
git commit -m "docs(api): refresh 01/02 dates in 00-Overview related documents

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019di6mNyvRq8nHy2722Xc1X"
```

---

### Task 5: Context maintenance — map, decisions, validation gate

**Files:**
- Modify: `architecture/docs/architecture/00-Context-Map.md`
- Modify: `architecture/DECISIONS.md`

**Interfaces:**
- Consumes: the frozen state of `01`–`04` from Tasks 1–4.
- Produces: passing `scripts/check-context-map.sh`; the final freeze record.

- [ ] **Step 1: Read both files' relevant sections**

Read `architecture/docs/architecture/00-Context-Map.md` (the version line near the top, the `## API (06-API/)...` inventory table rows for `01`/`02`, and the `# Current Implementation State` "API docs" row). Read the tail of `architecture/DECISIONS.md` to confirm the max id is `D65` and to match the API-section table format.

- [ ] **Step 2: Bump the context-map version**

Change the map version (`> **Version:** 1.0.4 (2026-07-12)`) to `> **Version:** 1.0.5 (2026-07-13)`, and update the `updated:` field in the top HTML comment to `2026-07-13`.

- [ ] **Step 3: Update the `01`/`02` inventory rows**

In the `## API (06-API/) and Frontend (07-Frontend/)` table, the `01-Implementation-Strategy.md` and `02-Middleware-And-Layering.md` rows are `canonical` — no status change is needed, but confirm their "Answers" text still matches. If a version or date is embedded there, align it to the frozen `1.0.0`. (Token estimates may be left as-is; do not fabricate new counts.)

- [ ] **Step 4: Update the Current Implementation State "API docs" row**

Change the "API docs" status cell to reflect the full freeze, e.g.:
```markdown
| API docs | v1 frozen; contracts `00`–`04`; `01`/`02` frozen at 1.0.0, `03`→1.1.0 (@-alias + type-raising barrels) (2026-07-13) |
```

- [ ] **Step 5: Add D66 to DECISIONS.md**

In the API section table of `architecture/DECISIONS.md`, append:
```markdown
| D66 | 2026-07-13 | `06-API/` frozen v1: `01`/`02` frozen at 1.0.0, `03`→1.1.0; adopted `@`-prefixed aliases + `@<area>/types` type-raising barrels; removed the statistics route folder from the layering tree (statistics stay post-v1) | Close the API design layer with one coherent, self-consistent frozen contract before frontend work |
```
(Match the exact column structure of the surrounding rows — check whether the section uses `| # | Date | Decision | Rationale |` or `| # | Source | Decision | Rationale |` and follow it; D60–D65 use `Date`.)

- [ ] **Step 6: Run the validation gate**

Run: `bash scripts/check-context-map.sh`
Expected: exits 0 with a pass message. If it reports a missing/extra file or a broken reference, fix the offending row and re-run until it passes.

- [ ] **Step 7: Commit**

```bash
git add architecture/docs/architecture/00-Context-Map.md architecture/DECISIONS.md
git commit -m "docs(context): register 06-API v1 freeze; add D66; bump context map

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019di6mNyvRq8nHy2722Xc1X"
```

---

### Task 6: Final cross-doc verification & push

**Files:** none modified (verification only).

**Interfaces:**
- Consumes: all prior tasks.
- Produces: pushed branch ready for review.

- [ ] **Step 1: Confirm all five API docs are internally consistent**

Run:
```bash
grep -rnE "#(types|routes|services|lib|db)/" architecture/docs/architecture/06-API/    # expect: no output
grep -rn "statistics/overview.ts" architecture/docs/architecture/06-API/               # expect: no output
grep -rn "Version:" architecture/docs/architecture/06-API/                              # expect: 00=1.2.0, 01=1.0.0, 02=1.0.0, 03=1.1.0, 04=1.0.0
```
Expected: no `#`-aliases anywhere; no statistics file path; the five versions as listed.

- [ ] **Step 2: Re-run the context gate**

Run: `bash scripts/check-context-map.sh`
Expected: pass (exit 0).

- [ ] **Step 3: Review the full diff against main**

Run: `git diff origin/main --stat`
Expected: only the five `06-API/*` docs (four modified), `00-Context-Map.md`, `DECISIONS.md`, and the spec/plan files under `docs/superpowers/` appear. No `app/` files, no `tsconfig.json`.

- [ ] **Step 4: Push**

```bash
git push -u origin claude/api-folder-finalization-g5tzdh
```
Expected: branch updated on origin. (Retry with exponential backoff on network error only.)

- [ ] **Step 5: Report**

Summarize to the user: the five docs' final versions, the removed statistics folder, the adopted alias/barrel convention, and that the context gate passed. Do not open a PR unless asked.

---

## Notes for the implementer

- These tasks are strictly ordered: Task 1 establishes the convention Task 2 depends on; Task 2 establishes the route-class ownership Task 3 points to; Task 5's gate depends on all doc edits being present.
- If `scripts/check-context-map.sh` validates specific things (file existence, reference integrity), read it once before Task 5 so Step 4/5 edits satisfy it on the first try.
- If any target text in a "change from → to" step doesn't match the file verbatim (docs may have drifted), re-read the surrounding lines and adapt the edit to the same intent — do not force a mismatched replacement.
