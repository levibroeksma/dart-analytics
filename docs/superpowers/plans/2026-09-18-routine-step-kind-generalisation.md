# Routine Step-Kind Generalisation and Catalog Expansion (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any routine-eligible game can be a routine step, pinned to a game ruleset version on its template, started from the step's own data rather than TUOD constants, and rendered through a per-kind client adapter; then seed the first two new game templates (Score Training timed, 121 timed).

**Architecture:** Migration `0039` pins `exercise_templates.game_ruleset_version_id` with a composite FK (mirror of `0035`) and a `NOT VALID` pair `CHECK`; seed `0021` back-fills Finishing → `TUOD_V1`. The server gains one small table (`services/routines/game-step.ts`) of routine-eligible rulesets with their duration hook; `startGameStep` and `stepConfigurationIssues` read the step. The client gains an adapter registry under `lib/training/routines/adapters/`; `routine-play.data.ts` holds one `adapter` instead of four engine fields. Content seed `0022` adds the two templates.

**Tech Stack:** PostgreSQL/dbmate, drizzle-orm, Zod, Alpine.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-routine-step-kind-generalisation-design.md`. Depends on Phase 1 (`2026-09-18-custom-routine-builder.md`) having landed.

## Global Constraints

- Branch off `main` after Phase 1 merged: `feat/routine-step-kinds`. Do not commit unless asked; do not open the PR until asked.
- Migration `0039_exercise_template_game_ruleset.sql`; seeds `0021_exercise_template_game_rulesets.sql` and `0022_routine_game_templates.sql`. Renumber to the chain head if needed. Never edit applied files.
- Deploy runs every migration before any seed (issue #378): nothing in `0039` may depend on `0021` having run. Hence the `CHECK` is added `NOT VALID`.
- `GameEngine` contracts and the engines themselves are untouched (`.claude/rules/game-engines.md`; `01-Routines.md` §10).
- Modules under `app/src/modules/` never import `@client/api`; anything that wraps a play factory lives under `app/src/lib/`.
- Every ruleset key in `services/rulesets/registry.ts` already declares capabilities; this plan adds no key there and no new gate script.
- TDD per `app/CLAUDE.md`; tests mirror `app/src/`; no comments inside function bodies.

## Resolved judgement calls

| Spec item | Resolution |
| --- | --- |
| §3 CHECK shape | one migration: `ADD CONSTRAINT … CHECK (…) NOT VALID`; a later `VALIDATE CONSTRAINT` migration is filed as a follow-up issue to land after `0021` has run in production |
| §4.4 hook location | `app/src/services/routines/game-step.ts` (server table); the client mirror is the adapter registry |
| §5.3 eligible list | `TUOD_V1`, `SCORE_TRAINING_V1` (MINUTES), `121_V2` (MINUTES) — all three declare `ANALYTICS`+`VISUAL_BOARD` in `RULESET_CAPABILITIES` and seed `0007`; `121_V1` (TARGET only) excluded |
| §5.1 registry location | `app/src/lib/training/routines/adapters/` (not `modules/`: adapters import play factories that import `@client/api`) |
| §7 gate | no new script; `step-adapter.registry.test.ts` asserts both tables agree |

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `database/migrations/0039_exercise_template_game_ruleset.sql` | unique pair on `ruleset_versions`, new column + composite FK + `NOT VALID` CHECK; recreate `v_routine_execution` and `v_exercise_template_catalog` with `game_ruleset_version_key` |
| `database/seeds/0021_exercise_template_game_rulesets.sql` | Finishing → `TUOD_V1` |
| `database/seeds/0022_routine_game_templates.sql` | "Score Training (timed)" and "121 (timed)" templates |
| `database/verification/0039_exercise_template_game_ruleset_checks.sql` | composite FK, pair CHECK on new rows, view column, backfill, seeded templates |
| `app/src/db/schema.ts` | column + view bodies |
| `app/src/services/routines/game-step.ts` | `ROUTINE_GAME_STEPS` table: per ruleset, `applyStepDuration(config, minutes)`; `isRoutineEligible(rulesetKey)` |
| `app/src/services/routines/types.ts` | `RoutineGameStepHook` |
| `app/src/services/training-session.service.ts` | reads `gameRulesetVersionKey` from the step; validates GAME per ruleset; `startGameStep` from the step |
| `app/src/services/types.ts`, `app/src/repositories/interfaces.ts`, `app/src/pages/api/training-sessions/types.ts` | `gameRulesetVersionKey` on the row and the resolved step |
| `app/src/repositories/training-session.repository.ts`, `routine.repository.ts` | select the new column |
| `app/src/services/routine.service.ts` | GAME step minute bounds per ruleset (replaces the TUOD-only bound from Phase 1) |
| `app/src/lib/training/routines/adapters/step-adapter.registry.ts` | `resolveStepAdapter(step)`; the four Phase-1 kinds + `GAME:TUOD_V1`, `GAME:SCORE_TRAINING_V1`, `GAME:121_V2` |
| `app/src/lib/training/routines/adapters/{warm-up,switching,double-pattern,game}.adapter.ts` | one adapter each |
| `app/src/lib/training/routines/adapters/interfaces.ts`, `types.ts` | `StepAdapter`, `StepAdapterKey`, `StepAdapterContext` |
| `app/src/lib/training/routines/game-step.data.ts` | was `finishing-step.data.ts`: `gameStep(playFactory, onStepComplete, onAbandon)` |
| `app/src/lib/training/routines/routine-play.data.ts` | one `adapter` field; `openStep` delegates |
| `app/src/stores/training-session.store.ts` | `setStep(label)` takes the adapter's header label |
| `app/src/modules/training/routines/routine-summary.module.ts` | `summariseGame(label, rows)` generic; TUOD/Score Training/121 row builders |
| `app/src/pages/training/routines/play/index.astro` | panels switched on `adapter.panel` |
| tests | mirrored |

---

### Task 1: Migration `0039`, seed `0021`, verification, `schema.ts`

**Files:**
- Create: `database/migrations/0039_exercise_template_game_ruleset.sql`, `database/seeds/0021_exercise_template_game_rulesets.sql`, `database/verification/0039_exercise_template_game_ruleset_checks.sql`
- Modify: `app/src/db/schema.ts`
- Test: `app/tests/db/schema-view-drift.test.ts` (existing)

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feat/routine-step-kinds
```

- [ ] **Step 2: Verification first**

Create `database/verification/0039_exercise_template_game_ruleset_checks.sql` (header per `0035`'s; `BEGIN … ROLLBACK`; temp `verification_results`):

```sql
-- 1 column exists, nullable uuid
INSERT INTO verification_results
SELECT '1', 'exercise_templates.game_ruleset_version_id exists and is nullable',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END, format('%s column(s)', count(*))
FROM information_schema.columns
WHERE table_name = 'exercise_templates' AND column_name = 'game_ruleset_version_id'
    AND data_type = 'uuid' AND is_nullable = 'YES';

-- 2 composite FK over both columns
INSERT INTO verification_results
SELECT '2', 'fk_exercise_templates_game_ruleset_version is composite (game_type_id, game_ruleset_version_id)',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END, format('%s of 2 columns', count(*))
FROM information_schema.key_column_usage
WHERE constraint_name = 'fk_exercise_templates_game_ruleset_version'
    AND column_name IN ('game_type_id', 'game_ruleset_version_id');

-- 3 cross-game pin rejected: TUOD template pinned to SCORE_TRAINING_V1
DO $$
BEGIN
    BEGIN
        INSERT INTO exercise_templates (id, exercise_type_id, exercise_ruleset_version_id, game_type_id, game_ruleset_version_id, name, description, default_configuration, is_system_template, created_at, updated_at)
        VALUES ('01999500-0000-7000-8000-0000000000a1',
                (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
                (SELECT id FROM game_types WHERE implementation_key = 'TUOD'),
                (SELECT id FROM ruleset_versions WHERE implementation_key = 'SCORE_TRAINING_V1'),
                'Cross-game pin', 'Fixture.', '{}'::jsonb, FALSE, now(), now());
        INSERT INTO verification_results VALUES ('3', 'a ruleset version of another game is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN foreign_key_violation THEN
        INSERT INTO verification_results VALUES ('3', 'a ruleset version of another game is rejected', 'PASS', NULL);
    END;
END $$;

-- 4 half-pair rejected by the CHECK on a NEW row (NOT VALID still checks inserts)
DO $$
BEGIN
    BEGIN
        INSERT INTO exercise_templates (id, exercise_type_id, exercise_ruleset_version_id, game_type_id, game_ruleset_version_id, name, description, default_configuration, is_system_template, created_at, updated_at)
        VALUES ('01999500-0000-7000-8000-0000000000a2',
                (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
                (SELECT id FROM game_types WHERE implementation_key = 'TUOD'), NULL,
                'Half pair', 'Fixture.', '{}'::jsonb, FALSE, now(), now());
        INSERT INTO verification_results VALUES ('4', 'a game template with no game ruleset version is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('4', 'a game template with no game ruleset version is rejected', 'PASS', NULL);
    END;
END $$;

-- 5 seed 0021 backfilled Finishing
INSERT INTO verification_results
SELECT '5', 'seed 0021 pinned Finishing to TUOD_V1',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END, format('%s row(s)', count(*))
FROM exercise_templates et JOIN ruleset_versions rv ON rv.id = et.game_ruleset_version_id
WHERE et.id = '0199b000-0000-7000-8000-000000000004' AND rv.implementation_key = 'TUOD_V1';

-- 6 every system GAME template carries a pin (what VALIDATE CONSTRAINT will later prove)
INSERT INTO verification_results
SELECT '6', 'no system GAME template is left half-paired',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END, format('%s half-paired row(s)', count(*))
FROM exercise_templates
WHERE is_system_template AND (game_type_id IS NULL) <> (game_ruleset_version_id IS NULL);

-- 7 views expose game_ruleset_version_key
INSERT INTO verification_results
SELECT '7', 'both routine views expose game_ruleset_version_key',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END, format('%s of 2 views', count(*))
FROM information_schema.columns
WHERE table_name IN ('v_routine_execution', 'v_exercise_template_catalog') AND column_name = 'game_ruleset_version_key';

-- 8 seed 0022 templates present and valid pairs
INSERT INTO verification_results
SELECT '8', 'seed 0022 added Score Training (timed) and 121 (timed) pinned to their rulesets',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END, format('%s row(s)', count(*))
FROM v_exercise_template_catalog
WHERE (name, game_ruleset_version_key) IN (('Score Training (timed)', 'SCORE_TRAINING_V1'), ('121 (timed)', '121_V2'))
    AND has_default_configuration;
```

Close with the standard result/summary selects and `ROLLBACK;`.

- [ ] **Step 3: Migration**

```sql
-- ============================================================
-- Migration: 0039_exercise_template_game_ruleset.sql
--
-- Purpose:
-- Let a GAME exercise template pin the game ruleset version its
-- default_configuration was written against — the game-side
-- mirror of 0035. Until now startGameStep hardcoded TUOD/TUOD_V1,
-- so a second game template could not be seeded at all.
--
-- The foreign key is composite over (game_type_id,
-- game_ruleset_version_id) so a template cannot pin another
-- game's ruleset; ruleset_versions gets the referenceable pair
-- (game_type_id, id), already unique by way of the primary key.
--
-- The pair CHECK (both NULL or both set) is added NOT VALID: the
-- deploy runs every migration before any seed (issue #378), so at
-- this point the Finishing template still carries game_type_id
-- with no version. NOT VALID enforces the pair on every INSERT
-- and UPDATE from now on — seed 0021's backfill UPDATE included —
-- and leaves existing rows to a later VALIDATE CONSTRAINT once
-- 0021 has run everywhere (tracked as a follow-up issue).
--
-- Both routine views are recreated to expose
-- game_ruleset_version_key (LEFT JOIN, additive).
-- ============================================================

-- migrate:up
ALTER TABLE ruleset_versions
    ADD CONSTRAINT uq_ruleset_versions_game_type_id UNIQUE (game_type_id, id);

ALTER TABLE exercise_templates
    ADD COLUMN game_ruleset_version_id UUID;

ALTER TABLE exercise_templates
    ADD CONSTRAINT fk_exercise_templates_game_ruleset_version
    FOREIGN KEY (game_type_id, game_ruleset_version_id)
    REFERENCES ruleset_versions (game_type_id, id)
    ON DELETE RESTRICT;

ALTER TABLE exercise_templates
    ADD CONSTRAINT chk_exercise_templates_game_ruleset_pair
    CHECK ((game_type_id IS NULL) = (game_ruleset_version_id IS NULL)) NOT VALID;

COMMENT ON COLUMN exercise_templates.game_ruleset_version_id IS 'Game ruleset version a GAME template''s default_configuration was written against (0039). NULL for a non-game template; paired with game_type_id by chk_exercise_templates_game_ruleset_pair.';

DROP VIEW IF EXISTS v_routine_execution;
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rt.is_system_template,
    rt.player_id,
    rt.description AS routine_description,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    et.description AS exercise_description,
    ext.implementation_key AS exercise_type_key,
    erv.implementation_key AS exercise_ruleset_version_key,
    gt.implementation_key AS game_type_key,
    grv.implementation_key AS game_ruleset_version_key,
    rs.duration_value,
    dt.implementation_key AS duration_type_key,
    et.default_configuration,
    rs.configuration AS step_configuration
FROM routine_templates rt
    JOIN routine_steps rs      ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN exercise_types ext    ON ext.id = et.exercise_type_id
    JOIN duration_types dt     ON dt.id = rs.duration_type_id
    LEFT JOIN game_types gt    ON gt.id = et.game_type_id
    LEFT JOIN ruleset_versions grv ON grv.id = et.game_ruleset_version_id
    LEFT JOIN exercise_ruleset_versions erv ON erv.id = et.exercise_ruleset_version_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition with owner, descriptions (0038) and the game ruleset version a GAME step pins (0039). game_type_key/game_ruleset_version_key and exercise_ruleset_version_key are NULL for a non-game and a game step respectively.';

DROP VIEW IF EXISTS v_exercise_template_catalog;
CREATE VIEW v_exercise_template_catalog AS
SELECT et.id AS exercise_template_id,
    et.name,
    et.description,
    ext.implementation_key AS exercise_type_key,
    gt.implementation_key  AS game_type_key,
    grv.implementation_key AS game_ruleset_version_key,
    et.default_configuration IS NOT NULL AS has_default_configuration
FROM exercise_templates et
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
    LEFT JOIN game_types gt ON gt.id = et.game_type_id
    LEFT JOIN ruleset_versions grv ON grv.id = et.game_ruleset_version_id
WHERE et.is_system_template
    AND ext.is_published;
COMMENT ON VIEW v_exercise_template_catalog IS 'System exercise templates a player may compose a routine from, with the game ruleset version a GAME template pins (0039).';

-- migrate:down
DROP VIEW IF EXISTS v_exercise_template_catalog;
DROP VIEW IF EXISTS v_routine_execution;
-- (recreate both exactly as 0038 defines them — copy the two CREATE VIEW blocks from 0038's migrate:up)

ALTER TABLE exercise_templates DROP CONSTRAINT IF EXISTS chk_exercise_templates_game_ruleset_pair;
ALTER TABLE exercise_templates DROP CONSTRAINT IF EXISTS fk_exercise_templates_game_ruleset_version;
ALTER TABLE exercise_templates DROP COLUMN IF EXISTS game_ruleset_version_id;
ALTER TABLE ruleset_versions DROP CONSTRAINT IF EXISTS uq_ruleset_versions_game_type_id;
```

- [ ] **Step 4: Seed `0021`**

```sql
-- database/seeds/0021_exercise_template_game_rulesets.sql
-- Backfills exercise_templates.game_ruleset_version_id (migration 0039)
-- for the Finishing system template: TUOD_V1. UPDATE in place (0019
-- shape), idempotent, resolved by implementation_key.
BEGIN;

UPDATE exercise_templates
SET game_ruleset_version_id = (
        SELECT rv.id FROM ruleset_versions rv
        JOIN game_types gt ON gt.id = rv.game_type_id
        WHERE gt.implementation_key = 'TUOD' AND rv.implementation_key = 'TUOD_V1'
    ),
    updated_at = now()
WHERE id = '0199b000-0000-7000-8000-000000000004';

COMMIT;
```

- [ ] **Step 5: `schema.ts`**

Introspect if a database is available; else by hand: `exerciseTemplates` gains `gameRulesetVersionId: uuid("game_ruleset_version_id")`; both views gain `gameRulesetVersionKey: text("game_ruleset_version_key")` and their `.as()` bodies are replaced with the new `SELECT` text.

- [ ] **Step 6: Run and commit**

```bash
cd app && npm test -- tests/db && cd ..
git add database/migrations/0039_exercise_template_game_ruleset.sql database/seeds/0021_exercise_template_game_rulesets.sql database/verification/0039_exercise_template_game_ruleset_checks.sql app/src/db/schema.ts
git commit -m "feat(db): 0039 pin a game ruleset version on GAME exercise templates; seed 0021 backfills Finishing"
```

File the follow-up issue now: "`VALIDATE CONSTRAINT chk_exercise_templates_game_ruleset_pair` after seed 0021 has applied in production" (`discovered-work` label is wrong here — it is planned follow-up; use the repo's ordinary issue path and link this plan).

---

### Task 2: Server — eligibility table, resolution, validation, start from the step

**Files:**
- Create: `app/src/services/routines/game-step.ts`, `app/src/services/routines/types.ts`
- Modify: `app/src/services/types.ts` (barrel raises `./routines/types`; `TrainingStepResolved.gameRulesetVersionKey`)
- Modify: `app/src/repositories/interfaces.ts` (`RoutineStepTemplateRow.gameRulesetVersionKey`, `RoutineExecutionRow.gameRulesetVersionKey`, `ExerciseTemplateCatalogRow.gameRulesetVersionKey`), `training-session.repository.ts`, `routine.repository.ts` (select the column)
- Modify: `app/src/pages/api/training-sessions/types.ts` (`gameRulesetVersionKey: z.string().nullable()` on the resolved step), `app/src/pages/api/routines/types.ts` and `exercise-templates/types.ts` (`gameRulesetVersionKey`)
- Modify: `app/src/services/training-session.service.ts`, `app/src/services/routine.service.ts`
- Test: `app/tests/services/routines/game-step.test.ts`, `app/tests/services/training-session.service.test.ts`, `app/tests/services/routine.service.test.ts`, repository tests

**Interfaces:**
- Produces:
  ```ts
  // services/routines/types.ts
  export type RoutineGameStepHook = {
    rulesetVersionKey: string;
    /** Writes the step's minutes into the ruleset's own timed-mode keys. */
    applyStepDuration(config: Record<string, unknown>, minutes: number): void;
    /** Inclusive minute bounds the ruleset's timed mode accepts. */
    minuteBounds: { min: number; max: number };
  };
  // services/routines/game-step.ts
  export const ROUTINE_GAME_STEPS: Record<string, RoutineGameStepHook>;
  export function routineGameStepHook(rulesetVersionKey: string | null): RoutineGameStepHook | undefined; // undefined = not eligible
  export const ROUTINE_CAPTURE_MODE_KEY = "ANALYTICS"; export const ROUTINE_INPUT_MODE_KEY = "VISUAL_BOARD";
  ```

- [ ] **Step 1: Failing tests for the table**

`app/tests/services/routines/game-step.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ROUTINE_GAME_STEPS, routineGameStepHook } from "@services/routines/game-step";
import { RULESET_CAPABILITIES } from "@lib/game/rulesets/capabilities";
import { getRulesetValidator } from "@services/rulesets/registry";

describe("routine game steps", () => {
  it("lists exactly the timed-mode games", () => {
    expect(Object.keys(ROUTINE_GAME_STEPS).sort()).toEqual(["121_V2", "SCORE_TRAINING_V1", "TUOD_V1"]);
  });

  it("every eligible ruleset declares ANALYTICS + VISUAL_BOARD and has a validator", () => {
    for (const key of Object.keys(ROUTINE_GAME_STEPS)) {
      const pairs = RULESET_CAPABILITIES[key as keyof typeof RULESET_CAPABILITIES] ?? [];
      expect(pairs.some((p) => p.captureModeKey === "ANALYTICS" && p.inputModeKey === "VISUAL_BOARD")).toBe(true);
      expect(getRulesetValidator(key)).toBeDefined();
    }
  });

  it("applies the step's minutes to each ruleset's own keys", () => {
    const tuod: Record<string, unknown> = { duration_type: "ROUNDS", duration_value: 5 };
    ROUTINE_GAME_STEPS.TUOD_V1.applyStepDuration(tuod, 15);
    expect(tuod).toEqual({ duration_type: "MINUTES", duration_value: 15 });
    const st: Record<string, unknown> = {};
    ROUTINE_GAME_STEPS.SCORE_TRAINING_V1.applyStepDuration(st, 10);
    expect(st).toEqual({ duration_type: "MINUTES", duration_value: 10 });
    const ott: Record<string, unknown> = { duration_type: "TARGET" };
    ROUTINE_GAME_STEPS["121_V2"].applyStepDuration(ott, 12);
    expect(ott).toEqual({ duration_type: "MINUTES", duration_value: 12 });
  });

  it("bounds come from each game's own duration helper", () => {
    expect(ROUTINE_GAME_STEPS.TUOD_V1.minuteBounds).toEqual({ min: 3, max: 30 });
    expect(ROUTINE_GAME_STEPS["121_V2"].minuteBounds).toEqual({ min: 3, max: 30 });
  });

  it("an unknown or null key is not eligible", () => {
    expect(routineGameStepHook("501_V1")).toBeUndefined();
    expect(routineGameStepHook(null)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to see it fail**, then implement `services/routines/game-step.ts`:

```ts
import { tuodDurationBounds } from "@lib/game/tuod-duration";
import { scoreTrainingDurationBounds } from "@lib/game/score-training-duration";
import { oneTwentyOneDurationBounds } from "@lib/game/one-twenty-one-duration";
import type { RoutineGameStepHook } from "./types";

/** The capture pair every routine step records under (01-Routines.md §13). */
export const ROUTINE_CAPTURE_MODE_KEY = "ANALYTICS";
export const ROUTINE_INPUT_MODE_KEY = "VISUAL_BOARD";

function minutesInto(config: Record<string, unknown>, minutes: number): void {
  config.duration_type = "MINUTES";
  config.duration_value = minutes;
}

/**
 * Games a routine may run as a step: those with a native timed mode, so the
 * step timer is the game's own duration and expiry ends the game the way its
 * standalone timer would (spec §5.2). A game absent here is not eligible,
 * whatever its capabilities say.
 */
export const ROUTINE_GAME_STEPS: Record<string, RoutineGameStepHook> = {
  TUOD_V1: {
    rulesetVersionKey: "TUOD_V1",
    applyStepDuration: minutesInto,
    minuteBounds: tuodDurationBounds("MINUTES"),
  },
  SCORE_TRAINING_V1: {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    applyStepDuration: minutesInto,
    minuteBounds: scoreTrainingDurationBounds("MINUTES"),
  },
  "121_V2": {
    rulesetVersionKey: "121_V2",
    applyStepDuration: minutesInto,
    minuteBounds: oneTwentyOneDurationBounds("MINUTES"),
  },
};

export function routineGameStepHook(
  rulesetVersionKey: string | null,
): RoutineGameStepHook | undefined {
  return rulesetVersionKey ? ROUTINE_GAME_STEPS[rulesetVersionKey] : undefined;
}
```

`services/routines/types.ts` holds `RoutineGameStepHook`; `services/types.ts` adds `export * from "./routines/types";`.

- [ ] **Step 3: Failing service tests** — in `training-session.service.test.ts`:

- `RESOLVED.steps[1]` gains `gameRulesetVersionKey: "TUOD_V1"`.
- Replace the Phase-1 "injects the step's minutes" case's fixture to use the hook (same assertion).
- Add:

```ts
  it("refuses a GAME step whose ruleset is not routine-eligible", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      ...RESOLVED,
      steps: [{ ...RESOLVED.steps[1], gameTypeKey: "501", gameRulesetVersionKey: "501_V1", defaultConfiguration: {} }],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    expect(await startTraining("p1", "rt-1")).toMatchObject({
      ok: false, code: "VALIDATION_FAILED",
      details: { reason: "game not routine-eligible", steps: [{ sequenceNumber: 4 }] },
    });
  });

  it("validates a Score Training step with its own ruleset", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      ...RESOLVED,
      steps: [{ ...RESOLVED.steps[1], gameTypeKey: "SCORE_TRAINING", gameRulesetVersionKey: "SCORE_TRAINING_V1",
        defaultConfiguration: { duration_type: "MINUTES", duration_value: 10, max_darts_per_turn: 3, max_visit_score: 180 }, durationValue: 8 }],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    const result = await startTraining("p1", "rt-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.steps[0]).toMatchObject({ gameRulesetVersionKey: "SCORE_TRAINING_V1", configuration: { duration_value: 8 } });
  });
```

In the `startTrainingStep` GAME describe: the snapshot step carries `gameTypeKey: "SCORE_TRAINING", gameRulesetVersionKey: "SCORE_TRAINING_V1"`; assert `findGameTypeAndRuleset` `toHaveBeenCalledWith(expect.anything(), "SCORE_TRAINING", "SCORE_TRAINING_V1")` and the response `gameTypeKey`/`rulesetVersionKey` echo them. Add: a snapshot GAME step with `gameRulesetVersionKey: "501_V1"` → `VALIDATION_FAILED { reason: "game not routine-eligible" }` before any lookup.

In `routine.service.test.ts`: CATALOG's Finishing row gains `gameRulesetVersionKey: "TUOD_V1"`; add a Score Training row `gameRulesetVersionKey: "SCORE_TRAINING_V1"`; the "GAME step outside bounds" case keeps `min: 3, max: 30`; add a case where a GAME catalog row has `gameRulesetVersionKey: "501_V1"` → `VALIDATION_FAILED { reason: "game not routine-eligible", step: n }`.

- [ ] **Step 4: Implement**

`training-session.service.ts`:

- Delete `FINISHING_GAME_TYPE_KEY`, `FINISHING_RULESET_VERSION_KEY`; import `routineGameStepHook`, `ROUTINE_CAPTURE_MODE_KEY`, `ROUTINE_INPUT_MODE_KEY` from `./routines/game-step`.
- `injectGameStepDuration(row, configuration)` → uses `routineGameStepHook(row.gameRulesetVersionKey)?.applyStepDuration(configuration, row.durationValue)` when `row.durationTypeKey === "MINUTES"`.
- `stepConfigurationIssues` for GAME:

```ts
  if (row.exerciseTypeKey === GAME_EXERCISE_TYPE_KEY) {
    const hook = routineGameStepHook(row.gameRulesetVersionKey);
    if (!hook) return ["game not routine-eligible"];
    const validator = getRulesetValidator(hook.rulesetVersionKey);
    if (!validator) return [`no ruleset validator for ${hook.rulesetVersionKey}`];
    const result = validator.validateConfig({
      config: configuration,
      captureModeKey: ROUTINE_CAPTURE_MODE_KEY,
      inputModeKey: ROUTINE_INPUT_MODE_KEY,
    });
    return result.ok ? undefined : result.issues;
  }
```

  and `startTraining` sets `details.reason` to `"game not routine-eligible"` when every collected issue list equals that single string, else `"invalid step configuration"` (write a tiny `invalidReason(invalid)` helper).
- `resolveStep` copies `gameRulesetVersionKey: row.gameRulesetVersionKey`.
- `startGameStep`:

```ts
  const hook = routineGameStepHook(step.gameRulesetVersionKey ?? null);
  if (!hook || !step.gameTypeKey) {
    return { ok: false, code: "VALIDATION_FAILED", details: { reason: "game not routine-eligible" } };
  }
  const gameLookup = await findGameTypeAndRuleset(db, step.gameTypeKey, hook.rulesetVersionKey);
  const captureModeId = await findCaptureModeId(db, ROUTINE_CAPTURE_MODE_KEY);
  const inputModeId = await findInputModeId(db, ROUTINE_INPUT_MODE_KEY);
  …
      gameTypeKey: step.gameTypeKey,
      rulesetVersionKey: hook.rulesetVersionKey,
      captureModeKey: ROUTINE_CAPTURE_MODE_KEY,
      inputModeKey: ROUTINE_INPUT_MODE_KEY,
```

`routine.service.ts` `writeIssues`: replace the TUOD bound with

```ts
    if (template.exerciseTypeKey === "GAME") {
      const hook = routineGameStepHook(template.gameRulesetVersionKey);
      if (!hook) return { ok: false, code: "VALIDATION_FAILED", details: { reason: "game not routine-eligible", step: index + 1 } };
      if (step.durationValue < hook.minuteBounds.min || step.durationValue > hook.minuteBounds.max) {
        return { ok: false, code: "VALIDATION_FAILED", details: { reason: "game step minutes out of bounds", step: index + 1, ...hook.minuteBounds } };
      }
    }
```

and drop the `tuodDurationBounds` import. Repositories select `gameRulesetVersionKey` from both views; Zod DTOs gain the nullable field; `groupRoutineRows` copies it onto `RoutineStep` (service type gains `gameRulesetVersionKey: string | null`).

- [ ] **Step 5: Green, commit**

```bash
cd app && npm test && cd ..
git add app/src/services app/src/repositories app/src/pages/api app/tests/services app/tests/repositories app/tests/pages/api
git commit -m "feat(training): resolve, validate and start a GAME step from its pinned ruleset; routine-eligibility table"
```

---

### Task 3: Client adapter registry; generalise `gameStep`; play page switch

**Files:**
- Create: `app/src/lib/training/routines/adapters/interfaces.ts`, `types.ts`, `step-adapter.registry.ts`, `warm-up.adapter.ts`, `switching.adapter.ts`, `double-pattern.adapter.ts`, `game.adapter.ts`
- Rename: `finishing-step.data.ts` → `game-step.data.ts` (`finishingStep` → `gameStep(playFactory, onStepComplete, onAbandon)`)
- Modify: `routine-play.data.ts`, `lib/training/routines/types.ts`, `stores/training-session.store.ts`, `modules/training/routines/routine-summary.module.ts` + `types.ts`, `pages/training/routines/play/index.astro`
- Tests: `app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts`, `game-step.data.test.ts` (renamed from `finishing-step.data.test.ts`; `finishing-step-seam.test.ts` re-pointed at `gameStep(tuodPlay, …)`), `routine-play.data.test.ts` (unchanged assertions), `app/tests/stores/training-session.store.test.ts`, `app/tests/modules/training/routines/routine-summary.module.test.ts`

**Interfaces:**

```ts
// adapters/types.ts
export type StepAdapterKey = "WARM_UP" | "SWITCHING" | "DOUBLE_PATTERN" | `GAME:${string}`;
export type StepPanel = "warm-up" | "switching" | "double-pattern" | "tuod" | "score-training" | "one-twenty-one";
// adapters/interfaces.ts
export interface StepAdapter {
  key: StepAdapterKey;
  headerLabel: string;            // replaces STEP_LABELS
  panel: StepPanel;               // the play page's x-if switch
  open(ctx: RoutinePlayContext, result: StartTrainingStepResponseData, durationSeconds: number): void;
  facts(ctx: RoutinePlayContext): EngineFacts | null;      // null → nothing to upload (Warm-Up uploads its engine facts as today; GAME → null, the game uploads itself)
  completesOwnSession: boolean;   // GAME true (the game store completes its session), others false
  summarise(ctx: RoutinePlayContext): RoutineStepSummary | null;
  close(ctx: RoutinePlayContext): void;                    // clears engines/timers the adapter opened
}
// step-adapter.registry.ts
export function stepAdapterKey(step: { exerciseTypeKey: string; gameRulesetVersionKey: string | null }): StepAdapterKey;
export function resolveStepAdapter(key: StepAdapterKey): StepAdapter | undefined;
export const STEP_ADAPTERS: Record<StepAdapterKey, StepAdapter>;  // the four kinds + GAME:TUOD_V1, GAME:SCORE_TRAINING_V1, GAME:121_V2
```

`RoutinePlayContext` loses `warmUpEngine`/`switchingEngine`/`doublePatternEngine`/`finishing` as *fields the page switches on* but keeps them as adapter-owned slots (the engines still live on the context so the existing panels' bindings keep working); it gains `adapter: StepAdapter | null` and `game: ReturnType<typeof gameStep> | null` (renamed from `finishing`).

- [ ] **Step 1: Failing registry test**

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { STEP_ADAPTERS, resolveStepAdapter, stepAdapterKey } from "@lib/training/routines/adapters/step-adapter.registry";
import { ROUTINE_GAME_STEPS } from "@services/routines/game-step";

describe("step adapter registry", () => {
  it("has one adapter per non-game kind and per server-eligible game ruleset", () => {
    const keys = Object.keys(STEP_ADAPTERS).sort();
    expect(keys).toEqual(
      ["WARM_UP", "SWITCHING", "DOUBLE_PATTERN", ...Object.keys(ROUTINE_GAME_STEPS).map((k) => `GAME:${k}`)].sort(),
    );
  });

  it("derives the key from a resolved step", () => {
    expect(stepAdapterKey({ exerciseTypeKey: "SWITCHING", gameRulesetVersionKey: null })).toBe("SWITCHING");
    expect(stepAdapterKey({ exerciseTypeKey: "GAME", gameRulesetVersionKey: "TUOD_V1" })).toBe("GAME:TUOD_V1");
  });

  it("header labels are the Phase-1 strings for the four seeded kinds", () => {
    expect(resolveStepAdapter("WARM_UP")?.headerLabel).toBe("warm up");
    expect(resolveStepAdapter("SWITCHING")?.headerLabel).toBe("switching");
    expect(resolveStepAdapter("DOUBLE_PATTERN")?.headerLabel).toBe("doubles");
    expect(resolveStepAdapter("GAME:TUOD_V1")?.headerLabel).toBe("finishing");
    expect(resolveStepAdapter("GAME:SCORE_TRAINING_V1")?.headerLabel).toBe("scoring");
    expect(resolveStepAdapter("GAME:121_V2")?.headerLabel).toBe("121");
  });

  it("an unknown key resolves to nothing", () => {
    expect(resolveStepAdapter("GAME:501_V1")).toBeUndefined();
  });
});
```

Importing `@services/routines/game-step` from a client test is fine (pure module); the production client code must not import it — the client table is hand-mirrored and this test is what keeps them equal.

- [ ] **Step 2: Implement the adapters as moves of existing code**

`warm-up.adapter.ts` — `open` = today's `buildWarmUpEngine` + `warmUpReady = false` + `warmUpConfiguration = …`; `facts` = `ctx.warmUpEngine?.facts() ?? null`; `summarise` = `null`; `close` nulls `warmUpEngine`, stops `warmUpTimer`.
`switching.adapter.ts` — `open` = `buildSwitchingEngine` + `startStepTimer(durationSeconds)`; `facts` = engine facts; `summarise` = `summariseSwitching(state, facts)`; `close` nulls the engine.
`double-pattern.adapter.ts` — same shape with `summariseDoublePattern`.
`game.adapter.ts` exports a factory:

```ts
export function gameAdapter(input: {
  rulesetVersionKey: string;
  headerLabel: string;
  panel: StepPanel;
  playFactory: () => PlayFactoryContext;
  summarise: (ctx: RoutinePlayContext) => RoutineStepSummary | null;
}): StepAdapter
```

whose `open` is today's `startFinishingStep` with `toSnapshot(input.rulesetVersionKey, result.configuration)` and `ctx.game = gameStep(input.playFactory, () => ctx.completeCurrentStep(), async () => { if (ctx.activityId) await abandonTraining(ctx.activityId); })`; `facts` → `null`; `completesOwnSession: true`; `close` nulls `ctx.game`.

`step-adapter.registry.ts`:

```ts
export const STEP_ADAPTERS: Record<StepAdapterKey, StepAdapter> = {
  WARM_UP: warmUpAdapter,
  SWITCHING: switchingAdapter,
  DOUBLE_PATTERN: doublePatternAdapter,
  "GAME:TUOD_V1": gameAdapter({ rulesetVersionKey: "TUOD_V1", headerLabel: "finishing", panel: "tuod", playFactory: tuodPlay, summarise: summariseTuodStep }),
  "GAME:SCORE_TRAINING_V1": gameAdapter({ rulesetVersionKey: "SCORE_TRAINING_V1", headerLabel: "scoring", panel: "score-training", playFactory: scoreTrainingPlay, summarise: summariseScoreTrainingStep }),
  "GAME:121_V2": gameAdapter({ rulesetVersionKey: "121_V2", headerLabel: "121", panel: "one-twenty-one", playFactory: oneTwentyOnePlay, summarise: summariseOneTwentyOneStep }),
};
```

`game-step.data.ts`:

```ts
export function gameStep<T extends GameStepPlayContext>(
  playFactory: () => T,
  onStepComplete: () => Promise<void>,
  onAbandon: () => void | Promise<void>,
): T {
  const base = playFactory();
  const originalUpload = base.uploadAndCompleteSession;
  base.uploadAndCompleteSession = async function (this: T) {
    await originalUpload.call(this);
    if (this.completionStatus !== "succeeded") return;
    await onStepComplete();
  };
  base.abandonAndExit = async function (this: T) {
    this.timer?.stop();
    await playAbandonAndExit(this, onAbandon, "/training");
  };
  return base;
}
```

with `GameStepPlayContext = { completionStatus: string; timer?: { stop(): void } | null; uploadAndCompleteSession(): Promise<void>; abandonAndExit(): Promise<void> }` in `lib/training/routines/types.ts`. Confirm `scoreTrainingPlay()` and `oneTwentyOnePlay()` expose `timer`, `completionStatus`, `uploadAndCompleteSession`, `abandonAndExit`, and `resultsSnapshot` (they do per `play-lifecycle.ts`'s `PlayLifecycleContext`); if a name differs, adapt the type, not the game.

`routine-summary.module.ts`: keep `summariseSwitching`/`summariseDoublePattern`; rename `summariseFinishing` → `summariseTuod(seat)` (same rows); add `summariseScoreTraining(seat)` (rows: "Points", "Darts", "Average" from the Score Training results seat) and `summariseOneTwentyOne(seat)` (rows: "Target reached", "Checkout %"); `RoutineStepSummary.stepKey` widens to `StepAdapterKey`-compatible string. The three `summarise*Step(ctx)` wrappers in `game.adapter.ts` read `(ctx.game as { resultsSnapshot?: { seats: unknown[] } } | null)?.resultsSnapshot?.seats[0]`.

`training-session.store.ts`: `setStep(stepLabel: string)` stores the label; `STEP_LABELS` and `TrainingStepKey` go; `stepLabel` getter returns it (test re-pointed: `setStep("warm up")` → header contains `warm up`).

`routine-play.data.ts`:

- state: `adapter: null as StepAdapter | null`, `game: null` (was `finishing`); engine fields stay.
- `openStep(result, durationSeconds)`: `const adapter = resolveStepAdapter(stepAdapterKey(step))`; if none → `this.error = "This step kind is not supported on this device."` and return; `this.adapter = adapter; this.$store.trainingSession.setStep(adapter.headerLabel); adapter.open(this, result, durationSeconds)`.
- `uploadCurrentStepFacts`: `const facts = this.adapter?.facts(this)`; unchanged otherwise.
- `advanceAfterStepCompletion`: `if (!ctx.adapter?.completesOwnSession) await completeSession(...)`; `ctx.adapter?.close(ctx); ctx.adapter = null`.
- `captureStepSummary`: `const summary = this.adapter?.summarise(this); if (summary) this.stepSummaries.push(summary)`.
- `abandonAndExit`: `if (this.game) { … return this.game.abandonAndExit() }`.
- Delete `buildWarmUpEngine`, `buildSwitchingEngine`, `buildDoublePatternEngine`, `startFinishingStep` (moved into adapters).

Play page: each `<template x-if>` switches on `adapter?.panel === '<panel>'`; add two blocks for `score-training` and `one-twenty-one` mounting `x-data="game"` around the existing `ScoreTraining`/`OneTwentyOne` interface components the standalone play pages use (copy their confirm-gate wiring exactly as `games/score-training/play` and `games/121/play` do).

- [ ] **Step 3: Tests green (the routine-play suite's assertions unchanged), gates, commit**

```bash
cd app && npm test && npm run validate:app && cd ..
bash scripts/check-astro-conventions.sh && bash scripts/check-file-locations.sh && bash scripts/check-type-barrels.sh && bash scripts/check-game-engines.sh && bash scripts/check-game-wiring.sh
git add -A app/src/lib/training/routines app/src/stores/training-session.store.ts app/src/modules/training/routines app/src/pages/training/routines/play app/tests
git commit -m "feat(training): step adapter registry; gameStep generalised from finishingStep; play page switches on adapter.panel"
```

---

### Task 4: Content seed `0022` and the builder's picker

**Files:**
- Create: `database/seeds/0022_routine_game_templates.sql`
- Modify: `app/src/lib/training/routines/routine-builder.data.ts` (no code change expected — the picker is catalog-driven; verify GAME bounds are shown), `app/src/components/layout/training/routines/RoutineStepRow.astro` (show `3–30 min` hint for GAME steps via `step.exerciseTypeKey === 'GAME'`)
- Test: builder test — a GAME step clamps to its bounds in the UI hint only; the server bound is the rule

- [ ] **Step 1: Seed**

```sql
-- database/seeds/0022_routine_game_templates.sql
-- Two more GAME exercise templates for the routine picker (Phase 2 B).
-- default_configuration is valid under each ruleset; duration_value is a
-- default the step's minutes overwrite at start.
BEGIN;

INSERT INTO exercise_templates (id, exercise_type_id, exercise_ruleset_version_id, game_type_id, game_ruleset_version_id, name, description, default_configuration, is_system_template, created_at, updated_at)
VALUES
    ('0199b000-0000-7000-8000-000000000005',
     (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
     (SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'),
     (SELECT rv.id FROM ruleset_versions rv JOIN game_types gt ON gt.id = rv.game_type_id WHERE gt.implementation_key = 'SCORE_TRAINING' AND rv.implementation_key = 'SCORE_TRAINING_V1'),
     'Score Training (timed)', 'Score as many points as you can at treble 20 for the step''s minutes.',
     '{"duration_type":"MINUTES","duration_value":10,"max_darts_per_turn":3,"max_visit_score":180}'::jsonb,
     TRUE, now(), now()),
    ('0199b000-0000-7000-8000-000000000006',
     (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
     (SELECT id FROM game_types WHERE implementation_key = '121'),
     (SELECT rv.id FROM ruleset_versions rv JOIN game_types gt ON gt.id = rv.game_type_id WHERE gt.implementation_key = '121' AND rv.implementation_key = '121_V2'),
     '121 (timed)', 'Climb the 121 ladder for the step''s minutes.',
     '{"duration_type":"MINUTES","duration_value":10}'::jsonb,
     TRUE, now(), now())
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

Confirm the `121` game type key in `database/seeds/0009_121_game_engine_reference.sql` is `'121'` (it is at line 54) and that `121_V2`'s config schema accepts exactly `{duration_type, duration_value}` (`OneTwentyOneV2Config`, strict).

- [ ] **Step 2: Walk the flow** — `npm run dev`, build a routine Warm-Up 10 + Score Training (timed) 10 + 121 (timed) 10, start it, play each step to expiry, see the summary rows.

- [ ] **Step 3: Commit**

```bash
git add database/seeds/0022_routine_game_templates.sql app/src/components/layout/training/routines/RoutineStepRow.astro app/tests
git commit -m "feat(content): seed 0022 — Score Training (timed) and 121 (timed) routine templates"
```

---

### Task 5: Docs, decisions, gates

- `02-Template-Layer.md`: `game_ruleset_version_id` column, composite FK, pair CHECK; correct the sentence "a GAME template pins a game ruleset version on its session instead" → pinned on the template, copied onto the session.
- `05-Views/00-Overview.md`: both views (0039). `03-Migrations.md`: `## 0039…` section. Chain range → `0001`–`0039` in root `CLAUDE.md`, `00-Context-Map.md`, `10-Database-Agent-Guide.md`, `database/CLAUDE.md`.
- `09-Training/01-Routines.md` §11: the delegation boundary (spec §5.2) and the eligibility rule (§5.3); §17 "Game Exercise" gains an "Implemented" paragraph naming the three templates.
- `07-Frontend/04-Modules-And-OOP.md`: the adapter registry as a named shape under `lib/training/routines/adapters/`; `08-Component-Inventory.md` if a panel component was added.
- Decisions (derive ids with `scripts/next-decision-id.sh`): `decisions/database.md` — game ruleset pinned on the template, `NOT VALID` CHECK + follow-up VALIDATE; `decisions/game-engine.md` — step timer owns a game step's duration; eligibility = native timed mode + capability pair + both tables; `decisions/frontend/architecture.md` — adapter registry is the routine's client extension point, located under `lib/` because it wraps play factories.
- File Inventory rows; history entry; `context-maintenance`; `run-all-gates` (all sections). Discovered work → issues.

```bash
git add docs decisions CLAUDE.md database/CLAUDE.md
git commit -m "docs: routine step kinds generalised — template pin, adapter registry, delegation boundary, decisions"
```

---

## Self-review against the spec

- §3 → Task 1 (NOT VALID variant chosen, follow-up filed). §4.1–4.4 → Task 2. §5.1–5.3 → Task 3 (registry under `lib/`, deviation stated). §6.1 → Task 4; §6.2 touch list is documentation (Task 5, `01-Routines.md` §26 cross-reference); §6.3 is what Task 4 demonstrates. §7 tests → Tasks 1–3 (no new gate). §8 → Task 5.
- Names consistent: `ROUTINE_GAME_STEPS`, `routineGameStepHook`, `ROUTINE_CAPTURE_MODE_KEY`, `ROUTINE_INPUT_MODE_KEY`, `STEP_ADAPTERS`, `resolveStepAdapter`, `stepAdapterKey`, `gameStep`, `gameAdapter`, `summariseTuod`, `summariseScoreTraining`, `summariseOneTwentyOne`.
