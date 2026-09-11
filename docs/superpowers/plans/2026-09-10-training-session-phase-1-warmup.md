<!--
status: historical
scope: implementation plan — training session phase 1 (warm-up), sub-phases 1–2
read-when: implementing migration 0027–0031 or the exercise/training engines
updated: 2026-09-10
-->

# Training Session Phase 1 (Warm-Up) — Implementation Plan: Schema + Engines

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the database schema and the domain engines for the first training session — a one-exercise system routine running a non-game Warm-Up — with no API route and no UI yet.

**Architecture:** The template layer already exists (`exercise_templates`, `routine_templates`, `routine_steps`, migration `0004`) but assumes every exercise is game-bound. This plan generalises it with an `exercise_types` catalog and a separate `exercise_ruleset_versions` table, relaxes the game-bound columns on `exercise_sessions` to nullable under two independent CHECK constraints, adds per-step configuration to `routine_steps`, and adds an `activity_configurations` snapshot so a training run records the routine it executed without holding a foreign key to a template. On top of that, a `WarmUpEngine` implements a new `ExerciseEngine` contract parallel to `GameEngine`, and a thin `TrainingEngine` orchestrates ordered steps.

**Tech Stack:** PostgreSQL (Neon) + dbmate migrations, `psql` verification scripts, TypeScript, Zod, Vitest, drizzle-kit (introspect only).

**Spec:** `docs/superpowers/specs/2026-09-10-training-session-phase-1-warmup-design.md`
**Architecture doc:** `docs/architecture/09-training-routines.md` (§ references throughout)

## Global Constraints

- Never modify an applied migration (`0001`–`0026`). New schema change = new numbered migration.
- Migrations are schema-only. Controlled data — including lookup backfills — goes in `database/seeds/`.
- Seeds are auto-discovered from `database/seeds/*.sql` in filename order by `app/scripts/seed.ts`, and every seed file runs **twice** per `npm run db:seed`. Every statement must therefore be idempotent (`ON CONFLICT DO NOTHING`, or an `UPDATE ... WHERE col IS NULL`).
- Apply order for this plan is `db:migrate` → `db:seed` → `db:migrate` (the `0019`/`0020` precedent), because a `NOT NULL` on a backfilled column can only be set after the seed that fills it.
- No database-generated ids. UUIDs for `exercise_types`, `exercise_ruleset_versions`, `activity_configurations`; explicit deterministic UUIDs in seeds.
- Reference-table PK rule: SMALLINT for fixed structural enums (`stage_types`), UUID for growing catalogs (`game_types`, and now `exercise_types`).
- No runtime table may hold a foreign key to a template table (`02-Template-Layer.md` line 39).
- Documentation-first (`docs/CLAUDE.md`): the database spec chapters are updated **before** the migrations, in Task 1.
- Every schema behaviour that can only be proven against a live database ships a `database/verification/*.sql` script that builds its own fixture, resolves lookups by `implementation_key`, and ends in `ROLLBACK` (D193). There is no PostgreSQL server in the container — these scripts are run by the repo owner against Neon before merge, and that is the honest limit of local verification for Part A.
- `app/src/**` comment rule: no `//` or `/* */` comments inside function bodies; detail goes in a JSDoc block above the declaration; never restate decision history in a comment.
- A source edit under `app/src/` with no matching test edit fails `scripts/check-test-coverage.sh`. Type-only edits are exempt, derived not listed.
- `npm run validate:app` must exit zero with **0 errors, 0 warnings, 0 hints**, and `npm run format` must be run and committed before any PR.
- At most one open task branch may target another (`branch-stack-cap` in `.github/workflows/pr-gates.yml`). Part B targets Part A; nothing may stack on Part B.
- No git worktrees. `git checkout -b <branch>` in the main working copy.

## Deviation from the spec, decided in planning

The spec's §4 gives `WarmUpEngine` the state shape `{currentPhaseIndex, overallElapsed, completed}`. `overallElapsed` is dropped from the engine here: `09-training-routines.md` §9 requires an `ExerciseEngine` to be *deterministic with respect to its inputs, configuration and ruleset*, and an engine that reads a wall clock is not. Elapsed time is owned by the frontend controller (sub-phase 4), exactly as the MINUTES countdown for Score Training already lives in `game.store.ts` rather than in `ScoreTrainingEngine`. The engine exposes `phaseIndex`, `phaseName`, `targets`, `phaseDurationSeconds`, `phaseCount` and `status`; the caller drives transitions by calling `advance()`.

---

# File Structure

## Part A — schema (branch `claude/training-schema-warmup`, targets `main`)

| File | Responsibility |
| --- | --- |
| `docs/architecture/05-Database/06-Spec/01-Reference-Layer.md` | Document `exercise_types`, `exercise_ruleset_versions`, `EXERCISE_SECTION` |
| `docs/architecture/05-Database/06-Spec/02-Template-Layer.md` | Document the exercise-type discriminator and `routine_steps.configuration` |
| `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md` | Document the generalised `exercise_sessions` and `activity_configurations` |
| `decisions/database.md` | One appended decision block for the discriminator + split-ruleset model |
| `database/migrations/0027_exercise_type_reference.sql` | `exercise_types`, `exercise_ruleset_versions` |
| `database/migrations/0028_template_exercise_types.sql` | `exercise_templates`, `routine_steps` changes |
| `database/migrations/0029_session_exercise_generalization.sql` | `exercise_sessions` columns + CHECKs |
| `database/migrations/0030_activity_configurations.sql` | Training-level configuration snapshot |
| `database/migrations/0031_session_exercise_type_not_null.sql` | Post-seed `NOT NULL` promotion |
| `database/seeds/0014_exercise_types.sql` | Exercise types, `WARM_UP_V1` ruleset, `EXERCISE_SECTION` stage type, `exercise_sessions` backfill |
| `database/seeds/0015_warm_up_routine.sql` | The one system routine, its exercise template and its step |
| `database/verification/0027_exercise_type_reference_checks.sql` | Reference tables and their FKs behave |
| `database/verification/0029_session_generalization_checks.sql` | Both CHECKs fire; capability FK still admits a warm-up row |
| `database/verification/0030_activity_configuration_checks.sql` | 1:1 uniqueness and CASCADE |
| `database/verification/0015_warm_up_routine_checks.sql` | Seeded routine resolves end to end |

## Part B — engines (branch `claude/training-engines-warmup`, targets `claude/training-schema-warmup`)

| File | Responsibility |
| --- | --- |
| `app/src/modules/game/types.ts` | Extend `StageTypeKey` with `EXERCISE_SECTION` |
| `app/src/lib/exercise/rulesets/types.ts` | `ExerciseRulesetVersionKey`, `WarmUpV1Config` Zod schema, `EXERCISE_RULESET_CONFIGS` |
| `app/src/modules/exercise/types.ts` | `WarmUpPhase`, `WarmUpSnapshot`, `WarmUpState` |
| `app/src/modules/exercise/interfaces.ts` | `ExerciseEngine`, `ExerciseEngineFactory` |
| `app/src/modules/exercise/engine.registry.ts` | Exercise-engine registry keyed by exercise ruleset version |
| `app/src/modules/exercise/warm-up.engine.module.ts` | `WarmUpEngine` + factory + registration |
| `app/src/services/exercise-rulesets/interfaces.ts` | `ExerciseRulesetValidator` |
| `app/src/services/exercise-rulesets/warm-up/warm-up.validator.ts` | Server-side `WARM_UP_V1` config validation |
| `app/src/services/exercise-rulesets/registry.ts` | Exercise-ruleset validator registry |
| `app/src/modules/training/types.ts` | `RoutineStepSnapshot`, `RoutineSnapshot`, `TrainingState` |
| `app/src/modules/training/training.module.ts` | `TrainingEngine` — ordered step progression |
| `app/src/modules/training/routine-duration.module.ts` | §7 sixty-minute routine cap |

**Why a separate ruleset registry.** `WARM_UP_V1` must NOT be added to `app/src/services/rulesets/registry.ts` or to `RulesetVersionKey` in `app/src/lib/game/rulesets/types.ts`. `scripts/check-game-wiring.sh` is driven from `services/rulesets/registry.ts` and requires every key in it to be declared in `RULESET_CAPABILITIES` (a capture/input mode pair) and to have either game pages or none at all; a warm-up has no capture or input mode, so adding it there fails the gate. `RULESET_CONFIGS` is also a `Record<RulesetVersionKey, ...>`, so widening the union forces an entry there too. The exercise system therefore gets its own parallel registry, union and config map.

---

# PART A — Schema

### Task 1: Document the model before building it

**Files:**
- Modify: `docs/architecture/05-Database/06-Spec/01-Reference-Layer.md`
- Modify: `docs/architecture/05-Database/06-Spec/02-Template-Layer.md`
- Modify: `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md`
- Modify: `decisions/database.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the canonical table/column names every later task must match — `exercise_types`, `exercise_ruleset_versions`, `exercise_templates.exercise_type_id`, `exercise_templates.default_configuration`, `routine_steps.configuration`, `exercise_sessions.exercise_type_id`, `exercise_sessions.exercise_ruleset_version_id`, `exercise_sessions.routine_step_sequence_number`, `activity_configurations`, `chk_exercise_sessions_game_pair`, `chk_exercise_sessions_capture_pair`, stage type `EXERCISE_SECTION`.

- [ ] **Step 1: Create the branch**

```bash
cd /home/user/dart-analytics
git checkout main
git pull origin main
git checkout -b claude/training-schema-warmup
```

- [ ] **Step 2: Add the two new reference tables to the Reference Layer chapter**

Append to `docs/architecture/05-Database/06-Spec/01-Reference-Layer.md`, before any closing summary section, following the chapter's existing per-table heading style (`## Purpose` / `## Lifecycle` / `## Primary Key` / `## Key Columns` / `## Relationships` / `## Design Rationale`):

```markdown
---

# exercise_types (migration 0027)

## Purpose

Identifies the kind of exercise being executed (`09-training-routines.md` §3.4). The exercise type
selects the `ExerciseEngine` and the exercise ruleset responsible for execution.

Examples: `GAME`, `WARM_UP`, and later `SWITCHING`, `DOUBLE_PATTERN`, `CHECKOUT`, `ACCURACY`.

`GAME` is one exercise type among many, not a layer above them.

## Lifecycle

Append-only catalog. A new exercise type ships alongside its ruleset, engine and configuration
schema (§26); existing rows are never edited or removed.

## Primary Key

UUIDv7 — this is a growing catalog, structurally identical to `game_types`, not a fixed structural
enum. SMALLINT stays reserved for enums whose complete membership is known up front (`stage_types`,
`capture_modes`, `input_modes`).

## Key Columns

- id
- implementation_key
- name
- description
- is_published
- created_at
- updated_at

## Relationships

Referenced by:

- exercise_ruleset_versions (RESTRICT on delete)
- exercise_templates (RESTRICT on delete)
- exercise_sessions (RESTRICT on delete)

## Design Rationale

An explicit exercise-type discriminator is what lets a non-game exercise exist at all: before it, a
`NOT NULL game_type_id` forced every exercise into a game abstraction, which `09-training-routines.md`
§12 explicitly forbids.

Seeded by `0014_exercise_types.sql`.

---

# exercise_ruleset_versions (migration 0027)

## Purpose

Versioned behaviour definitions for exercise types, mirroring `ruleset_versions` for game types.

## Lifecycle

Append-only. A behaviour change is a new version row, never an edit.

## Primary Key

UUIDv7

## Key Columns

- id
- exercise_type_id
- implementation_key
- version_number
- description
- created_at

## Relationships

References:

- exercise_types (RESTRICT on delete)

Referenced by:

- exercise_sessions (RESTRICT on delete)

## Design Rationale

Exercise rulesets and game rulesets are separate components (`09-training-routines.md` §24), and
§11's execution path (`ExerciseEngine → GameEngine → Game Ruleset`) has both live at once for a
game-backed exercise. A single discriminated `ruleset_versions` table would give an
`exercise_sessions` row one column for two values, so exercise rulesets get their own table and
`ruleset_versions` is left untouched.

Seeded by `0014_exercise_types.sql`.
```

Then extend the chapter's `stage_types` section's seeded-value list with the new row:

```markdown
- 6 — `EXERCISE_SECTION` — timed section inside an exercise (a warm-up phase). Written flat, directly
  under the exercise session, with `parent_stage_id` NULL: the session already represents the
  exercise, so no grouping row is created. `EXERCISE_BLOCK` (5) stays reserved for a routine-level
  grouping if one is ever needed.
```

- [ ] **Step 3: Update the Template Layer chapter**

In `docs/architecture/05-Database/06-Spec/02-Template-Layer.md`:

Under `# exercise_templates`, replace the `## Purpose` first line

```markdown
Defines reusable exercise definitions for a specific game type.
```

with

```markdown
Defines reusable exercise definitions for an exercise type. A template of exercise type `GAME` also
names the game type it wraps; every other exercise type leaves `game_type_id` NULL.
```

and replace the `## Key Columns` list with

```markdown
- id
- exercise_type_id
- game_type_id (nullable — NULL unless the exercise type is `GAME`)
- name
- description
- default_configuration (JSONB, nullable)
- is_system_template
- created_at
- updated_at
```

and append to `## Design Rationale`:

```markdown
`game_type_id` is nullable but keeps its RESTRICT foreign key, so deleting a game type is still
blocked while templates reference it (migration 0028).

`default_configuration` holds the defaults and constraints an exercise type provides — default,
minimum, maximum and recommended duration, and any exercise-specific defaults
(`09-training-routines.md` §5). A routine step's own `configuration` overrides it.
```

Under `# routine_steps`, replace the `## Key Columns` list with

```markdown
- id
- routine_template_id
- exercise_template_id
- sequence_number
- duration_type_id
- duration_value
- configuration (JSONB, nullable)
- created_at
```

and append to `## Design Rationale`:

```markdown
`configuration` is the **Routine Exercise Configuration** of `09-training-routines.md` §3.5: targets,
target sequences, patterns, game selection and exercise-specific parameters, contextual to this
routine. Duration stays in its own two columns because it is structural and queried
(routine duration is the sum of its steps, §6); everything else contextual lives in the JSONB.

Resolution merges `exercise_templates.default_configuration` with this column to produce the
**Resolved Training Configuration** (§18) copied into `activity_configurations` at Training start.
This is the seam §21 adaptive resolution occupies later, with no further schema change.
```

- [ ] **Step 4: Update the Runtime Layer chapter**

In `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md`, in the `exercise_sessions` section, replace the key-column list's game-bound entries so it reads:

```markdown
- id
- activity_id
- player_id
- exercise_type_id
- exercise_ruleset_version_id (nullable — set for an exercise run inside a training)
- game_type_id (nullable — set only for exercise type `GAME`)
- ruleset_version_id (nullable — the game ruleset, set only for exercise type `GAME`)
- capture_mode_id (nullable — set only when the exercise takes dart input)
- input_mode_id (nullable — set only when the exercise takes dart input)
- routine_step_sequence_number (nullable, no foreign key)
- status_id
- started_at
- completed_at
- created_at
```

and append to its `## Design Rationale`:

```markdown
Two independent CHECK constraints govern the nullable columns (migration 0029):

- `chk_exercise_sessions_game_pair` — `game_type_id` and `ruleset_version_id` are NULL together or
  NOT NULL together. A game binding is all-or-nothing.
- `chk_exercise_sessions_capture_pair` — `capture_mode_id` and `input_mode_id` are NULL together or
  NOT NULL together, independent of the game pair. `SWITCHING` (§17) takes dart observations with no
  game engine, so dart capture cannot be tied to the game columns.

Neither constraint names a specific exercise type. A literal id in DDL would have to be revisited for
every new exercise type; type-to-column consistency is enforced in the service layer instead.

`routine_step_sequence_number` records which step of the training this session was, indexing into the
`activity_configurations` snapshot. It is a plain integer with no foreign key, because the
`routine_steps` row it corresponds to is mutable and the runtime may never reference a template.

Worked examples:

| Exercise | exercise_ruleset_version_id | game pair | capture pair |
| --- | --- | --- | --- |
| Warm-Up in a training | `WARM_UP_V1` | NULL | NULL |
| Standalone 501 game | NULL | set | set |
| 501 as a routine step | set | set | set |
```

Then add the new table section:

```markdown
---

# activity_configurations (migration 0030)

## Purpose

The immutable snapshot of the **Resolved Training Configuration** (`09-training-routines.md` §18) an
activity executed: the routine's name plus its ordered, resolved step list.

## Lifecycle

Written once at Training start, never updated. Deleted only with its activity (CASCADE).

## Primary Key

UUIDv7

## Key Columns

- id
- activity_id (unique — one snapshot per activity)
- configuration (JSONB)
- created_at

## Relationships

References:

- activities (CASCADE on delete)

## Design Rationale

Mirrors `exercise_configurations` exactly, one level up. This is how an activity records which
routine it ran without holding a foreign key to `routine_templates` — editing or deleting a routine
can never alter historical training (§23, and the Template ↔ Runtime Boundary).

The snapshot stores the *resolved* configuration, after any future adaptive resolution (§21), not a
verbatim copy of the template.
```

- [ ] **Step 5: Append the decision block**

Append to `decisions/database.md`. The file's blocks are `### D<n> — <title>` followed by `Status:`, `Decision:`, `Reason:`, `Consequences:` and an optional `Supersedes:` line — the highest id in the file at time of writing is `D257`, so use `D258`. If `D258` is already taken when you get here, use the next free number; do not renumber an existing block.

```markdown
### D258 — Exercise sessions carry an exercise-type discriminator, and exercise rulesets are a separate table
Status: Accepted · Date: 2026-09-10
Decision: Migrations `0027`–`0031` add an `exercise_types` catalog (UUID primary key) and an `exercise_ruleset_versions` table, give `exercise_templates` and `exercise_sessions` an `exercise_type_id`, relax `game_type_id`/`ruleset_version_id`/`capture_mode_id`/`input_mode_id` on `exercise_sessions` to nullable under two independent CHECK constraints, add `routine_steps.configuration` (JSONB), and add an `activity_configurations` snapshot table. `ruleset_versions` and `configuration_templates` are left unchanged.
Reason: Every game-bound column was `NOT NULL`, which forced a game abstraction onto a non-game exercise — exactly what `09-training-routines.md` §12 forbids. Three alternatives were weighed and rejected. A discriminator on `ruleset_versions` was rejected because a game-backed exercise (§11) holds an exercise ruleset and a game ruleset simultaneously and one `ruleset_version_id` column cannot carry both. A SMALLINT primary key for `exercise_types` was rejected because §26 makes each new exercise type ship with its own ruleset, engine and configuration schema — a growing catalog like `game_types`, not a fixed structural enum like `stage_types`. Putting the warm-up's phase list in `configuration_templates` was rejected because that table is game-keyed and models the §19 named-preset concept; §3.5's per-routine exercise configuration belongs on the step.
Consequences: The two CHECK constraints are deliberately independent — `SWITCHING` (§17) takes dart observations with no game engine, so a capture pair must be settable without a game pair — and neither names a specific exercise type, so no new exercise type requires a constraint change. Migration `0020`'s composite `fk_sessions_capability` is left in place: it is `MATCH SIMPLE`, so a fully-NULL warm-up row satisfies it trivially, at the cost of the capability guarantee not extending to non-game exercises that take dart input. `exercise_sessions.exercise_type_id` needs the `db:migrate` → `db:seed` → `db:migrate` apply order that `0019`/`0020` established, because its backfill is seed data. Adaptive resolution (§21) has a place to land with no further schema change: it rewrites the resolved step list before it is snapshotted into `activity_configurations`.
Supersedes: none.
```

- [ ] **Step 6: Verify the docs gates pass**

Run:
```bash
cd /home/user/dart-analytics
bash scripts/check-doc-links.sh && bash scripts/check-decision-ids.sh && bash scripts/check-context-map.sh
```
Expected: each exits zero and prints no FAIL lines. If `check-decision-ids.sh` reports a missing or duplicate id, read the script's output for the id format it expects and correct the block added in Step 5.

- [ ] **Step 7: Commit**

```bash
git add docs/architecture/05-Database/06-Spec/01-Reference-Layer.md \
        docs/architecture/05-Database/06-Spec/02-Template-Layer.md \
        docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md \
        decisions/database.md
git commit -m "docs: specify exercise types, exercise rulesets and training snapshots"
```

---

### Task 2: Migration 0027 — exercise type reference tables

**Files:**
- Create: `database/migrations/0027_exercise_type_reference.sql`
- Create: `database/verification/0027_exercise_type_reference_checks.sql`

**Interfaces:**
- Consumes: the column names fixed in Task 1.
- Produces: tables `exercise_types(id, implementation_key, name, description, is_published, created_at, updated_at)` and `exercise_ruleset_versions(id, exercise_type_id, implementation_key, version_number, description, created_at)`, both with a UNIQUE `implementation_key`.

- [ ] **Step 1: Write the migration**

Create `database/migrations/0027_exercise_type_reference.sql`:

```sql
-- ============================================================
-- Migration: 0027_exercise_type_reference.sql
--
-- Purpose:
-- Introduce the exercise-type catalog and its ruleset versions.
--
-- An exercise type identifies the kind of exercise being run
-- (09-training-routines.md 3.4) and selects the ExerciseEngine
-- and exercise ruleset responsible for it. GAME is one exercise
-- type among many, not a layer above them.
--
-- UUID primary keys, not SMALLINT: this is a growing catalog,
-- structurally identical to game_types. Each new exercise type
-- ships with its own ruleset, engine and configuration schema.
--
-- exercise_ruleset_versions is a separate table rather than a
-- discriminator on ruleset_versions because a game-backed
-- exercise (section 11) holds an exercise ruleset and a game
-- ruleset simultaneously, and one column cannot carry both.
--
-- Seeded by database/seeds/0014_exercise_types.sql.
-- ============================================================

-- migrate:up
CREATE TABLE exercise_types (
    id UUID PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_exercise_types_implementation_key UNIQUE (implementation_key)
);

COMMENT ON TABLE exercise_types IS 'Kinds of exercise an ExerciseEngine can execute.';

CREATE TABLE exercise_ruleset_versions (
    id UUID PRIMARY KEY,
    exercise_type_id UUID NOT NULL,
    implementation_key TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_exercise_ruleset_versions_implementation_key UNIQUE (implementation_key),
    CONSTRAINT fk_exercise_ruleset_versions_type FOREIGN KEY (exercise_type_id) REFERENCES exercise_types(id) ON DELETE RESTRICT
);

COMMENT ON TABLE exercise_ruleset_versions IS 'Versioned behaviour definitions for exercise types.';

-- migrate:down
DROP TABLE IF EXISTS exercise_ruleset_versions;
DROP TABLE IF EXISTS exercise_types;
```

- [ ] **Step 2: Confirm the migration parses and is numbered contiguously**

Run:
```bash
cd /home/user/dart-analytics
ls database/migrations | tail -3
grep -c "migrate:up\|migrate:down" database/migrations/0027_exercise_type_reference.sql
```
Expected: `0027_exercise_type_reference.sql` is the highest number, and the grep prints `2`.

- [ ] **Step 3: Write the verification script**

Create `database/verification/0027_exercise_type_reference_checks.sql`:

```sql
-- ============================================================
-- Verification: 0027_exercise_type_reference_checks.sql
--
-- Proves against a live database what migration 0027 can only
-- claim locally (D193): the two reference tables exist with the
-- intended shape, their UNIQUE keys reject a duplicate
-- implementation_key, and the RESTRICT foreign key blocks
-- deleting an exercise type that a ruleset version still uses.
--
-- Builds its own fixture and ends in ROLLBACK, so it leaves
-- nothing behind and composes with the other verification
-- scripts.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0027_exercise_type_reference_checks.sql
--
-- Expected: every result row reads PASS.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO exercise_types (id, implementation_key, name, description, is_published, created_at, updated_at)
VALUES ('01999000-0000-7000-8000-0000000000f1', 'VERIFY_TYPE', 'Verify Type', 'Fixture.', FALSE, now(), now());

INSERT INTO exercise_ruleset_versions (id, exercise_type_id, implementation_key, version_number, description, created_at)
VALUES ('01999100-0000-7000-8000-0000000000f1', '01999000-0000-7000-8000-0000000000f1', 'VERIFY_TYPE_V1', 1, 'Fixture.', now());

INSERT INTO verification_results
SELECT '1',
    'fixture type and ruleset version inserted',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s ruleset version(s) for the fixture type', count(*))
FROM exercise_ruleset_versions
WHERE exercise_type_id = '01999000-0000-7000-8000-0000000000f1';

DO $$
BEGIN
    BEGIN
        INSERT INTO exercise_types (id, implementation_key, name, description, is_published, created_at, updated_at)
        VALUES ('01999000-0000-7000-8000-0000000000f2', 'VERIFY_TYPE', 'Duplicate', 'Fixture.', FALSE, now(), now());
        INSERT INTO verification_results VALUES ('2', 'duplicate implementation_key is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verification_results VALUES ('2', 'duplicate implementation_key is rejected', 'PASS', NULL);
    END;
END $$;

DO $$
BEGIN
    BEGIN
        DELETE FROM exercise_types WHERE id = '01999000-0000-7000-8000-0000000000f1';
        INSERT INTO verification_results VALUES ('3', 'RESTRICT blocks deleting a referenced exercise type', 'FAIL', 'delete succeeded');
    EXCEPTION WHEN foreign_key_violation THEN
        INSERT INTO verification_results VALUES ('3', 'RESTRICT blocks deleting a referenced exercise type', 'PASS', NULL);
    END;
END $$;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/0027_exercise_type_reference.sql \
        database/verification/0027_exercise_type_reference_checks.sql
git commit -m "feat(db): add exercise type and exercise ruleset version tables"
```

---

### Task 3: Migration 0028 — generalise the template layer

**Files:**
- Create: `database/migrations/0028_template_exercise_types.sql`

**Interfaces:**
- Consumes: `exercise_types` from Task 2.
- Produces: `exercise_templates.exercise_type_id` (NOT NULL), `exercise_templates.default_configuration` (JSONB), nullable `exercise_templates.game_type_id`, `routine_steps.configuration` (JSONB).

Both tables are applied but empty, so `exercise_type_id` can be added `NOT NULL` directly with no backfill and no seed dependency.

- [ ] **Step 1: Confirm both tables are empty before relying on it**

Run (owner, against Neon):
```bash
psql "$DATABASE_URL" -c "SELECT (SELECT count(*) FROM exercise_templates) AS templates, (SELECT count(*) FROM routine_steps) AS steps;"
```
Expected: `templates | steps` both `0`. If either is non-zero, stop — this migration must gain a backfill and a post-seed `NOT NULL` promotion like Task 6's, and the plan needs revising before continuing.

- [ ] **Step 2: Write the migration**

Create `database/migrations/0028_template_exercise_types.sql`:

```sql
-- ============================================================
-- Migration: 0028_template_exercise_types.sql
--
-- Purpose:
-- Let the template layer describe non-game exercises, and let a
-- routine step carry its own configuration.
--
-- exercise_templates gains the exercise_type_id discriminator
-- and relaxes game_type_id to nullable. The foreign key and its
-- RESTRICT are kept: deleting a game type is still blocked while
-- a template references it.
--
-- routine_steps gains the Routine Exercise Configuration of
-- 09-training-routines.md 3.5 — targets, sequences, patterns,
-- game selection. Duration stays in its own columns because it
-- is structural and queried (section 6).
--
-- Both tables are empty at time of writing, so exercise_type_id
-- is added NOT NULL directly with no backfill.
-- ============================================================

-- migrate:up
ALTER TABLE exercise_templates
ADD COLUMN exercise_type_id UUID NOT NULL,
ADD COLUMN default_configuration JSONB,
ALTER COLUMN game_type_id DROP NOT NULL,
ADD CONSTRAINT fk_exercise_templates_exercise_type FOREIGN KEY (exercise_type_id) REFERENCES exercise_types(id) ON DELETE RESTRICT;

COMMENT ON COLUMN exercise_templates.exercise_type_id IS 'Which kind of exercise this template defines.';
COMMENT ON COLUMN exercise_templates.game_type_id IS 'Set only when the exercise type is GAME.';
COMMENT ON COLUMN exercise_templates.default_configuration IS 'Exercise-type defaults and constraints; overridden by routine_steps.configuration.';

ALTER TABLE routine_steps
ADD COLUMN configuration JSONB;

COMMENT ON COLUMN routine_steps.configuration IS 'Routine Exercise Configuration (09-training-routines.md 3.5).';

-- migrate:down
ALTER TABLE routine_steps DROP COLUMN IF EXISTS configuration;

ALTER TABLE exercise_templates DROP CONSTRAINT IF EXISTS fk_exercise_templates_exercise_type;

ALTER TABLE exercise_templates
DROP COLUMN IF EXISTS default_configuration,
DROP COLUMN IF EXISTS exercise_type_id;

ALTER TABLE exercise_templates ALTER COLUMN game_type_id SET NOT NULL;
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/0028_template_exercise_types.sql
git commit -m "feat(db): give exercise templates an exercise type and routine steps a configuration"
```

---

### Task 4: Migration 0029 — generalise exercise_sessions

**Files:**
- Create: `database/migrations/0029_session_exercise_generalization.sql`
- Create: `database/verification/0029_session_generalization_checks.sql`

**Interfaces:**
- Consumes: `exercise_types`, `exercise_ruleset_versions` from Task 2.
- Produces: `exercise_sessions.exercise_type_id` (nullable **for now** — promoted to NOT NULL in Task 6 after the seed backfills it), `exercise_sessions.exercise_ruleset_version_id`, `exercise_sessions.routine_step_sequence_number`, constraints `chk_exercise_sessions_game_pair` and `chk_exercise_sessions_capture_pair`.

**The capability foreign key.** Migration `0020` put a composite foreign key on `exercise_sessions (ruleset_version_id, capture_mode_id, input_mode_id)` referencing `ruleset_version_capabilities`. PostgreSQL composite foreign keys default to `MATCH SIMPLE`, which is satisfied trivially when **any** referencing column is NULL. A warm-up row with all three NULL therefore passes without dropping or altering that constraint, and existing fully-populated game rows are unaffected. The cost, stated plainly: a row with a NULL `ruleset_version_id` but a populated capture pair also passes trivially, so the capability guarantee does not extend to non-game exercises that take dart input. That is acceptable — capability declarations are a game-ruleset concept — and Step 4's verification script asserts the warm-up shape is actually accepted rather than assuming it.

- [ ] **Step 1: Write the migration**

Create `database/migrations/0029_session_exercise_generalization.sql`:

```sql
-- ============================================================
-- Migration: 0029_session_exercise_generalization.sql
--
-- Purpose:
-- Let an exercise session record a non-game exercise.
--
-- exercise_type_id is added NULLABLE here and promoted to
-- NOT NULL by migration 0031, because existing rows are
-- backfilled by database/seeds/0014_exercise_types.sql and
-- seeds run after migrations. The apply order is:
--
--   db:migrate (through 0030) -> db:seed -> db:migrate (0031)
--
-- Two independent CHECK constraints govern the relaxed columns.
-- A game binding is all-or-nothing; dart capture is
-- all-or-nothing and independent of it, because SWITCHING
-- (09-training-routines.md 17) takes dart observations with no
-- game engine. Neither constraint names a specific exercise
-- type: a literal id in DDL would need revisiting for every new
-- type, so type-to-column consistency is a service-layer rule.
--
-- fk_sessions_capability (migration 0020) is deliberately left
-- in place. It is MATCH SIMPLE, so a row with NULL in any of its
-- three columns satisfies it trivially.
-- ============================================================

-- migrate:up
ALTER TABLE exercise_sessions
ADD COLUMN exercise_type_id UUID,
ADD COLUMN exercise_ruleset_version_id UUID,
ADD COLUMN routine_step_sequence_number INTEGER,
ALTER COLUMN game_type_id DROP NOT NULL,
ALTER COLUMN ruleset_version_id DROP NOT NULL,
ALTER COLUMN capture_mode_id DROP NOT NULL,
ALTER COLUMN input_mode_id DROP NOT NULL,
ADD CONSTRAINT fk_exercise_sessions_exercise_type FOREIGN KEY (exercise_type_id) REFERENCES exercise_types(id) ON DELETE RESTRICT,
ADD CONSTRAINT fk_exercise_sessions_exercise_ruleset_version FOREIGN KEY (exercise_ruleset_version_id) REFERENCES exercise_ruleset_versions(id) ON DELETE RESTRICT,
ADD CONSTRAINT chk_exercise_sessions_game_pair CHECK ((game_type_id IS NULL) = (ruleset_version_id IS NULL)),
ADD CONSTRAINT chk_exercise_sessions_capture_pair CHECK ((capture_mode_id IS NULL) = (input_mode_id IS NULL));

COMMENT ON COLUMN exercise_sessions.exercise_type_id IS 'Which kind of exercise this session ran.';
COMMENT ON COLUMN exercise_sessions.exercise_ruleset_version_id IS 'Exercise ruleset; set for an exercise run inside a training.';
COMMENT ON COLUMN exercise_sessions.routine_step_sequence_number IS 'Which step of the training this was; indexes into activity_configurations, no foreign key.';

-- migrate:down
ALTER TABLE exercise_sessions
DROP CONSTRAINT IF EXISTS chk_exercise_sessions_capture_pair,
DROP CONSTRAINT IF EXISTS chk_exercise_sessions_game_pair,
DROP CONSTRAINT IF EXISTS fk_exercise_sessions_exercise_ruleset_version,
DROP CONSTRAINT IF EXISTS fk_exercise_sessions_exercise_type,
DROP COLUMN IF EXISTS routine_step_sequence_number,
DROP COLUMN IF EXISTS exercise_ruleset_version_id,
DROP COLUMN IF EXISTS exercise_type_id;

ALTER TABLE exercise_sessions
ALTER COLUMN input_mode_id SET NOT NULL,
ALTER COLUMN capture_mode_id SET NOT NULL,
ALTER COLUMN ruleset_version_id SET NOT NULL,
ALTER COLUMN game_type_id SET NOT NULL;
```

- [ ] **Step 2: Write the verification script**

Create `database/verification/0029_session_generalization_checks.sql`:

```sql
-- ============================================================
-- Verification: 0029_session_generalization_checks.sql
--
-- Proves against a live database (D193) that:
--   1. a warm-up-shaped session row (no game type, no ruleset
--      version, no capture or input mode) is accepted, and that
--      migration 0020's MATCH SIMPLE composite capability
--      foreign key does not block it
--   2. chk_exercise_sessions_game_pair rejects a half-set game
--      pair
--   3. chk_exercise_sessions_capture_pair rejects a half-set
--      capture pair
--   4. a capture pair without a game pair is accepted, which is
--      the shape a future dart-driven non-game exercise needs
--
-- Builds its own player, activity and session fixture, resolves
-- lookups by implementation_key, and ends in ROLLBACK.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0029_session_generalization_checks.sql
--
-- Expected: every result row reads PASS. Run after
-- `npm run db:seed` has applied seeds/0014.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE fixture AS
SELECT '01999200-0000-7000-8000-0000000000f1'::uuid AS player_id,
    '01999300-0000-7000-8000-0000000000f1'::uuid AS activity_id,
    (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP') AS warm_up_type_id,
    (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1') AS warm_up_ruleset_id,
    (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE') AS active_status_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS') AS analytics_id,
    (SELECT id FROM input_modes WHERE implementation_key = 'DETAILED_DARTS') AS detailed_id;

INSERT INTO verification_results
SELECT '0',
    'every fixture lookup resolved',
    CASE WHEN warm_up_type_id IS NOT NULL
              AND warm_up_ruleset_id IS NOT NULL
              AND active_status_id IS NOT NULL
              AND analytics_id IS NOT NULL
              AND detailed_id IS NOT NULL
         THEN 'PASS' ELSE 'FAIL' END,
    'a NULL here means seeds/0014 has not been applied'
FROM fixture;

INSERT INTO players (id, created_at, updated_at)
SELECT player_id, now(), now() FROM fixture;

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
SELECT activity_id, player_id, active_status_id, now(), now() FROM fixture;

DO $$
DECLARE f RECORD;
BEGIN
    SELECT * INTO f FROM fixture;
    BEGIN
        INSERT INTO exercise_sessions (
            id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
            routine_step_sequence_number, status_id, started_at, created_at
        )
        VALUES (
            '01999400-0000-7000-8000-0000000000f1', f.activity_id, f.player_id, f.warm_up_type_id,
            f.warm_up_ruleset_id, 1, f.active_status_id, now(), now()
        );
        INSERT INTO verification_results VALUES ('1', 'warm-up shaped session is accepted', 'PASS', NULL);
    EXCEPTION WHEN others THEN
        INSERT INTO verification_results VALUES ('1', 'warm-up shaped session is accepted', 'FAIL', SQLERRM);
    END;
END $$;

DO $$
DECLARE f RECORD;
BEGIN
    SELECT * INTO f FROM fixture;
    BEGIN
        INSERT INTO exercise_sessions (
            id, activity_id, player_id, exercise_type_id, game_type_id,
            status_id, started_at, created_at
        )
        VALUES (
            '01999400-0000-7000-8000-0000000000f2', f.activity_id, f.player_id, f.warm_up_type_id,
            (SELECT id FROM game_types WHERE implementation_key = '501'),
            f.active_status_id, now(), now()
        );
        INSERT INTO verification_results VALUES ('2', 'half-set game pair is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('2', 'half-set game pair is rejected', 'PASS', NULL);
    END;
END $$;

DO $$
DECLARE f RECORD;
BEGIN
    SELECT * INTO f FROM fixture;
    BEGIN
        INSERT INTO exercise_sessions (
            id, activity_id, player_id, exercise_type_id, capture_mode_id,
            status_id, started_at, created_at
        )
        VALUES (
            '01999400-0000-7000-8000-0000000000f3', f.activity_id, f.player_id, f.warm_up_type_id,
            f.analytics_id, f.active_status_id, now(), now()
        );
        INSERT INTO verification_results VALUES ('3', 'half-set capture pair is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('3', 'half-set capture pair is rejected', 'PASS', NULL);
    END;
END $$;

DO $$
DECLARE f RECORD;
BEGIN
    SELECT * INTO f FROM fixture;
    BEGIN
        INSERT INTO exercise_sessions (
            id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
            capture_mode_id, input_mode_id, status_id, started_at, created_at
        )
        VALUES (
            '01999400-0000-7000-8000-0000000000f4', f.activity_id, f.player_id, f.warm_up_type_id,
            f.warm_up_ruleset_id, f.analytics_id, f.detailed_id, f.active_status_id, now(), now()
        );
        INSERT INTO verification_results VALUES ('4', 'capture pair without a game pair is accepted', 'PASS', NULL);
    EXCEPTION WHEN others THEN
        INSERT INTO verification_results VALUES ('4', 'capture pair without a game pair is accepted', 'FAIL', SQLERRM);
    END;
END $$;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
```

Note for the implementer: the `players` and `activities` INSERT column lists above are written from `0005_runtime_core.sql`. Before committing, read that migration and confirm every NOT NULL column without a default is present in each fixture INSERT; add any that is missing rather than assuming.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/0029_session_exercise_generalization.sql \
        database/verification/0029_session_generalization_checks.sql
git commit -m "feat(db): admit non-game exercises in exercise_sessions"
```

---

### Task 5: Migration 0030 — activity_configurations

**Files:**
- Create: `database/migrations/0030_activity_configurations.sql`
- Create: `database/verification/0030_activity_configuration_checks.sql`

**Interfaces:**
- Consumes: `activities` (migration 0005).
- Produces: `activity_configurations(id, activity_id, configuration, created_at)` with a UNIQUE on `activity_id` and CASCADE delete.

- [ ] **Step 1: Read the table this one mirrors**

Run:
```bash
cd /home/user/dart-analytics
grep -n -A 20 "CREATE TABLE exercise_configurations" database/migrations/*.sql
```
Expected: the `exercise_configurations` DDL. Mirror its column types, constraint naming and `COMMENT ON` style exactly in Step 2; if it differs from the draft below, the existing table wins.

- [ ] **Step 2: Write the migration**

Create `database/migrations/0030_activity_configurations.sql`:

```sql
-- ============================================================
-- Migration: 0030_activity_configurations.sql
--
-- Purpose:
-- Record which routine a training actually ran.
--
-- This is the Resolved Training Configuration of
-- 09-training-routines.md 18: the routine name plus its ordered,
-- resolved step list, snapshotted at Training start.
--
-- A snapshot, not a foreign key, because no runtime table may
-- reference a template (06-Spec/02-Template-Layer.md). Editing
-- or deleting a routine can never alter historical training.
--
-- Mirrors exercise_configurations one level up.
-- ============================================================

-- migrate:up
CREATE TABLE activity_configurations (
    id UUID PRIMARY KEY,
    activity_id UUID NOT NULL,
    configuration JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_activity_configurations_activity UNIQUE (activity_id),
    CONSTRAINT fk_activity_configurations_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

COMMENT ON TABLE activity_configurations IS 'Immutable snapshot of the resolved routine a training executed.';

-- migrate:down
DROP TABLE IF EXISTS activity_configurations;
```

- [ ] **Step 3: Write the verification script**

Create `database/verification/0030_activity_configuration_checks.sql`, following the same BEGIN/temp-table/ROLLBACK shape as Task 2's script, asserting three things:

```sql
-- ============================================================
-- Verification: 0030_activity_configuration_checks.sql
--
-- Proves against a live database (D193) that the training
-- configuration snapshot is one-per-activity and dies with its
-- activity.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0030_activity_configuration_checks.sql
--
-- Expected: every result row reads PASS.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO players (id, created_at, updated_at)
VALUES ('01999200-0000-7000-8000-0000000000f2', now(), now());

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
SELECT '01999300-0000-7000-8000-0000000000f2',
    '01999200-0000-7000-8000-0000000000f2',
    (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
    now(), now();

INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES ('01999500-0000-7000-8000-0000000000f1',
    '01999300-0000-7000-8000-0000000000f2',
    '{"routineName":"Warm-Up","steps":[]}'::jsonb,
    now());

INSERT INTO verification_results
SELECT '1',
    'snapshot inserted and readable as JSONB',
    CASE WHEN configuration ->> 'routineName' = 'Warm-Up' THEN 'PASS' ELSE 'FAIL' END,
    format('routineName read back as %s', configuration ->> 'routineName')
FROM activity_configurations
WHERE id = '01999500-0000-7000-8000-0000000000f1';

DO $$
BEGIN
    BEGIN
        INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
        VALUES ('01999500-0000-7000-8000-0000000000f2',
            '01999300-0000-7000-8000-0000000000f2',
            '{}'::jsonb, now());
        INSERT INTO verification_results VALUES ('2', 'second snapshot for one activity is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verification_results VALUES ('2', 'second snapshot for one activity is rejected', 'PASS', NULL);
    END;
END $$;

DELETE FROM activities WHERE id = '01999300-0000-7000-8000-0000000000f2';

INSERT INTO verification_results
SELECT '3',
    'deleting the activity cascades to its snapshot',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s snapshot row(s) survived', count(*))
FROM activity_configurations
WHERE activity_id = '01999300-0000-7000-8000-0000000000f2';

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/0030_activity_configurations.sql \
        database/verification/0030_activity_configuration_checks.sql
git commit -m "feat(db): snapshot the resolved routine a training ran"
```

---

### Task 6: Seeds and the NOT NULL promotion

**Files:**
- Create: `database/seeds/0014_exercise_types.sql`
- Create: `database/seeds/0015_warm_up_routine.sql`
- Create: `database/migrations/0031_session_exercise_type_not_null.sql`
- Create: `database/verification/0015_warm_up_routine_checks.sql`

**Interfaces:**
- Consumes: every table from Tasks 2–5.
- Produces: `exercise_types` rows `GAME` / `WARM_UP`; `exercise_ruleset_versions` row `WARM_UP_V1`; `stage_types` row `6 EXERCISE_SECTION`; one system routine reachable as `routine_templates.name = 'Warm-Up'`; `exercise_sessions.exercise_type_id` NOT NULL.

The five warm-up phases and their targets come from `09-training-routines.md` §16: Upper `5/20/1`, Lower `19/3/17`, Right `13/6/10`, Left `8/11/14`, Bull `25`. Phase durations are 60 seconds each — five minutes total, well inside the §7 sixty-minute routine cap.

- [ ] **Step 1: Write the reference-data seed**

Create `database/seeds/0014_exercise_types.sql`:

```sql
-- ============================================================
-- Seed: 0014_exercise_types.sql
--
-- Purpose:
-- Insert the exercise-type catalog, the warm-up exercise
-- ruleset, the EXERCISE_SECTION stage type, and backfill
-- exercise_sessions.exercise_type_id for rows that predate the
-- discriminator.
--
-- The backfill is what migration 0031's NOT NULL depends on, so
-- the apply order is db:migrate -> db:seed -> db:migrate. Every
-- statement is idempotent: seed.ts runs each file twice.
-- ============================================================
BEGIN;

INSERT INTO exercise_types (
        id,
        implementation_key,
        name,
        description,
        is_published,
        created_at,
        updated_at
    )
VALUES (
        '0199a000-0000-7000-8000-000000000001',
        'GAME',
        'Game',
        'Exercise executed by a game engine.',
        TRUE,
        now(),
        now()
    ),
    (
        '0199a000-0000-7000-8000-000000000002',
        'WARM_UP',
        'Warm-Up',
        'Timed non-analytical warm-up; requires no dart input.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_ruleset_versions (
        id,
        exercise_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0199a100-0000-7000-8000-000000000001',
        '0199a000-0000-7000-8000-000000000002',
        'WARM_UP_V1',
        1,
        'Initial warm-up ruleset: ordered timed phases, no dart input.',
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO stage_types (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        6,
        'EXERCISE_SECTION',
        'Exercise Section',
        'Timed section inside an exercise.',
        now()
    ) ON CONFLICT (id) DO NOTHING;

UPDATE exercise_sessions
SET exercise_type_id = '0199a000-0000-7000-8000-000000000001'
WHERE exercise_type_id IS NULL;

COMMIT;
```

- [ ] **Step 2: Write the routine seed**

Create `database/seeds/0015_warm_up_routine.sql`:

```sql
-- ============================================================
-- Seed: 0015_warm_up_routine.sql
--
-- Purpose:
-- Insert the one system routine phase 1 ships: a single warm-up
-- exercise of five timed phases (09-training-routines.md 16).
--
-- The routine is a system routine: player_id NULL,
-- is_system_template TRUE (06-Spec/02-Template-Layer.md).
--
-- The five phases live in exercise_templates.default_configuration
-- because they are the exercise type's own defaults; the routine
-- step overrides nothing, so routine_steps.configuration stays
-- NULL. A future routine that wants different phases sets that
-- column instead of creating a second exercise template.
-- ============================================================
BEGIN;

INSERT INTO exercise_templates (
        id,
        exercise_type_id,
        game_type_id,
        name,
        description,
        default_configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0199b000-0000-7000-8000-000000000001',
        '0199a000-0000-7000-8000-000000000002',
        NULL,
        'Warm-Up',
        'Five timed sections to loosen the wrist and arm.',
        '{"phases":[
            {"name":"Upper","targets":[5,20,1],"durationSeconds":60},
            {"name":"Lower","targets":[19,3,17],"durationSeconds":60},
            {"name":"Right","targets":[13,6,10],"durationSeconds":60},
            {"name":"Left","targets":[8,11,14],"durationSeconds":60},
            {"name":"Bull","targets":[25],"durationSeconds":60}
        ]}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO routine_templates (
        id,
        player_id,
        name,
        description,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0199c000-0000-7000-8000-000000000001',
        NULL,
        'Warm-Up',
        'Five-minute warm-up routine.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO routine_steps (
        id,
        routine_template_id,
        exercise_template_id,
        sequence_number,
        duration_type_id,
        duration_value,
        configuration,
        created_at
    )
SELECT '0199d000-0000-7000-8000-000000000001',
    '0199c000-0000-7000-8000-000000000001',
    '0199b000-0000-7000-8000-000000000001',
    1,
    dt.id,
    5,
    NULL,
    now()
FROM duration_types dt
WHERE dt.implementation_key = 'MINUTES' ON CONFLICT (id) DO NOTHING;

COMMIT;
```

- [ ] **Step 3: Write the NOT NULL promotion migration**

Create `database/migrations/0031_session_exercise_type_not_null.sql`:

```sql
-- ============================================================
-- Migration: 0031_session_exercise_type_not_null.sql
--
-- Purpose:
-- Promote exercise_sessions.exercise_type_id to NOT NULL now
-- that database/seeds/0014_exercise_types.sql has backfilled
-- every existing row to GAME.
--
-- PREREQUISITE: seeds/0014 MUST have been applied first. Seeds
-- run after migrations in the standard flow, which is why this
-- is separated from 0029 — the same three-step shape migrations
-- 0019/0020 use. Applying this against a database with an
-- unbackfilled row will fail on constraint validation.
-- ============================================================

-- migrate:up
ALTER TABLE exercise_sessions ALTER COLUMN exercise_type_id SET NOT NULL;

-- migrate:down
ALTER TABLE exercise_sessions ALTER COLUMN exercise_type_id DROP NOT NULL;
```

- [ ] **Step 4: Write the seed verification script**

Create `database/verification/0015_warm_up_routine_checks.sql`:

```sql
-- ============================================================
-- Verification: 0015_warm_up_routine_checks.sql
--
-- Proves against a live database (D193) that seeds 0014 and
-- 0015 landed and resolve end to end: the routine has exactly
-- one step, that step's exercise template is a WARM_UP template
-- with no game type, its default_configuration holds five
-- phases, and no exercise_sessions row was left without an
-- exercise type by the backfill.
--
-- Asserts against seeded data rather than building a fixture,
-- like 0007_capability_seed_checks.sql. Still wrapped in
-- BEGIN/ROLLBACK per house style.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0015_warm_up_routine_checks.sql
--
-- Expected: every result row reads PASS. Run after
-- `npm run db:seed`.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO verification_results
SELECT '1',
    'exercise types GAME and WARM_UP are seeded',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s of 2', count(*))
FROM exercise_types
WHERE implementation_key IN ('GAME', 'WARM_UP');

INSERT INTO verification_results
SELECT '2',
    'WARM_UP_V1 resolves to the WARM_UP exercise type',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s', count(*))
FROM exercise_ruleset_versions erv
    JOIN exercise_types et ON et.id = erv.exercise_type_id
WHERE erv.implementation_key = 'WARM_UP_V1'
    AND et.implementation_key = 'WARM_UP';

INSERT INTO verification_results
SELECT '3',
    'EXERCISE_SECTION stage type is seeded at id 6',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s', count(*))
FROM stage_types
WHERE id = 6
    AND implementation_key = 'EXERCISE_SECTION';

INSERT INTO verification_results
SELECT '4',
    'the system Warm-Up routine has exactly one step',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s step(s)', count(*))
FROM routine_steps rs
    JOIN routine_templates rt ON rt.id = rs.routine_template_id
WHERE rt.name = 'Warm-Up'
    AND rt.is_system_template
    AND rt.player_id IS NULL;

INSERT INTO verification_results
SELECT '5',
    'the step''s exercise template is WARM_UP with no game type',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s', count(*))
FROM routine_steps rs
    JOIN routine_templates rt ON rt.id = rs.routine_template_id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
WHERE rt.name = 'Warm-Up'
    AND ext.implementation_key = 'WARM_UP'
    AND et.game_type_id IS NULL;

INSERT INTO verification_results
SELECT '6',
    'the exercise template declares five phases',
    CASE WHEN jsonb_array_length(default_configuration -> 'phases') = 5 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s phase(s)', jsonb_array_length(default_configuration -> 'phases'))
FROM exercise_templates
WHERE id = '0199b000-0000-7000-8000-000000000001';

INSERT INTO verification_results
SELECT '7',
    'no exercise_sessions row is missing an exercise type',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s) still NULL', count(*))
FROM exercise_sessions
WHERE exercise_type_id IS NULL;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 5: Confirm seed idempotency by reading, before running anything**

Run:
```bash
cd /home/user/dart-analytics
grep -c "ON CONFLICT" database/seeds/0014_exercise_types.sql database/seeds/0015_warm_up_routine.sql
```
Expected: `0014` reports `3` and `0015` reports `3`. The one statement without `ON CONFLICT` in `0014` is the `UPDATE ... WHERE exercise_type_id IS NULL`, which is idempotent by its predicate. If a count is lower, a statement is missing its conflict clause and will fail on `seed.ts`'s second pass.

- [ ] **Step 6: Apply against the real database (owner-run)**

Run, in this exact order:
```bash
cd /home/user/dart-analytics/app
npm run db:status
npm run db:migrate
npm run db:seed
npm run db:migrate
npm run db:status
```
Expected: the first `db:migrate` applies `0027`–`0030`; `db:seed` prints `applied seed:` twice for every file with no error; the second `db:migrate` applies `0031`; the final `db:status` shows no pending migrations.

- [ ] **Step 7: Run every verification script**

Run:
```bash
cd /home/user/dart-analytics
for f in database/verification/0027_exercise_type_reference_checks.sql \
         database/verification/0029_session_generalization_checks.sql \
         database/verification/0030_activity_configuration_checks.sql \
         database/verification/0015_warm_up_routine_checks.sql; do
  echo "== $f"; psql "$DATABASE_URL" -f "$f"; done
```
Expected: each script's final row reads `ALL n CHECKS PASSED`. A FAIL is a real defect — fix the migration or seed it points at and re-run, never edit the assertion to match.

- [ ] **Step 8: Refresh the Drizzle introspection**

Run:
```bash
cd /home/user/dart-analytics/app
npm run db:introspect
git status --short src/db
```
Expected: the introspected schema files show the new tables and columns.

- [ ] **Step 9: Commit**

```bash
cd /home/user/dart-analytics
git add database/seeds/0014_exercise_types.sql \
        database/seeds/0015_warm_up_routine.sql \
        database/migrations/0031_session_exercise_type_not_null.sql \
        database/verification/0015_warm_up_routine_checks.sql \
        app/src/db
git commit -m "feat(db): seed exercise types and the system warm-up routine"
```

---

### Task 7: Close out Part A

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md`
- Modify: `docs/architecture/05-Database/06-Database-Specification.md` (version/changelog line only)
- Modify: `database/README.md` (migration/seed registry, if it carries one)

- [ ] **Step 1: Register the new files**

Run:
```bash
cd /home/user/dart-analytics
grep -n "0026\|0013_singles" docs/architecture/00-File-Inventory.md database/README.md
```
Expected: the lines listing the previous highest migration and seed — `00-File-Inventory.md` lines 41 and 84, `database/README.md` lines 16, 60 and the verification table around line 92.

Make these edits:

- `docs/architecture/00-File-Inventory.md` line 84: change the row label `migrations/0001`–`0026` to `migrations/0001`–`0031` and append to its description: `` `0027`–`0031` generalise the exercise layer for non-game exercises — exercise types, exercise ruleset versions, nullable game columns under two independent CHECKs, routine-step configuration, and the training configuration snapshot (D258, 2026-09-10) ``
- `docs/architecture/00-File-Inventory.md` line 41: append to the `03-Migrations.md` row's description: `` `0027`–`0031` exercise-type generalisation, with the same migrate→seed→migrate apply order as `0019`/`0020` (2026-09-10) ``
- `database/README.md` line 16: change `(0001–0026)` to `(0001–0031)`
- `database/README.md`: add numbered seed entries `14. seeds/0014_exercise_types.sql` and `15. seeds/0015_warm_up_routine.sql` after entry 13
- `database/README.md` verification table: add one row per new script, matching the existing `| path | what it proves (n checks) |` shape:
  - `` | `verification/0027_exercise_type_reference_checks.sql` | `exercise_types`/`exercise_ruleset_versions` accept a fixture, reject a duplicate `implementation_key`, and RESTRICT a referenced type's deletion (3 checks) | ``
  - `` | `verification/0029_session_generalization_checks.sql` | a warm-up-shaped session is accepted past `fk_sessions_capability`, both pair CHECKs reject a half-set pair, a capture pair without a game pair is accepted (5 checks) | ``
  - `` | `verification/0030_activity_configuration_checks.sql` | the training snapshot round-trips as JSONB, is unique per activity, and CASCADEs with its activity (3 checks) | ``
  - `` | `verification/0015_warm_up_routine_checks.sql` | seeds `0014`/`0015` resolve end to end: both exercise types, `WARM_UP_V1`, `EXERCISE_SECTION`, a one-step system routine on a WARM_UP template with five phases, no unbackfilled session (7 checks) | ``

- [ ] **Step 2: Run the context-maintenance skill**

Invoke the `context-maintenance` skill and complete every step it lists. Then run:
```bash
cd /home/user/dart-analytics
bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-findings-log.sh
```
Expected: all three exit zero.

- [ ] **Step 3: Format and push**

```bash
cd /home/user/dart-analytics/app && npm run format && npm run format:check
cd /home/user/dart-analytics
git add -A
git commit -m "docs: register training schema migrations and seeds"
git push -u origin claude/training-schema-warmup
```
Expected: `format:check` reports all files formatted; the push succeeds. Retry a network failure up to 4 times with 2s/4s/8s/16s backoff.

---

# PART B — Engines

Branch from Part A's branch. Do not start Part B until Part A is pushed.

```bash
cd /home/user/dart-analytics
git checkout claude/training-schema-warmup
git checkout -b claude/training-engines-warmup
```

### Task 8: The exercise engine contract and WarmUpEngine

**Files:**
- Modify: `app/src/modules/game/types.ts:328`
- Create: `app/src/lib/exercise/rulesets/types.ts`
- Create: `app/src/modules/exercise/types.ts`
- Create: `app/src/modules/exercise/interfaces.ts`
- Create: `app/src/modules/exercise/engine.registry.ts`
- Create: `app/src/modules/exercise/warm-up.engine.module.ts`
- Test: `app/tests/modules/exercise/warm-up.engine.module.test.ts`
- Test: `app/tests/modules/exercise/engine.registry.test.ts`

**Interfaces:**
- Consumes: `EngineFacts`, `StageFact`, `StageTypeKey` from `@modules/game/types`; `newClientKey` from `@modules/game/client-key.module`.
- Produces:
  - `type ExerciseRulesetVersionKey = "WARM_UP_V1"`
  - `const WarmUpV1Config` (Zod) and `type WarmUpConfigData = z.infer<typeof WarmUpV1Config>`
  - `const EXERCISE_RULESET_CONFIGS: Record<ExerciseRulesetVersionKey, z.ZodTypeAny>`
  - `type WarmUpPhase = { name: string; targets: readonly number[]; durationSeconds: number }`
  - `type WarmUpState = { phaseIndex: number; phaseName: string; targets: readonly number[]; phaseDurationSeconds: number; phaseCount: number; status: "IN_PROGRESS" | "COMPLETE" }`
  - `interface ExerciseEngine<TState>` with `exerciseRulesetVersionKey`, `advance(): TState`, `undo(): boolean`, `isComplete(): boolean`, `state(): TState`, `facts(): EngineFacts`
  - `interface ExerciseEngineFactory<TConfig, TState>` with `exerciseRulesetVersionKey` and `create(config: TConfig, prior?: EngineFacts): ExerciseEngine<TState>`
  - `registerExerciseEngineFactory`, `getExerciseEngineFactory`, `resetExerciseEngineRegistry`
  - `const warmUpEngineFactory: ExerciseEngineFactory<WarmUpConfigData, WarmUpState>`

**Engine semantics, fixed here so later tasks can rely on them.** The engine holds no clock. It appends one `EXERCISE_SECTION` stage fact per phase *entered*, flat (`parentClientKey: null`), `sequence` 1-based. A fresh engine starts having entered phase 0, so `facts().stages` always holds at least one row. `advance()` on a non-final phase appends the next stage and returns the new state; `advance()` on the final phase appends nothing and sets `status: "COMPLETE"`. `undo()` is the exact inverse: it clears a set completion flag if one is set, otherwise removes the last stage; it returns `false` when there is nothing to undo (a fresh engine on phase 0). Rehydration via `create(config, prior)` restores `phaseIndex = prior.stages.length - 1` and always yields `status: "IN_PROGRESS"` — a completed warm-up is a persisted terminal state, never replayed into a live engine.

- [ ] **Step 1: Write the failing engine test**

Create `app/tests/modules/exercise/warm-up.engine.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { warmUpEngineFactory } from "@modules/exercise/warm-up.engine.module";
import type { WarmUpConfigData } from "@lib/exercise/rulesets/types";

const CONFIG: WarmUpConfigData = {
  phases: [
    { name: "Upper", targets: [5, 20, 1], durationSeconds: 60 },
    { name: "Lower", targets: [19, 3, 17], durationSeconds: 60 },
    { name: "Bull", targets: [25], durationSeconds: 60 },
  ],
};

describe("warmUpEngineFactory", () => {
  it("starts on the first phase with one stage fact", () => {
    const engine = warmUpEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      phaseIndex: 0,
      phaseName: "Upper",
      targets: [5, 20, 1],
      phaseDurationSeconds: 60,
      phaseCount: 3,
      status: "IN_PROGRESS",
    });
    expect(engine.facts().stages).toHaveLength(1);
    expect(engine.facts().stages[0]).toMatchObject({
      stageTypeKey: "EXERCISE_SECTION",
      parentClientKey: null,
      sequence: 1,
    });
    expect(engine.facts().turns).toEqual([]);
  });

  it("appends one stage per phase entered", () => {
    const engine = warmUpEngineFactory.create(CONFIG);

    expect(engine.advance().phaseName).toBe("Lower");
    expect(engine.facts().stages.map((s) => s.sequence)).toEqual([1, 2]);
  });

  it("completes on advancing past the final phase without adding a stage", () => {
    const engine = warmUpEngineFactory.create(CONFIG);
    engine.advance();
    engine.advance();

    expect(engine.isComplete()).toBe(false);
    expect(engine.advance().status).toBe("COMPLETE");
    expect(engine.isComplete()).toBe(true);
    expect(engine.facts().stages).toHaveLength(3);
  });

  it("undoes completion, then phases, then refuses", () => {
    const engine = warmUpEngineFactory.create(CONFIG);
    engine.advance();
    engine.advance();
    engine.advance();

    expect(engine.undo()).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.state().phaseIndex).toBe(2);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state().phaseIndex).toBe(0);
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates in progress from prior facts", () => {
    const engine = warmUpEngineFactory.create(CONFIG);
    engine.advance();
    const prior = engine.facts();

    const resumed = warmUpEngineFactory.create(CONFIG, prior);

    expect(resumed.state().phaseIndex).toBe(1);
    expect(resumed.state().status).toBe("IN_PROGRESS");
    expect(resumed.facts().stages.map((s) => s.clientKey)).toEqual(
      prior.stages.map((s) => s.clientKey),
    );
  });

  it("returns copies, never live internals", () => {
    const engine = warmUpEngineFactory.create(CONFIG);

    engine.facts().stages.push({
      clientKey: "x",
      stageTypeKey: "EXERCISE_SECTION",
      parentClientKey: null,
      sequence: 99,
    });

    expect(engine.facts().stages).toHaveLength(1);
  });

  it("rejects an empty phase list", () => {
    expect(() => warmUpEngineFactory.create({ phases: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run:
```bash
cd /home/user/dart-analytics/app
npx vitest run tests/modules/exercise/warm-up.engine.module.test.ts
```
Expected: FAIL — cannot resolve `@modules/exercise/warm-up.engine.module`.

- [ ] **Step 3: Extend `StageTypeKey`**

In `app/src/modules/game/types.ts:328`, replace:

```ts
export type StageTypeKey = "MATCH" | "SET" | "LEG" | "ROUND" | "EXERCISE_BLOCK";
```

with:

```ts
export type StageTypeKey =
  | "MATCH"
  | "SET"
  | "LEG"
  | "ROUND"
  | "EXERCISE_BLOCK"
  | "EXERCISE_SECTION";
```

- [ ] **Step 4: Write the ruleset config module**

Create `app/src/lib/exercise/rulesets/types.ts`:

```ts
import { z } from "zod";

/**
 * Exercise ruleset versions, kept deliberately separate from the game
 * `RulesetVersionKey` union. `scripts/check-game-wiring.sh` requires every key
 * in `services/rulesets/registry.ts` to declare a capture/input mode pair and
 * game pages; an exercise ruleset has neither (09-training-routines.md §24).
 */
export type ExerciseRulesetVersionKey = "WARM_UP_V1";

/**
 * One timed section of a warm-up. `targets` are board numbers the player aims
 * at during the section; 25 is the bull. Nothing is recorded against them —
 * the warm-up takes no dart input (§16).
 */
export const WarmUpPhaseConfig = z
  .object({
    name: z.string().min(1).max(40),
    targets: z.array(z.number().int().min(1).max(25)).min(1).max(6),
    durationSeconds: z.number().int().min(1).max(3600),
  })
  .strict();

/**
 * Warm-Up v1: an ordered, non-empty list of timed phases and nothing else. The
 * upper phase bound is a sanity ceiling, not a product rule; the §7 sixty-minute
 * routine cap is enforced by `routine-duration.module.ts` across all steps.
 */
export const WarmUpV1Config = z
  .object({
    phases: z.array(WarmUpPhaseConfig).min(1).max(12),
  })
  .strict();

export type WarmUpConfigData = z.infer<typeof WarmUpV1Config>;

export const EXERCISE_RULESET_CONFIGS: Record<
  ExerciseRulesetVersionKey,
  z.ZodTypeAny
> = {
  WARM_UP_V1: WarmUpV1Config,
};
```

- [ ] **Step 5: Write the exercise module types and interfaces**

Create `app/src/modules/exercise/types.ts`:

```ts
import type { WarmUpConfigData } from "@lib/exercise/rulesets/types";

export type WarmUpPhase = WarmUpConfigData["phases"][number];

/**
 * Warm-Up state, derived on every `state()` call. It carries no elapsed time:
 * an `ExerciseEngine` is deterministic with respect to its inputs,
 * configuration and ruleset (09-training-routines.md §9), so the clock lives in
 * the caller and transitions arrive as `advance()` calls.
 */
export type WarmUpState = {
  phaseIndex: number;
  phaseName: string;
  targets: readonly number[];
  phaseDurationSeconds: number;
  phaseCount: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
```

Create `app/src/modules/exercise/interfaces.ts`:

```ts
import type { ExerciseRulesetVersionKey } from "@lib/exercise/rulesets/types";
import type { EngineFacts } from "@modules/game/types";

/**
 * Contract every exercise engine implements, parallel to `GameEngine` and
 * never built on top of one (09-training-routines.md §10). `TState` is the
 * shape `state()` and `advance()` return.
 */
export interface ExerciseEngine<TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  advance(): TState;
  undo(): boolean;
  isComplete(): boolean;
  state(): TState;
  facts(): EngineFacts;
}

/**
 * Builds an `ExerciseEngine` for one exercise ruleset version.
 * `create(config, prior)` replays persisted facts to restore an in-progress
 * exercise after a page refresh.
 */
export interface ExerciseEngineFactory<TConfig, TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  create(config: TConfig, prior?: EngineFacts): ExerciseEngine<TState>;
}
```

- [ ] **Step 6: Write the registry**

Create `app/src/modules/exercise/engine.registry.ts`:

```ts
import type { ExerciseRulesetVersionKey } from "@lib/exercise/rulesets/types";
import type { ExerciseEngineFactory } from "./interfaces";

/**
 * Type-erased view of an `ExerciseEngineFactory` used at the registry
 * boundary, mirroring `modules/game/engine.registry.ts`. `unknown` fills the
 * erased parameters so a concrete factory upcasts with no unsafe cast.
 */
type AnyExerciseEngineFactory = ExerciseEngineFactory<unknown, unknown>;

const REGISTRY = new Map<ExerciseRulesetVersionKey, AnyExerciseEngineFactory>();

export function registerExerciseEngineFactory(
  factory: AnyExerciseEngineFactory,
): void {
  if (REGISTRY.has(factory.exerciseRulesetVersionKey)) {
    throw new Error(
      `Exercise engine factory already registered for ${factory.exerciseRulesetVersionKey}`,
    );
  }
  REGISTRY.set(factory.exerciseRulesetVersionKey, factory);
}

export function getExerciseEngineFactory(
  key: ExerciseRulesetVersionKey,
): AnyExerciseEngineFactory | undefined {
  return REGISTRY.get(key);
}

/** Test-only: clears registrations so each test starts from an empty registry. */
export function resetExerciseEngineRegistry(): void {
  REGISTRY.clear();
}
```

- [ ] **Step 7: Write the engine**

Create `app/src/modules/exercise/warm-up.engine.module.ts`:

```ts
import { WarmUpV1Config } from "@lib/exercise/rulesets/types";
import type { WarmUpConfigData } from "@lib/exercise/rulesets/types";
import { newClientKey } from "@modules/game/client-key.module";
import type { EngineFacts, StageFact } from "@modules/game/types";
import { registerExerciseEngineFactory } from "./engine.registry";
import type { ExerciseEngine, ExerciseEngineFactory } from "./interfaces";
import type { WarmUpState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "WARM_UP_V1" as const;

function newSectionStage(sequence: number): StageFact {
  return {
    clientKey: newClientKey(),
    stageTypeKey: "EXERCISE_SECTION",
    parentClientKey: null,
    sequence,
  };
}

function cloneStages(stages: readonly StageFact[]): StageFact[] {
  return stages.map((stage) => ({ ...stage }));
}

/**
 * Warm-Up: ordered timed sections, no dart input, no score
 * (09-training-routines.md §16). One `EXERCISE_SECTION` stage is appended per
 * section entered, flat under the exercise session — the session already
 * represents the exercise, so no grouping stage is created.
 *
 * The engine owns no clock. A caller drives section transitions with
 * `advance()`; elapsed time belongs to the controller, which keeps this engine
 * deterministic with respect to its configuration alone (§9).
 */
class WarmUpEngine implements ExerciseEngine<WarmUpState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: WarmUpConfigData;
  private stages: StageFact[];
  private complete = false;

  constructor(config: WarmUpConfigData, prior?: EngineFacts) {
    this.config = WarmUpV1Config.parse(config);
    this.stages =
      prior && prior.stages.length > 0
        ? cloneStages(prior.stages)
        : [newSectionStage(1)];
  }

  private deriveState(): WarmUpState {
    const phaseIndex = this.stages.length - 1;
    const phase = this.config.phases[phaseIndex];
    return {
      phaseIndex,
      phaseName: phase.name,
      targets: [...phase.targets],
      phaseDurationSeconds: phase.durationSeconds,
      phaseCount: this.config.phases.length,
      status: this.complete ? "COMPLETE" : "IN_PROGRESS",
    };
  }

  advance(): WarmUpState {
    if (this.complete) return this.deriveState();
    if (this.stages.length < this.config.phases.length) {
      this.stages.push(newSectionStage(this.stages.length + 1));
    } else {
      this.complete = true;
    }
    return this.deriveState();
  }

  undo(): boolean {
    if (this.complete) {
      this.complete = false;
      return true;
    }
    if (this.stages.length <= 1) return false;
    this.stages.pop();
    return true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): WarmUpState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: cloneStages(this.stages), turns: [] };
  }
}

export const warmUpEngineFactory: ExerciseEngineFactory<
  WarmUpConfigData,
  WarmUpState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: WarmUpConfigData, prior?: EngineFacts) {
    return new WarmUpEngine(config, prior);
  },
};

registerExerciseEngineFactory(warmUpEngineFactory);
```

- [ ] **Step 8: Write the registry test**

Create `app/tests/modules/exercise/engine.registry.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  getExerciseEngineFactory,
  registerExerciseEngineFactory,
  resetExerciseEngineRegistry,
} from "@modules/exercise/engine.registry";

const stubFactory = {
  exerciseRulesetVersionKey: "WARM_UP_V1" as const,
  create: () => {
    throw new Error("not used");
  },
};

describe("exercise engine registry", () => {
  beforeEach(() => {
    resetExerciseEngineRegistry();
  });

  it("returns a registered factory by key", () => {
    registerExerciseEngineFactory(stubFactory);

    expect(getExerciseEngineFactory("WARM_UP_V1")).toBe(stubFactory);
  });

  it("returns undefined for an unregistered key", () => {
    expect(getExerciseEngineFactory("WARM_UP_V1")).toBeUndefined();
  });

  it("refuses a duplicate registration", () => {
    registerExerciseEngineFactory(stubFactory);

    expect(() => registerExerciseEngineFactory(stubFactory)).toThrow(
      /already registered/,
    );
  });
});
```

- [ ] **Step 9: Run both test files**

Run:
```bash
cd /home/user/dart-analytics/app
npx vitest run tests/modules/exercise/
```
Expected: PASS, 10 tests across 2 files.

- [ ] **Step 10: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/game/types.ts \
        app/src/lib/exercise/rulesets/types.ts \
        app/src/modules/exercise/ \
        app/tests/modules/exercise/
git commit -m "feat(exercise): add the ExerciseEngine contract and WarmUpEngine"
```

---

### Task 9: Server-side exercise ruleset validation

**Files:**
- Create: `app/src/services/exercise-rulesets/interfaces.ts`
- Create: `app/src/services/exercise-rulesets/warm-up/warm-up.validator.ts`
- Create: `app/src/services/exercise-rulesets/registry.ts`
- Test: `app/tests/services/exercise-rulesets/warm-up.validator.test.ts`
- Test: `app/tests/services/exercise-rulesets/registry.test.ts`

**Interfaces:**
- Consumes: `WarmUpV1Config`, `ExerciseRulesetVersionKey` from `@lib/exercise/rulesets/types`.
- Produces:
  - `type ExerciseConfigValidationResult = { ok: true; config: Record<string, unknown> } | { ok: false; issues: string[] }`
  - `interface ExerciseRulesetValidator { validateConfig(input: { config: unknown }): ExerciseConfigValidationResult }`
  - `const warmUpValidator: ExerciseRulesetValidator`
  - `function getExerciseRulesetValidator(key: string): ExerciseRulesetValidator | undefined`

- [ ] **Step 1: Write the failing validator test**

Create `app/tests/services/exercise-rulesets/warm-up.validator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { warmUpValidator } from "@services/exercise-rulesets/warm-up/warm-up.validator";

const VALID = {
  phases: [{ name: "Upper", targets: [5, 20, 1], durationSeconds: 60 }],
};

describe("warmUpValidator.validateConfig", () => {
  it("accepts a well-formed configuration", () => {
    const result = warmUpValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects an empty phase list", () => {
    const result = warmUpValidator.validateConfig({ config: { phases: [] } });

    expect(result.ok).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = warmUpValidator.validateConfig({
      config: { ...VALID, captureModeKey: "ANALYTICS" },
    });

    expect(result.ok).toBe(false);
  });

  it("rejects a target outside the board", () => {
    const result = warmUpValidator.validateConfig({
      config: { phases: [{ name: "Bad", targets: [26], durationSeconds: 60 }] },
    });

    expect(result.ok).toBe(false);
  });

  it("names the offending path in its issues", () => {
    const result = warmUpValidator.validateConfig({
      config: { phases: [{ name: "", targets: [5], durationSeconds: 60 }] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("phases");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run:
```bash
cd /home/user/dart-analytics/app
npx vitest run tests/services/exercise-rulesets/warm-up.validator.test.ts
```
Expected: FAIL — cannot resolve `@services/exercise-rulesets/warm-up/warm-up.validator`.

- [ ] **Step 3: Write the interface**

Create `app/src/services/exercise-rulesets/interfaces.ts`:

```ts
export type ExerciseConfigValidationResult =
  | { ok: true; config: Record<string, unknown> }
  | { ok: false; issues: string[] };

/**
 * Server-side validation for one exercise ruleset version. Narrower than the
 * game-side `RulesetValidator`: a non-game exercise writes no turns and no
 * darts, so there is no batch to validate — only the configuration snapshot
 * taken at session start.
 */
export interface ExerciseRulesetValidator {
  validateConfig(input: { config: unknown }): ExerciseConfigValidationResult;
}
```

- [ ] **Step 4: Write the validator**

Create `app/src/services/exercise-rulesets/warm-up/warm-up.validator.ts`:

```ts
import { WarmUpV1Config } from "@lib/exercise/rulesets/types";
import type {
  ExerciseConfigValidationResult,
  ExerciseRulesetValidator,
} from "../interfaces";

/**
 * Warm-Up v1 asserts only that the phase list parses: the ruleset has no mode
 * pair to cross-check and no dart rows to bound (09-training-routines.md §16).
 * The §7 sixty-minute cap spans a whole routine, so it belongs to
 * `modules/training/routine-duration.module.ts`, not here.
 */
export const warmUpValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = WarmUpV1Config.safeParse(config);
    if (!parsed.success) {
      return {
        ok: false,
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      };
    }
    return { ok: true, config: parsed.data as Record<string, unknown> };
  },
};
```

- [ ] **Step 5: Write the registry**

Create `app/src/services/exercise-rulesets/registry.ts`:

```ts
import type { ExerciseRulesetValidator } from "./interfaces";
import { warmUpValidator } from "./warm-up/warm-up.validator";

const REGISTRY: Record<string, ExerciseRulesetValidator> = {
  WARM_UP_V1: warmUpValidator,
};

export function getExerciseRulesetValidator(
  exerciseRulesetVersionKey: string,
): ExerciseRulesetValidator | undefined {
  return REGISTRY[exerciseRulesetVersionKey];
}
```

- [ ] **Step 6: Write the registry test**

Create `app/tests/services/exercise-rulesets/registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getExerciseRulesetValidator } from "@services/exercise-rulesets/registry";
import { warmUpValidator } from "@services/exercise-rulesets/warm-up/warm-up.validator";

describe("getExerciseRulesetValidator", () => {
  it("resolves WARM_UP_V1", () => {
    expect(getExerciseRulesetValidator("WARM_UP_V1")).toBe(warmUpValidator);
  });

  it("returns undefined for a game ruleset key", () => {
    expect(getExerciseRulesetValidator("501_V1")).toBeUndefined();
  });
});
```

- [ ] **Step 7: Run the tests and the wiring gates**

Run:
```bash
cd /home/user/dart-analytics/app
npx vitest run tests/services/exercise-rulesets/
cd /home/user/dart-analytics
bash scripts/check-game-engines.sh && bash scripts/check-game-wiring.sh && bash scripts/check-file-locations.sh
```
Expected: 7 tests pass, and all three gates exit zero. The game gates must stay green precisely because `WARM_UP_V1` was kept out of `services/rulesets/registry.ts` — if `check-game-wiring.sh` fails here, something added the key to the game registry or to `RULESET_CAPABILITIES`; remove it rather than widening the gate.

- [ ] **Step 8: Commit**

```bash
git add app/src/services/exercise-rulesets/ app/tests/services/exercise-rulesets/
git commit -m "feat(exercise): validate warm-up configuration server-side"
```

---

### Task 10: TrainingEngine

**Files:**
- Create: `app/src/modules/training/types.ts`
- Create: `app/src/modules/training/training.module.ts`
- Test: `app/tests/modules/training/training.module.test.ts`

**Interfaces:**
- Consumes: `ExerciseRulesetVersionKey` from `@lib/exercise/rulesets/types`.
- Produces:
  - `type RoutineStepSnapshot = { sequenceNumber: number; exerciseName: string; exerciseRulesetVersionKey: ExerciseRulesetVersionKey; configuration: Record<string, unknown> }`
  - `type RoutineSnapshot = { routineName: string; steps: readonly RoutineStepSnapshot[] }` — this is the JSONB shape written to `activity_configurations.configuration`
  - `type TrainingState = { stepIndex: number; stepCount: number; currentStep: RoutineStepSnapshot; completedStepCount: number; status: "IN_PROGRESS" | "COMPLETE" }`
  - `const trainingEngine: { create(snapshot: RoutineSnapshot, completedStepCount?: number): TrainingEngine }`
  - `interface TrainingEngine { state(): TrainingState; completeStep(): TrainingState; isComplete(): boolean }`

`TrainingEngine` orchestrates only (§8): it knows which step is active and when the training is over. It never touches an `ExerciseEngine`'s internals, and it holds no clock, for the same determinism reason as Task 8.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/training/training.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { trainingEngine } from "@modules/training/training.module";
import type { RoutineSnapshot } from "@modules/training/types";

const SNAPSHOT: RoutineSnapshot = {
  routineName: "Warm-Up",
  steps: [
    {
      sequenceNumber: 1,
      exerciseName: "Warm-Up",
      exerciseRulesetVersionKey: "WARM_UP_V1",
      configuration: { phases: [] },
    },
    {
      sequenceNumber: 2,
      exerciseName: "Warm-Up",
      exerciseRulesetVersionKey: "WARM_UP_V1",
      configuration: { phases: [] },
    },
  ],
};

describe("trainingEngine", () => {
  it("starts on the first step", () => {
    const training = trainingEngine.create(SNAPSHOT);

    expect(training.state()).toEqual({
      stepIndex: 0,
      stepCount: 2,
      currentStep: SNAPSHOT.steps[0],
      completedStepCount: 0,
      status: "IN_PROGRESS",
    });
  });

  it("advances to the next step when one completes", () => {
    const training = trainingEngine.create(SNAPSHOT);

    const state = training.completeStep();

    expect(state.stepIndex).toBe(1);
    expect(state.completedStepCount).toBe(1);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("completes when the final step completes", () => {
    const training = trainingEngine.create(SNAPSHOT);
    training.completeStep();

    const state = training.completeStep();

    expect(state.status).toBe("COMPLETE");
    expect(state.completedStepCount).toBe(2);
    expect(training.isComplete()).toBe(true);
  });

  it("resumes from a completed step count", () => {
    const training = trainingEngine.create(SNAPSHOT, 1);

    expect(training.state().stepIndex).toBe(1);
    expect(training.state().completedStepCount).toBe(1);
  });

  it("stays on the last step once complete", () => {
    const training = trainingEngine.create(SNAPSHOT, 2);

    expect(training.state().status).toBe("COMPLETE");
    expect(training.state().stepIndex).toBe(1);
    expect(training.completeStep().completedStepCount).toBe(2);
  });

  it("rejects a routine with no steps", () => {
    expect(() =>
      trainingEngine.create({ routineName: "Empty", steps: [] }),
    ).toThrow(/at least one step/);
  });

  it("returns a copy of the current step, not a live reference", () => {
    const training = trainingEngine.create(SNAPSHOT);

    const step = training.state().currentStep;

    expect(step).not.toBe(SNAPSHOT.steps[0]);
    expect(step).toEqual(SNAPSHOT.steps[0]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run:
```bash
cd /home/user/dart-analytics/app
npx vitest run tests/modules/training/training.module.test.ts
```
Expected: FAIL — cannot resolve `@modules/training/training.module`.

- [ ] **Step 3: Write the types**

Create `app/src/modules/training/types.ts`:

```ts
import type { ExerciseRulesetVersionKey } from "@lib/exercise/rulesets/types";

/**
 * One resolved step of a routine as stored in the training snapshot. Resolved,
 * not template-shaped: any adaptive resolution (09-training-routines.md §21)
 * has already been applied before this reaches the runtime.
 */
export type RoutineStepSnapshot = {
  sequenceNumber: number;
  exerciseName: string;
  exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  configuration: Record<string, unknown>;
};

/**
 * The Resolved Training Configuration (§18) — the JSONB written to
 * `activity_configurations.configuration` at Training start and never updated.
 */
export type RoutineSnapshot = {
  routineName: string;
  steps: readonly RoutineStepSnapshot[];
};

export type TrainingState = {
  stepIndex: number;
  stepCount: number;
  currentStep: RoutineStepSnapshot;
  completedStepCount: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
```

- [ ] **Step 4: Write the module**

Create `app/src/modules/training/training.module.ts`:

```ts
import type {
  RoutineSnapshot,
  RoutineStepSnapshot,
  TrainingState,
} from "./types";

/**
 * Runtime orchestration for one training: which step is active, how many have
 * finished, and whether the routine is over (09-training-routines.md §8).
 *
 * It does not know how an exercise evaluates anything — that is the active
 * `ExerciseEngine`'s job — and it holds no clock, so it stays deterministic
 * with respect to the snapshot it was built from.
 */
export interface TrainingEngine {
  state(): TrainingState;
  completeStep(): TrainingState;
  isComplete(): boolean;
}

function cloneStep(step: RoutineStepSnapshot): RoutineStepSnapshot {
  return { ...step, configuration: { ...step.configuration } };
}

class OrderedTraining implements TrainingEngine {
  private readonly snapshot: RoutineSnapshot;
  private completedStepCount: number;

  constructor(snapshot: RoutineSnapshot, completedStepCount: number) {
    if (snapshot.steps.length === 0) {
      throw new Error("a routine snapshot must hold at least one step");
    }
    this.snapshot = snapshot;
    this.completedStepCount = Math.min(
      Math.max(completedStepCount, 0),
      snapshot.steps.length,
    );
  }

  private get stepIndex(): number {
    return Math.min(this.completedStepCount, this.snapshot.steps.length - 1);
  }

  state(): TrainingState {
    return {
      stepIndex: this.stepIndex,
      stepCount: this.snapshot.steps.length,
      currentStep: cloneStep(this.snapshot.steps[this.stepIndex]),
      completedStepCount: this.completedStepCount,
      status: this.isComplete() ? "COMPLETE" : "IN_PROGRESS",
    };
  }

  completeStep(): TrainingState {
    if (!this.isComplete()) this.completedStepCount += 1;
    return this.state();
  }

  isComplete(): boolean {
    return this.completedStepCount >= this.snapshot.steps.length;
  }
}

export const trainingEngine = {
  create(snapshot: RoutineSnapshot, completedStepCount = 0): TrainingEngine {
    return new OrderedTraining(snapshot, completedStepCount);
  },
};
```

- [ ] **Step 5: Run the test**

Run:
```bash
cd /home/user/dart-analytics/app
npx vitest run tests/modules/training/training.module.test.ts
```
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/training/ app/tests/modules/training/
git commit -m "feat(training): orchestrate ordered routine steps"
```

---

### Task 11: The sixty-minute routine cap

**Files:**
- Create: `app/src/modules/training/routine-duration.module.ts`
- Test: `app/tests/modules/training/routine-duration.module.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `const MAX_ROUTINE_MINUTES = 60`
  - `type RoutineStepDuration = { sequenceNumber: number; durationTypeKey: "ROUNDS" | "MINUTES"; durationValue: number }`
  - `type RoutineDurationResult = { ok: true; totalMinutes: number } | { ok: false; issues: string[] }`
  - `function validateRoutineDuration(steps: readonly RoutineStepDuration[]): RoutineDurationResult`

`09-training-routines.md` §6 makes routine duration the sum of its steps and §7 caps it at 60 minutes of active training. A `ROUNDS` step contributes no minutes — it has no wall-clock duration — so it is counted as zero and does not make an otherwise-valid routine fail. That is a deliberate limitation, stated in the module's own doc comment, and the reason a `ROUNDS`-only routine is accepted.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/training/routine-duration.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_ROUTINE_MINUTES,
  validateRoutineDuration,
} from "@modules/training/routine-duration.module";

const minutes = (sequenceNumber: number, durationValue: number) => ({
  sequenceNumber,
  durationTypeKey: "MINUTES" as const,
  durationValue,
});

describe("validateRoutineDuration", () => {
  it("caps a routine at sixty minutes", () => {
    expect(MAX_ROUTINE_MINUTES).toBe(60);
  });

  it("accepts a routine at exactly the cap", () => {
    const result = validateRoutineDuration([minutes(1, 30), minutes(2, 30)]);

    expect(result).toEqual({ ok: true, totalMinutes: 60 });
  });

  it("rejects a routine over the cap", () => {
    const result = validateRoutineDuration([minutes(1, 40), minutes(2, 21)]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("61");
  });

  it("rejects an empty routine", () => {
    const result = validateRoutineDuration([]);

    expect(result.ok).toBe(false);
  });

  it("rejects a non-positive duration", () => {
    const result = validateRoutineDuration([minutes(1, 0)]);

    expect(result.ok).toBe(false);
  });

  it("rejects duplicate sequence numbers", () => {
    const result = validateRoutineDuration([minutes(1, 10), minutes(1, 10)]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("sequence");
  });

  it("rejects a gap in the sequence", () => {
    const result = validateRoutineDuration([minutes(1, 10), minutes(3, 10)]);

    expect(result.ok).toBe(false);
  });

  it("counts a ROUNDS step as zero minutes", () => {
    const result = validateRoutineDuration([
      minutes(1, 55),
      { sequenceNumber: 2, durationTypeKey: "ROUNDS", durationValue: 20 },
    ]);

    expect(result).toEqual({ ok: true, totalMinutes: 55 });
  });

  it("accepts the seeded five-minute warm-up routine", () => {
    expect(validateRoutineDuration([minutes(1, 5)])).toEqual({
      ok: true,
      totalMinutes: 5,
    });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run:
```bash
cd /home/user/dart-analytics/app
npx vitest run tests/modules/training/routine-duration.module.test.ts
```
Expected: FAIL — cannot resolve `@modules/training/routine-duration.module`.

- [ ] **Step 3: Write the module**

Create `app/src/modules/training/routine-duration.module.ts`:

```ts
/**
 * A routine is one focused training block and may not exceed sixty minutes of
 * active training (09-training-routines.md §7). Its duration is the sum of its
 * steps and is never stored independently (§6), so this cannot be a database
 * CHECK — a CHECK cannot sum sibling rows — and the repository uses no
 * triggers. It is validated here and called from every routine write.
 *
 * A `ROUNDS` step contributes zero minutes: rounds have no wall-clock
 * duration, so a routine built only from them is accepted. Bounding those is a
 * separate rule, and does not exist yet.
 */
export const MAX_ROUTINE_MINUTES = 60;

export type RoutineStepDuration = {
  sequenceNumber: number;
  durationTypeKey: "ROUNDS" | "MINUTES";
  durationValue: number;
};

export type RoutineDurationResult =
  | { ok: true; totalMinutes: number }
  | { ok: false; issues: string[] };

function sequenceIssues(steps: readonly RoutineStepDuration[]): string[] {
  const ordered = [...steps]
    .map((step) => step.sequenceNumber)
    .sort((a, b) => a - b);
  return ordered.flatMap((sequenceNumber, index) =>
    sequenceNumber === index + 1
      ? []
      : [`step sequence must be 1..n with no gaps or duplicates`],
  );
}

export function validateRoutineDuration(
  steps: readonly RoutineStepDuration[],
): RoutineDurationResult {
  const issues: string[] = [];

  if (steps.length === 0) issues.push("a routine must hold at least one step");

  for (const step of steps) {
    if (!Number.isInteger(step.durationValue) || step.durationValue < 1) {
      issues.push(
        `step ${step.sequenceNumber} must have a positive whole duration`,
      );
    }
  }

  issues.push(...new Set(sequenceIssues(steps)));

  const totalMinutes = steps.reduce(
    (total, step) =>
      step.durationTypeKey === "MINUTES"
        ? total + Math.max(step.durationValue, 0)
        : total,
    0,
  );

  if (totalMinutes > MAX_ROUTINE_MINUTES) {
    issues.push(
      `routine is ${totalMinutes} minutes; the maximum is ${MAX_ROUTINE_MINUTES}`,
    );
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, totalMinutes };
}
```

- [ ] **Step 4: Run the test**

Run:
```bash
cd /home/user/dart-analytics/app
npx vitest run tests/modules/training/routine-duration.module.test.ts
```
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/training/routine-duration.module.ts \
        app/tests/modules/training/routine-duration.module.test.ts
git commit -m "feat(training): enforce the sixty-minute routine cap"
```

---

### Task 12: Close out Part B

- [ ] **Step 1: Run the full validation chain**

Run:
```bash
cd /home/user/dart-analytics/app
npm run validate:app
```
Expected: every step exits zero — `db:status`, `db:migrate`, `db:introspect`, `npx fallow`, the full Vitest suite, `astro check` reporting **0 errors, 0 warnings, 0 hints**, and the graph refresh. A duplication complaint from `fallow` about the two registries is the one predictable failure: `modules/exercise/engine.registry.ts` deliberately mirrors `modules/game/engine.registry.ts`. If it fires, do not merge the two registries — the game registry is typed on `RulesetVersionKey` and gated by `check-game-wiring.sh`. Extract the shared map mechanics into a small generic helper both import instead, and add a test for it.

- [ ] **Step 2: Run every structural gate**

Run:
```bash
cd /home/user/dart-analytics
for s in file-locations agent-mirrors astro-class-composition astro-conventions \
         game-engines refinement-coverage type-barrels alias-sync constraint-mirror \
         no-inline-comments style-tokens findings-log game-wiring test-coverage; do
  echo "== $s"; bash "scripts/check-$s.sh" || echo "FAILED: $s"; done
```
Expected: no `FAILED:` line. `check-alias-sync.sh` passes without changes because `@modules/*`, `@services/*` and `@lib/*` already exist in both `tsconfig.json` and `vitest.config.ts`; if it fails, a new alias was introduced that must be added to both files.

- [ ] **Step 3: Run the context-maintenance skill**

Invoke the `context-maintenance` skill and complete every step. It must register the new `modules/exercise/`, `modules/training/`, `lib/exercise/` and `services/exercise-rulesets/` trees in the context map and file inventory, and append the `09-training-routines.md` status mismatch to `FINDINGS.md`:

```markdown
- `docs/architecture/09-training-routines.md` frontmatter says `status: canonical` while its body
  line 10 says "Status: Proposed architectural design". Noticed while designing training phase 1;
  out of scope to fix there. (2026-09-10)
```

- [ ] **Step 4: Format and push**

```bash
cd /home/user/dart-analytics/app && npm run format && npm run format:check
cd /home/user/dart-analytics
git add -A
git commit -m "docs: register training and exercise modules in the context system"
git push -u origin claude/training-engines-warmup
```
Expected: `format:check` clean, push succeeds. Retry a network failure up to 4 times with 2s/4s/8s/16s backoff.

---

# Out of scope for this plan

Sub-phases 3 and 4 of the spec, planned separately once Part A's schema is proven against the real database:

- **API** — start-training, advance-phase, complete and abandon endpoints; writing `activity_configurations` and the `exercise_sessions` row; resolving `exercise_templates.default_configuration` merged with `routine_steps.configuration` into the snapshot.
- **Frontend** — `pages/training/play/index.astro`, `lib/training/warm-up-play.data.ts`, the `WarmUp.astro` and `WarmUpResults.astro` components, the client-only pause store, the phase-transition sound ping, and the `register-route-data.ts` wiring.

Two open items from the spec's §7 must be answered while planning sub-phase 3, not now:

- whether the existing per-session abandon endpoint works unchanged against an `exercise_sessions` row belonging to a training, and whether abandoning cascades to the parent `activities` row or needs a second call;
- whether a sound-ping utility already exists to reuse for phase transitions.
