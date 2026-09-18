<!--
status: design
scope: Phase 1 of the configurable-training-routines roadmap — player-authored routines: catalog picker, ordered step list, 30–60 minute bound, CRUD API, start-by-id, data-driven detail/play routes
read-when: writing or executing the Phase 1 implementation plan; extends docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md §3 and §8
updated: 2026-09-18
-->

# Custom Routine Builder (Phase 1) — Design

> Drafted without an interactive brainstorm (autonomous session). Every
> choice below that is a judgement call is marked **[decide]** and needs a
> human yes before the plan is written. Everything else follows from the
> roadmap (D305, D306), its corrections (D321) or the code as it is.

## 1. Problem

A player can run two system routines and build none. The schema has carried
routine ownership since `0004` (`routine_templates.player_id`,
`is_system_template`); nothing above it exists: no routine CRUD, no picker
catalog, no builder page, and — the gap the roadmap missed — no way to
*start* anything but a system routine by name.

What runs today, and what Phase 1 must generalise:

| Today | File | Constraint |
| --- | --- | --- |
| Start by name, system only | `app/src/repositories/training-session.repository.ts` `findRoutineTemplateSteps` | `routine_name = ? AND is_system_template = TRUE` (D299) |
| One play page, one routine | `app/src/lib/training/routines/balanced-training-play.data.ts` | `ROUTINE_NAME = "Balanced Training"` |
| Detail page is hand-written copy | `app/src/pages/training/balanced-training/index.astro` | four static step objects (D265) |
| Activity snapshot keyed by name | `training-session.service.ts` `startTraining` | `{ routineName, steps }` |
| Finishing template has no defaults | `database/seeds/0017_balanced_training_routine.sql` | `default_configuration = NULL`; TUOD config lives on the step |
| GAME step config never validated | `stepConfigurationIssues` returns early for `GAME` | issue #392 |

## 2. Scope

**In:**

1. A player composes an ordered list of steps from the system exercise
   catalog, sets each step's minutes, reorders, names the routine, saves.
2. Reopen and edit; delete.
3. Run it: the same training flow Balanced Training uses, keyed by routine
   id.
4. `/training` lists system routines and the player's own from the API.
5. The 30–60 minute bound for user routines, enforced at the database (D305)
   and pre-validated in the service and the client.

**Out (deferred, not forgotten):**

- Per-step configuration beyond duration (targets, patterns, game options).
  A step's `configuration` is `NULL`; the template's `default_configuration`
  applies. Phase 2's adapter registry is where a per-kind form attaches.
- Any new exercise or game in the catalog. Phase 1 ships against the four
  seeded templates: Warm-Up, Switching, Double Pattern, Finishing (TUOD).
- Drag-and-drop reorder (see §6.3 **[decide]**).
- Duplicating a routine ("save as"), schedules (Phase 3), sharing (Phase 4).

## 3. Database — migration `0038_custom_routines.sql`

One migration, four parts, no new tables. Never edits `0001`–`0037`.

### 3.1 Ownership check

```sql
ALTER TABLE routine_templates
ADD CONSTRAINT chk_routine_templates_player_ownership CHECK (
    (is_system_template AND player_id IS NULL)
    OR (NOT is_system_template AND player_id IS NOT NULL)
);
```

Stricter than `chk_configuration_templates_system_ownership` (which only
forbids a system row with an owner): a user routine with no owner is a row
nobody can list, edit or delete. Both seeded routines satisfy it. Name per
D310.

### 3.2 Duration bound (D305)

```sql
CREATE FUNCTION fn_routine_templates_duration_bounds() RETURNS trigger ...
CREATE CONSTRAINT TRIGGER trg_routine_steps_duration_bounds
    AFTER INSERT OR UPDATE OR DELETE ON routine_steps
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW ...
CREATE CONSTRAINT TRIGGER trg_routine_templates_duration_bounds
    AFTER INSERT OR UPDATE OF is_system_template ON routine_templates
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW ...
```

The function resolves the parent `routine_templates` row (for a `DELETE`
on `routine_steps`, `OLD.routine_template_id`; if the parent no longer
exists — cascade from a routine delete — it returns without checking). When
`is_system_template = FALSE` it sums `duration_value` over the routine's
steps whose `duration_types.implementation_key = 'MINUTES'` and raises
unless `30 <= sum <= 60`. `ROUNDS` rows contribute nothing, matching
`routine-duration.module.ts`.

The second trigger exists so a user routine cannot be *created* with zero
steps in a transaction that inserts none — the steps trigger would never
fire. Both are deferred to commit, so the builder's save
(update template → delete steps → insert steps) is checked once.

This is the repository's first trigger. `routine-duration.module.ts`'s
comment ("the repository uses no triggers") is updated in the same task,
and `05-Database/01-Principles.md`'s "constraints over application logic"
is the rule being applied, not bent: a cross-row aggregate has no `CHECK`
form.

### 3.3 `v_routine_execution` recreated (precedent `0036`)

`DROP VIEW` + `CREATE VIEW` adding, in this order after `is_system_template`:
`rt.player_id`, `rt.description AS routine_description`,
`et.description AS exercise_description`. Every existing column keeps its
name and position so `findRoutineTemplateSteps` and `schema.ts` change
additively. Consumers listed in `05-Database/05-Views/00-Overview.md` are
updated in the same task.

### 3.4 `v_exercise_template_catalog` (new)

```sql
CREATE VIEW v_exercise_template_catalog AS
SELECT et.id AS exercise_template_id, et.name, et.description,
       ext.implementation_key AS exercise_type_key,
       gt.implementation_key  AS game_type_key,
       et.default_configuration IS NOT NULL AS has_default_configuration
FROM exercise_templates et
JOIN exercise_types ext ON ext.id = et.exercise_type_id
LEFT JOIN game_types gt ON gt.id = et.game_type_id
WHERE et.is_system_template AND ext.is_published;
```

The picker reads only this. A template with `has_default_configuration =
FALSE` is filtered out by the service (§4.2) — it would resolve to `{}` at
start. After the seed in §3.5 all four templates pass.

### 3.5 Seed `0020_finishing_default_configuration.sql`

`UPDATE exercise_templates SET default_configuration = '{...six TUOD keys...}'`
for `0199b000-0000-7000-8000-000000000004`, the same values Balanced
Training's step 4 carries (`starting_target 41, finish_bonus 10, miss_penalty 1,
duration_type MINUTES, duration_value 10, max_darts_per_turn 3`). Idempotent
by construction (same value on re-run), the `0017` precedent for mutating
seeded JSONB. Balanced Training's step override stays — resolution is
unchanged for it.

The `duration_value` inside that JSON must follow the *step's* minutes for
a user routine: `resolveStep` already injects `stepDurationSeconds` for
`WARM_UP`; it gains the same for `GAME` steps whose game ruleset reads a
`duration_type`/`duration_value` pair (TUOD today), overwriting the two keys
from the step's own duration columns. Without this a 15-minute Finishing
step would run TUOD's 10-minute default.

### 3.6 Verification

`database/verification/0038_custom_routine_checks.sql`: the check rejects a
user routine at 25 and at 65 minutes, accepts 30 and 60, accepts the 5-minute
system Warm-Up, rejects an ownerless user routine, and confirms the catalog
view returns exactly four rows after `0020`.

## 4. Service and repository

### 4.1 Files

| New | Purpose |
| --- | --- |
| `app/src/services/routine.service.ts` | list / get / create / replace / delete; owns validation and the write transaction |
| `app/src/repositories/routine.repository.ts` | view reads (`v_routine_execution`, `v_exercise_template_catalog`), runtime-table writes (`routine_templates`, `routine_steps`) |
| `app/src/pages/api/routines/index.ts`, `[routineId].ts`, `types.ts` | controllers + Zod contracts (`06-API/04-Endpoint-Contracts.md` §Custom Routine Write Contracts) |
| `app/src/pages/api/exercise-templates/index.ts`, `types.ts` | catalog read |
| `app/src/lib/client/api/routines.ts` | client calls, `SessionApiError` envelope handling as `training-sessions.ts` |

Controller → Service → Repository (Pattern 6). Reads via views, writes in a
transaction (root invariant). Ids from `generateId()` (UUIDv7).

### 4.2 Validation (service, before any write)

| Rule | Failure |
| --- | --- |
| `name` trimmed, 1–60 chars; `description` ≤ 280 chars or null | `VALIDATION_FAILED` |
| `steps.length` 1–12 **[decide: cap]** | `VALIDATION_FAILED` |
| every `exerciseTemplateId` present in the catalog view with `has_default_configuration` | `VALIDATION_FAILED`, `details.step` |
| `durationTypeKey === "MINUTES"`; `durationValue` integer 1–60 | `VALIDATION_FAILED` |
| `validateRoutineDuration(steps, { minMinutes: 30, maxMinutes: 60 })` | `VALIDATION_FAILED`, `details.issues` |
| target routine not found, or owned by another player | `NOT_FOUND` |
| target routine `is_system_template` | `VALIDATION_FAILED`, `details.reason = "system routine is read-only"` |

`validateRoutineDuration` (`modules/training/routines/routine-duration.module.ts`)
gains an options argument with a `minMinutes` floor (default 0, so its
existing callers and tests are unchanged). The service imports it the way
`statistics.service.ts` imports from `@modules/` — one validator, shared by
client and server, with the trigger as the guarantee behind both.

### 4.3 Writes

- **Create:** one transaction: insert `routine_templates` (`player_id` =
  caller, `is_system_template = FALSE`), insert `routine_steps` with
  `sequence_number = index + 1`, `configuration = NULL`. Return the
  `RoutineExecution` read back through the view.
- **Replace:** same transaction shape after the ownership read: update
  `name`/`description`/`updated_at`, delete all steps, insert the new array.
  `uq_routine_steps_sequence` never conflicts because the delete precedes the
  insert in the same transaction and the trigger is deferred.
- **Delete:** delete the template; steps cascade. `204`. Completed
  trainings are unaffected: they hold a snapshot in
  `activity_configurations`, never a foreign key to the template (Pattern 4).
- A constraint or trigger violation that slips past pre-validation surfaces
  as `VALIDATION_FAILED` via the same classification helper
  `isActiveSessionConflict` uses (walk the `cause` chain, match the trigger's
  `ERRCODE`), never as a raw 500.

### 4.4 Start by id (D321)

`StartTrainingRequest` becomes `{ routineTemplateId: z.string() }`.
`findRoutineTemplateSteps(db, routineTemplateId, playerId)` filters
`routine_id = ? AND (is_system_template OR player_id = ?)`. Unknown or
foreign id → `VALIDATION_FAILED` `{ reason: "unknown routineTemplateId" }`
(the code the caller already handles). The snapshot written to
`activity_configurations.configuration` becomes
`{ routineTemplateId, routineName, steps }` — additive, existing snapshots
still parse.

`startTraining` also validates a `GAME` step's merged configuration with
`getRulesetValidator(FINISHING_RULESET_VERSION_KEY).validateConfig` under
the `ANALYTICS`/`VISUAL_BOARD` pair the routine path fixes (issue #392's
proposed fix, scoped to the one game ruleset Phase 1 can run). Phase 2
generalises the key.

## 5. API (contract already frozen — D306, D321)

| Endpoint | Notes |
| --- | --- |
| `GET /api/exercise-templates` | `ExerciseTemplateCatalogEntry[]`; system content, still behind auth like every route |
| `GET /api/routines` | `ListResult<RoutineSummary>`, `nextCursor: null` (a player owns tens, not thousands); ordered system first, then own by `name` |
| `GET /api/routines/:routineId` | `RoutineExecution`; system or owner, else `NOT_FOUND` |
| `POST /api/routines` | `CreateRoutineRequest` → `201 RoutineExecution` |
| `PUT /api/routines/:routineId` | `UpdateRoutineRequest` → `200 RoutineExecution` |
| `DELETE /api/routines/:routineId` | `204` |
| `POST /api/training-sessions` | body `{ routineTemplateId }` |

`totalMinutes` on `RoutineSummary` is computed in the service from the
step rows (sum of `MINUTES`), never stored (§6 of `01-Routines.md`).

## 6. Frontend

### 6.1 Routes (all prerendered shells; ids travel in the query string, the `game-layout.data.ts` precedent)

| Route | Replaces | Data |
| --- | --- | --- |
| `/training` | static cards | `GET /api/routines` → one `GameCard` per routine (duration badge from `totalMinutes`), plus a "New routine" card and the unchanged Quick Subtract card |
| `/training/routines/detail?routine=<id>` | `/training/balanced-training` | `GET /api/routines/:id` into `RoutineDetail.astro` (props unchanged: name, `"<n> min"`, `exerciseDescription`); `Start` → play route; `Edit`/`Delete` shown for own routines only |
| `/training/routines/play?routine=<id>` | `/training/balanced-training/play` | `balanced-training-play.data.ts` → `routine-play.data.ts`: `ROUTINE_NAME` removed, id read from the URL, everything else byte-identical |
| `/training/routines/new`, `/training/routines/edit?routine=<id>` | — | the builder (§6.2) |

The two `balanced-training` routes are deleted, not redirected — nothing
links to them but `/training`. Tests re-point to the same guarantee at the
new module name, never to a different input (root invariant).

### 6.2 Builder page

`components/layout/training/routines/RoutineBuilder.astro` mounted on
`routineBuilder(mode, routineId)` (`lib/training/routines/routine-builder.data.ts`):

- **Header:** name input, optional description.
- **Step list:** one `RoutineStepRow.astro` per step — position, exercise
  name, minutes input (1–60), move-up / move-down / remove `IconBtn`s.
- **Picker:** `ExercisePicker.astro` — the catalog as `RadioCard`-shaped
  tiles; tapping appends a step with a default of 5 minutes **[decide:
  default]**.
- **Footer:** live total (`validateRoutineDuration` on every change),
  the 30–60 rule stated in words, `Save` disabled until valid, `Cancel`.
- Edit mode loads `GET /api/routines/:id` into the same state and submits
  `PUT`; create submits `POST`. Both navigate to the detail route on success
  and show the envelope's `details.issues` inline on `VALIDATION_FAILED`.

State stays in the page's `x-data`; nothing here belongs in a store
(`app/src/stores/CLAUDE.md`). Style tokens per `07-Style-Guide.md`; no new
utility classes.

### 6.3 Reorder mechanism **[decide]**

Recommended: move-up / move-down buttons, no new dependency.

- No drag → no `touch-none`/magnifier interaction with the board input
  rules in `07-Style-Guide.md`, no pointer-capture edge cases on iOS
  standalone, keyboard-operable for free.
- A 12-step list is at most 11 taps to move anything anywhere.
- `@alpinejs/sort` is still available later; adopting it is one component
  change and a `package.json` line, which `07-Frontend/00-Overview.md`
  already says to confirm at this phase. If chosen instead, record the
  decision and add `@types/alpinejs__sort`.

### 6.4 Component inventory

`RoutineBuilder.astro`, `RoutineStepRow.astro`, `ExercisePicker.astro`
register under `components/layout/training/routines/` in
`07-Frontend/08-Component-Inventory.md` (the folder row is already flat per
issue #423 — this task adds rows, it does not restructure).

## 7. Tests (TDD, `app/CLAUDE.md` §Test-Driven Development)

| Layer | File | Asserts |
| --- | --- | --- |
| module | `tests/modules/training/routines/routine-duration.module.test.ts` | floor option: 29 fails, 30 passes, 60 passes, 61 fails; `ROUNDS` contributes 0; default floor 0 keeps existing cases green |
| service | `tests/services/routine.service.test.ts` | each §4.2 rule; system routine write → `VALIDATION_FAILED` reason; foreign id → `NOT_FOUND`; replace deletes-then-inserts in one `withTransaction`; `sequence_number` from index |
| service | `tests/services/training-session.service.test.ts` | start by id: own, system, foreign; snapshot carries `routineTemplateId`; GAME config validated; duration keys injected from the step |
| repository | `tests/repositories/routine.repository.test.ts` | view queries filter `is_system_template OR player_id` |
| pages/api | `tests/pages/api/routines.test.ts` | envelopes, status codes, `sequence_number` ignored if sent |
| lib | `tests/lib/training/routines/routine-builder.data.test.ts` | add/move/remove/minutes → total; save disabled state; edit-mode load |
| db | `database/verification/0038_custom_routine_checks.sql` | §3.6 |

## 8. Documentation and decisions owed by the implementation

- `05-Database/06-Spec/02-Template-Layer.md`: replace the "Planned
  (unbuilt)" paragraphs with what shipped; `05-Views/00-Overview.md`: the
  recreated view and the new catalog view; `03-Migrations.md`: a `0038`
  section (the per-migration list stops at `0022`, issue #288 — add `0038`
  without back-filling the gap); `10-Database-Agent-Guide.md` quick
  reference; root `CLAUDE.md` and the context map's migration range
  `0001`–`0038`.
- `06-API/04-Endpoint-Contracts.md` and `00-Overview.md`: strike "planned /
  not implemented" from the routine rows; `03-Shared-Conventions.md`
  unchanged (no new code).
- `09-Training/01-Routines.md` §7 and §20: status lines become "shipped".
- `07-Frontend/00-Overview.md`: the builder paragraph becomes present tense
  and names the reorder choice; `02-Folder-Structure.md` if the route list
  is enumerated there.
- Decisions to append (domain file per `DECISIONS.md`): the reorder
  mechanism (`decisions/frontend/alpine.md` or `architecture.md`); the
  first trigger in the repository and its error classification
  (`decisions/database.md`); replacing `routineTemplateName` with
  `routineTemplateId` (already D321 — cite, do not repeat).
- File Inventory rows for every new file; history entry.

## 9. Risks and open points

- **Trigger and `db:introspect`:** `schema.ts` is hand-maintained in
  practice (issue #404). The view column additions must be mirrored by hand
  if introspection rewrites more than it should.
- **Deploy order:** `0038` needs no seed before it; `0020` needs `0038`'s
  nothing. Safe under `deploy.yml`'s migrate-then-seed (issue #378 does not
  bite here).
- **Name collisions:** two own routines may share a name. No uniqueness is
  added — the id is the key everywhere after D321, and a rule here would be
  a product choice nobody asked for. **[decide]**
- **Phase 3 hook:** once schedules exist, `DELETE` on a scheduled routine is
  blocked by `RESTRICT`; Phase 3 maps that to `VALIDATION_FAILED`
  `{ reason: "routine in use", scheduleIds }`. Nothing to build now.

## 10. Plan seeds (order for `superpowers:writing-plans`)

1. `0038` migration + verification SQL + seed `0020` (red: verification fails on the empty chain).
2. `routine-duration.module` floor option.
3. Repository + service + API routes, TDD per §7.
4. `startTraining` by id + GAME validation + duration injection; re-point existing tests.
5. Client API module; `/training` list; detail and play routes by id; delete the two static routes.
6. Builder page and components.
7. Docs, decisions, inventory, gates (`run-all-gates`, `context-maintenance`).
