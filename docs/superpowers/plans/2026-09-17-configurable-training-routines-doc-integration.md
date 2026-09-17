# Configurable Training Routines — Doc Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the four-phase roadmap in `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` into the canonical architecture docs it extends, so a future task loading the normal context packs sees the roadmap without having to know the spec file exists.

**Architecture:** Docs-only. No schema migration, no API route, no frontend component is written in this plan — every edit either (a) extends an existing canonical doc with a clearly-marked "planned/unbuilt" note pointing at the roadmap spec, or (b) records a design decision the roadmap already made, so implementation doesn't relitigate it later. This mirrors how D299 documented the unbuilt `GET /api/routines*` contract before it existed.

**Tech Stack:** Markdown only (`docs/architecture/**`, `decisions/**`, `DECISIONS.md`). Verification is the repo's own doc-integrity scripts, not a test runner.

## Global Constraints

- Edit the canonical doc for each domain first (docs/CLAUDE.md Editing Workflow); this plan already targets the canonical file per domain — do not also edit a secondary/historical doc.
- Never mark unbuilt work as done. Every inserted sentence about Phase 1-4 says "planned"/"unbuilt" and cites the roadmap spec path or the new decision id.
- Never invent a Decision for something with no rationale to weigh — Phase 3/4 (schedules, sharing) have open questions per the spec, so they go into `DECISIONS.md`'s Deferred list, not a numbered decision block. Phase 1's two concrete design choices (duration-floor scoping, write-contract shape) do get numbered decisions, because each weighed an alternative and has a reason — same bar D299 used.
- Decision ids: next available is **D305** (highest existing is D304 — re-derive with `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1` before writing, in case another task landed a decision first).
- Preserve existing heading numbers in `09-training-routines.md` (§1-29) — insert new content as sub-headings inside the existing numbered section it belongs to, never renumber downstream sections.
- After every task's edit, run the stated verification command(s) before committing. If `scripts/check-context-budget.sh` fails on a touched file, it prints the expected `~Nk` value — use that exact value in the File-Inventory row, never a guessed one.
- Commit each task separately (small, reviewable diffs per docs/CLAUDE.md's "minimal diff" rule).

---

### Task 1: Record D305 — duration-floor scoping decision

**Files:**
- Modify: `decisions/database.md` (append after its last existing block)

**Interfaces:**
- Produces: decision id `D305`, cited by Task 3 (`09-training-routines.md`) and Task 4 (`02-Template-Layer.md`).

- [ ] **Step 1: Append the decision block**

Append at the end of `decisions/database.md` (after the last existing `### D...` block, never inside the table above it):

```markdown
### D305 — Custom-routine duration floor is a deferred constraint trigger scoped to user-owned routines
Status: Accepted · Date: 2026-09-17
Decision: The planned 30-60 minute duration bound for player-authored routines (`docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` §3.2-3.3) is enforced by a deferred constraint trigger on `routine_steps`, evaluated at transaction commit, checking the step-duration sum only when the parent `routine_templates.is_system_template = FALSE`. No `CHECK` constraint is used — a per-row `CHECK` cannot express a cross-row aggregate.
Reason: A universal 30-minute floor would invalidate the seeded 5-minute "Warm-Up" system routine (`database/seeds/0015_warm_up_routine.sql`), used both standalone and as Balanced Training's own first step. Scoping the floor to non-system routines preserves existing seed data with no special case in application code. Deferring the check to commit lets the routine builder's save (delete-all-steps, reinsert-new-order) validate once, not after every intermediate statement.
Consequences: unbuilt — no migration exists yet; this records the design so Phase 1's implementation doesn't relitigate it. The existing ≤60 minute ceiling (`09-training-routines.md` §7) is unchanged and continues to apply to every routine, system or user.
Supersedes: none.
```

- [ ] **Step 2: Verify id uniqueness and table membership**

Run: `git grep -c 'D305' decisions/database.md` — expect `1` (only the block you just added). Run: `bash scripts/check-decision-ids.sh` — expect exit `0`.

- [ ] **Step 3: Commit**

```bash
git add decisions/database.md
git commit -m "Record D305: scope the custom-routine duration floor to user-owned routines"
```

---

### Task 2: Record D306 — routine write-contract decision

**Files:**
- Modify: `decisions/api.md` (append after its last existing block)

**Interfaces:**
- Consumes: D299 (already in `decisions/api.md`) as the precedent this decision follows.
- Produces: decision id `D306`, cited by Task 5 (`04-Endpoint-Contracts.md`).

- [ ] **Step 1: Append the decision block**

Append at the end of `decisions/api.md`:

```markdown
### D306 — Custom-routine CRUD and the exercise-template catalog get a planned write contract alongside the existing unbuilt reads
Status: Accepted · Date: 2026-09-17
Decision: Per `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` §3.4, the routine contract gains four planned (unbuilt) endpoints alongside the three `GET /api/routines*` rows D299 already marked unbuilt: `GET /api/exercise-templates` (picker catalog), `POST /api/routines`, `PUT /api/routines/:routineId`, `DELETE /api/routines/:routineId`. Writes are player-scoped: a caller may only create/modify/delete their own routines, never a system routine (`is_system_template = TRUE`) or another player's. `PUT` replaces the full ordered step array; `sequence_number` is assigned server-side from array position, never trusted from the request body.
Reason: A full-replace `PUT` avoids a partial-reorder patch DSL for the "swappable list" builder UI, which always holds the complete order in memory client-side. Rejecting writes to system/other-player routines needs no new authorization mechanism — the same identity-from-JWT check every other player-scoped write already uses.
Consequences: unbuilt — no route handlers exist yet. `04-Endpoint-Contracts.md` documents the shape now so Phase 1 implementation has a frozen target, consistent with how D299 documented the read side before it was built.
Supersedes: none.
```

- [ ] **Step 2: Verify**

Run: `git grep -c 'D306' decisions/api.md` — expect `1`. Run: `bash scripts/check-decision-ids.sh` — expect exit `0`.

- [ ] **Step 3: Commit**

```bash
git add decisions/api.md
git commit -m "Record D306: planned write contract for custom-routine CRUD"
```

---

### Task 3: Fold the duration floor and Phase-1 status into `09-training-routines.md`

**Files:**
- Modify: `docs/architecture/09-training-routines.md` (§7, §20)

**Interfaces:**
- Consumes: `D305` (Task 1).

- [ ] **Step 1: Extend §7 with the user-routine floor**

Find this exact text (end of §7, before its closing `---`):

```
Such a concept is intentionally outside the current scope.

---

# 8. Training Orchestration
```

Replace with:

```
Such a concept is intentionally outside the current scope.

### User-Created Routine Floor (planned, unbuilt)

A player-authored routine additionally satisfies a floor:

```text
30 minutes <= user routine.duration <= 60 minutes
```

The floor applies only when `routine_templates.is_system_template = FALSE`. It
does not apply to system routines — the seeded "Warm-Up" routine
(`database/seeds/0015_warm_up_routine.sql`) is 5 minutes total by design, used
both standalone and as a step inside Balanced Training. Scoping the floor to
user-authored routines preserves that without a special case. See D305 and
`docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md`
§3.2-3.3 for the enforcement mechanism (a deferred constraint trigger on
`routine_steps`, not yet migrated).

---

# 8. Training Orchestration
```

- [ ] **Step 2: Add a status note to §20**

Find this exact text (end of §20, before its closing `---`):

```
A user therefore selects:

```text
Exercise Type
    +
Configuration
    +
Duration
```

rather than creating a new engine.

---

# 21. Adaptive Training
```

Replace with:

```
A user therefore selects:

```text
Exercise Type
    +
Configuration
    +
Duration
```

rather than creating a new engine.

**Status (2026-09-17):** sequenced as Phase 1 of
`docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md`.
The ownership columns this section anticipates already exist
(`routine_templates.player_id`, `is_system_template`, migration `0004`); the
CRUD API and builder UI do not. See D305/D306 for the duration-bound and
endpoint-contract decisions the roadmap fixed ahead of implementation.

---

# 21. Adaptive Training
```

- [ ] **Step 3: Bump the doc's own version/date line**

Find:

```
read-when: training routines, exercises, exercise engines, configurable/adaptive training
updated: 2026-09-01
-->
```

Replace with:

```
read-when: training routines, exercises, exercise engines, configurable/adaptive training
updated: 2026-09-17
-->
```

- [ ] **Step 4: Verify**

Run: `bash scripts/check-doc-links.sh` — expect exit `0` (confirms the new spec-path references resolve).

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/09-training-routines.md
git commit -m "Fold Phase 1 duration floor and status into 09-training-routines.md"
```

---

### Task 4: Note the planned trigger in the Template-Layer spec

**Files:**
- Modify: `docs/architecture/05-Database/06-Spec/02-Template-Layer.md` (`routine_steps` § Design Rationale)

**Interfaces:**
- Consumes: `D305` (Task 1).

- [ ] **Step 1: Append the planned-trigger note**

Find this exact text:

```
Resolution merges `exercise_templates.default_configuration` with this column to produce the
**Resolved Training Configuration** (§18) copied into `activity_configurations` at Training start.
This is the seam §21 adaptive resolution occupies later, with no further schema change.

---

# configuration_templates (migration 0010)
```

Replace with:

```
Resolution merges `exercise_templates.default_configuration` with this column to produce the
**Resolved Training Configuration** (§18) copied into `activity_configurations` at Training start.
This is the seam §21 adaptive resolution occupies later, with no further schema change.

**Planned (unbuilt):** a deferred constraint trigger will enforce a 30-60
minute total-duration bound on a routine's steps when its parent
`routine_templates.is_system_template = FALSE` (D305). System routines stay
governed by the existing ≤60 minute ceiling only (`09-training-routines.md` §7).
See `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md`
§3.3.

---

# configuration_templates (migration 0010)
```

- [ ] **Step 2: Bump the doc's date line**

Find:

```
read-when: adding/changing exercise/routine/configuration templates
updated: 2026-09-10
-->
```

Replace with:

```
read-when: adding/changing exercise/routine/configuration templates
updated: 2026-09-17
-->
```

- [ ] **Step 3: Verify**

Run: `bash scripts/check-doc-links.sh` — expect exit `0`.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/05-Database/06-Spec/02-Template-Layer.md
git commit -m "Note the planned user-routine duration trigger in the Template-Layer spec"
```

---

### Task 5: Expand the routine contract in `04-Endpoint-Contracts.md`

**Files:**
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md`

**Interfaces:**
- Consumes: `D306` (Task 2).
- Produces: DTO names `CreateRoutineRequest`, `UpdateRoutineRequest`, `RoutineStepInput` — for any later task/plan implementing Phase 1 to reuse verbatim, not rename.

- [ ] **Step 1: Add the catalog read row**

Find this exact text:

```
| `GET /api/routines/:routineId/execution` (not implemented) | `v_routine_execution` | `RoutineExecution` | 2026-07-12 |
| `GET /api/configuration-templates` | `v_configuration_presets` | `ConfigurationPreset[]` | 2026-07-13 |
```

Replace with:

```
| `GET /api/routines/:routineId/execution` (not implemented) | `v_routine_execution` | `RoutineExecution` | 2026-07-12 |
| `GET /api/exercise-templates` (not implemented) | *planned view, not yet defined* | `ExerciseTemplateCatalogEntry[]` | 2026-09-17 |
| `GET /api/configuration-templates` | `v_configuration_presets` | `ConfigurationPreset[]` | 2026-07-13 |
```

- [ ] **Step 2: Add the Write Contracts section**

Find this exact text:

```
**Authorization:** All reads are player-scoped; filters applied at view level or service layer ensure only the requesting player's data is returned.

---

## Response DTOs
```

Replace with:

```
**Authorization:** All reads are player-scoped; filters applied at view level or service layer ensure only the requesting player's data is returned.

---

## Custom Routine Write Contracts (planned, Phase 1 — unbuilt)

Per D306 and `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md`
§3.4. Not implemented — documented ahead of the builder so implementation has
a frozen target, the same approach D299 took for the read side.

| Endpoint | Body | Response | Ownership |
| -------- | ---- | -------- | --------- |
| `POST /api/routines` | `CreateRoutineRequest` | `RoutineExecution` | creates under caller's `player_id` |
| `PUT /api/routines/:routineId` | `UpdateRoutineRequest` | `RoutineExecution` | owner only |
| `DELETE /api/routines/:routineId` | — | `204` | owner only, never a system routine |

`PUT` replaces `name`/`description`/the full ordered `steps[]` — no partial-reorder
patch. `sequence_number` is assigned server-side from array position and is
never accepted from the request body. Any write against a system routine
(`is_system_template = TRUE`) or a routine owned by another player returns the
standard 403/404 domain error envelope.

---

## Response DTOs
```

- [ ] **Step 3: Add the request DTO sketches**

Find this exact text:

```
const RoutineExecution = z.object({         // GET /routines/:id and /:id/execution → RoutineExecution
  routineId: z.string(), routineName: z.string(),
  steps: z.array(RoutineStep),
});

const BatchWriteResponse = z.object({       // POST /sessions/:id/events/batch — counts only
```

Replace with:

```
const RoutineExecution = z.object({         // GET /routines/:id and /:id/execution → RoutineExecution
  routineId: z.string(), routineName: z.string(),
  steps: z.array(RoutineStep),
});

const RoutineStepInput = z.object({         // request shape inside steps[] — POST/PUT /routines
  exerciseTemplateId: z.string(),
  durationValue: z.number().int(), durationTypeKey: z.string(),
});
const CreateRoutineRequest = z.object({     // POST /routines body → RoutineExecution
  name: z.string(), description: z.string().nullable(),
  steps: z.array(RoutineStepInput),
});
const UpdateRoutineRequest = CreateRoutineRequest; // PUT /routines/:id body — full replace, same shape

const BatchWriteResponse = z.object({       // POST /sessions/:id/events/batch — counts only
```

- [ ] **Step 4: Extend the DTO-mapping paragraph**

Find this exact text:

```
All read DTOs are flat and close to 1:1 with their view, except `RoutineExecution`, which groups the step-level `v_routine_execution` rows into a routine with an ordered `steps[]`. `PATCH /api/sessions/:sessionId` returns the updated `SessionOverview`. `POST /api/players/provision` returns `ProvisionPlayerResponse` (defined under Player Provisioning). `POST /api/sessions` returns `CreateSessionResponse` (defined under Session Creation). `GET`/`PATCH /api/players/me/settings` return `PlayerSettingsResponse` (defined under Player Settings). `GET /api/statistics/overview` returns `StatisticsOverviewResponse` (defined under Statistics Overview).
```

Replace with:

```
All read DTOs are flat and close to 1:1 with their view, except `RoutineExecution`, which groups the step-level `v_routine_execution` rows into a routine with an ordered `steps[]`. `PATCH /api/sessions/:sessionId` returns the updated `SessionOverview`. `POST /api/players/provision` returns `ProvisionPlayerResponse` (defined under Player Provisioning). `POST /api/sessions` returns `CreateSessionResponse` (defined under Session Creation). `GET`/`PATCH /api/players/me/settings` return `PlayerSettingsResponse` (defined under Player Settings). `GET /api/statistics/overview` returns `StatisticsOverviewResponse` (defined under Statistics Overview). `POST`/`PUT /api/routines` return the updated `RoutineExecution`; `CreateRoutineRequest`/`UpdateRoutineRequest` (planned, D306) are the request DTOs.
```

- [ ] **Step 5: Verify**

Run: `bash scripts/check-doc-links.sh` — expect exit `0`.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/06-API/04-Endpoint-Contracts.md
git commit -m "Document the planned custom-routine write contract (D306)"
```

---

### Task 6: Point `07-Frontend/00-Overview.md` at the planned builder

**Files:**
- Modify: `docs/architecture/07-Frontend/00-Overview.md`

- [ ] **Step 1: Add the forward pointer**

Find this exact text:

```
Structural patterns (folders, Alpine, modules) live in the handbook chapters below.

---

# Handbook Index
```

Replace with:

```
Structural patterns (folders, Alpine, modules) live in the handbook chapters below.

A player-authored routine builder is planned (Phase 1 of
`docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md`)
against the unbuilt `/api/routines` write contract in `06-API/04-Endpoint-Contracts.md`.
Its drag-reorder mechanism (`@alpinejs/sort`) is a proposed dependency, not yet
adopted — confirm it at that phase's own brainstorm before adding it to
`app/package.json`.

---

# Handbook Index
```

- [ ] **Step 2: Bump the doc's date**

Find:

```
scope: frontend/integration
read-when: frontend API integration and state ownership
updated: 2026-08-26
-->
```

Replace with:

```
scope: frontend/integration
read-when: frontend API integration and state ownership
updated: 2026-09-17
-->
```

- [ ] **Step 3: Verify**

Run: `bash scripts/check-doc-links.sh` — expect exit `0`.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/07-Frontend/00-Overview.md
git commit -m "Point Frontend Overview at the planned routine-builder phase"
```

---

### Task 7: Defer Phase 3 and Phase 4 in `DECISIONS.md`

**Files:**
- Modify: `DECISIONS.md` (Deferred list)

- [ ] **Step 1: Extend the Deferred list**

Find this exact text (end of the Deferred paragraph, in `## Deferred (open, not rejected)`):

```
· 501 capture mode — DETAILED_DARTS, or a schema revision adding an attempted-score / void-visit fact, so a bust stops being indistinguishable from a scoreless visit and bust rate + true checkout attempts become computable (2026-07-26)
```

Replace with:

```
· 501 capture mode — DETAILED_DARTS, or a schema revision adding an attempted-score / void-visit fact, so a bust stops being indistinguishable from a scoreless visit and bust rate + true checkout attempts become computable (2026-07-26) · named, swappable weekly training schedules linking routines to days of week, incl. the active-schedule-resolution mechanism (`docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` §5) · copy-on-share custom routines, incl. recipient identification (same spec §6)
```

- [ ] **Step 2: Verify**

Run: `bash scripts/check-doc-links.sh` — expect exit `0`.

- [ ] **Step 3: Commit**

```bash
git add DECISIONS.md
git commit -m "Defer weekly schedules and routine sharing (Phases 3-4) in the ledger"
```

---

### Task 8: Sync `00-File-Inventory.md`

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md`

**Interfaces:**
- Consumes: the five files Tasks 3-6 touched (`09-training-routines.md`, `02-Template-Layer.md`, `04-Endpoint-Contracts.md`, `07-Frontend/00-Overview.md`) plus the two decision files.

- [ ] **Step 1: Run the budget script to get real token deltas**

Run: `bash scripts/check-context-budget.sh`

Expected: `FAIL` lines naming `09-training-routines.md`, `06-Spec/02-Template-Layer.md`, `06-API/04-Endpoint-Contracts.md`, and `07-Frontend/00-Overview.md`, each printing the file's actual computed `~Nk` value (the script computes `chars/4/1000`, see `scripts/check-context-budget.sh`). Record each printed value — Step 2 uses them verbatim, not an estimate.

- [ ] **Step 2: Update the four rows with the printed values and a one-line summary**

In `docs/architecture/00-File-Inventory.md`, for each of the four rows, append `; Phase 1 custom-routine-builder roadmap noted (2026-09-17)` to the existing "Answers" cell text and replace the `~Tokens` value with the exact figure Step 1 printed for that file. Do not touch any other row.

- [ ] **Step 3: Bump the map's own header date**

Find:

```
status: canonical
scope: canonical file inventory — what each document answers
read-when: a context pack demonstrably lacks the answer
updated: 2026-09-16
-->
```

Replace with:

```
status: canonical
scope: canonical file inventory — what each document answers
read-when: a context pack demonstrably lacks the answer
updated: 2026-09-17
-->
```

- [ ] **Step 4: Re-run the budget script to confirm it now passes**

Run: `bash scripts/check-context-budget.sh` — expect exit `0`, no `FAIL` lines for the four files.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/00-File-Inventory.md
git commit -m "Sync File Inventory token counts and summaries after roadmap integration"
```

---

### Task 9: Full context-integrity gate and history entry

**Files:**
- Modify: `docs/architecture/00-Context-Map-History.md` (append-only, via the skill below — do not hand-edit)

- [ ] **Step 1: Run the full gate**

Run in order, each expected to exit `0`:

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-decision-ids.sh
```

If any fails, fix the specific file it names before proceeding — do not skip a failing script.

- [ ] **Step 2: Invoke the `context-maintenance` skill**

Run the `context-maintenance` skill to append the per-task version entry to `00-Context-Map-History.md` and confirm nothing else in the Context Maintenance protocol was missed (root `CLAUDE.md`).

- [ ] **Step 3: Invoke the `run-all-gates` skill**

Run the `run-all-gates` skill (docs-only change set) to get an explicit pass/fail statement for every check script touched by Tasks 1-8, rather than re-deriving that list by hand.

- [ ] **Step 4: Commit the history entry (if the skill did not already commit it)**

```bash
git status --short
```

If `00-Context-Map-History.md` shows as modified and uncommitted:

```bash
git add docs/architecture/00-Context-Map-History.md
git commit -m "Record context-map history entry for the routine roadmap doc integration"
```

---

## Self-Review Notes

- **Spec coverage:** §3.2/§3.3 (duration floor) → Tasks 1, 3, 4. §3.4 (API contract) → Tasks 2, 5. §3.5 (frontend) → Task 6. §5/§6 (Phases 3-4, both explicitly open) → Task 7. §4 (Phase 2) needs no doc change — the spec itself says it requires no new architecture, so there is nothing to fold in beyond the roadmap doc that already exists.
- **No placeholders:** every inserted sentence names a concrete file, decision id, or spec section; the one genuinely-deferred figure (File Inventory `~Tokens`) is resolved by running a script, not by guessing, per Task 8.
- **Scope:** docs-only, single subsystem (documentation integration of one already-approved spec) — no further decomposition needed.
