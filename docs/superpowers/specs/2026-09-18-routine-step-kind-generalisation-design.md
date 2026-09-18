<!--
status: design
scope: Phase 2 of the configurable-training-routines roadmap — generalise the routine runtime so any eligible game or exercise type can be a step (pinned game ruleset version, per-kind step adapters), then expand the catalog
read-when: writing or executing the Phase 2 implementation plan; extends docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md §4 and §8
updated: 2026-09-18
-->

# Routine Step-Kind Generalisation and Catalog Expansion (Phase 2) — Design

> Drafted without an interactive brainstorm (autonomous session).
> **[decide]** marks judgement calls needing a human yes before planning.
> Depends on Phase 1 (`2026-09-18-custom-routine-builder-design.md`) having
> landed: the picker, the catalog view and start-by-id.

## 1. Problem

The roadmap's first draft called Phase 2 "pure content expansion". The
runtime disagrees at every layer:

| Layer | Hardcoded today | File |
| --- | --- | --- |
| Server, start step | game type `TUOD`, ruleset `TUOD_V1`, capture pair `ANALYTICS`/`VISUAL_BOARD` | `training-session.service.ts` `startGameStep` |
| Server, resolve | `TrainingStepResolved.exerciseTypeKey` is a closed enum of four keys | `pages/api/training-sessions/types.ts` |
| Schema | `exercise_templates` pins an *exercise* ruleset version but no *game* ruleset version; `v_routine_execution` has `game_type_key` and nothing to say which version | `0035`, `0036` |
| Client, play | one field and one `build*Engine()` per exercise kind; the GAME branch wraps `tuodPlay()` only | `routine-play.data.ts` (Phase 1 name), `finishing-step.data.ts` |
| Client, header | `STEP_LABELS` maps `GAME → "finishing"` | `stores/training-session.store.ts` |
| Client, summary | `summariseFinishing` reads TUOD state | `routine-summary.module.ts` |

A second game template — or a fifth exercise type — cannot be added by seed.
Phase 2 therefore has two increments in one plan: **A. generalise**, then
**B. add content** through the seams A creates.

## 2. Scope

**In (A):** pin a game ruleset version on `GAME` templates; resolve game
type, ruleset and capture pair from the step, not constants; validate a
`GAME` step against its own ruleset (finishes issue #392); a client
step-adapter registry; header label and summary from the adapter.

**In (B):** seed the first templates the seams admit (§6); document the
per-kind touch list so later content really is seed + adapter.

**Out:** per-step configuration UI (still `NULL` step config); games without
a native timed mode (§5.3); any change to `GameEngine` contracts
(`.claude/rules/game-engines.md` — engines stay unaware of routines, §10 of
`01-Routines.md`).

## 3. Database — migration `0039_exercise_template_game_ruleset.sql`

Mirrors `0035` exactly, on the game side:

```sql
ALTER TABLE ruleset_versions
    ADD CONSTRAINT uq_ruleset_versions_game_type_id UNIQUE (game_type_id, id);
ALTER TABLE exercise_templates
    ADD COLUMN game_ruleset_version_id UUID,
    ADD CONSTRAINT fk_exercise_templates_game_ruleset_version
        FOREIGN KEY (game_type_id, game_ruleset_version_id)
        REFERENCES ruleset_versions (game_type_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_exercise_templates_game_ruleset_pair CHECK (
        (game_type_id IS NULL) = (game_ruleset_version_id IS NULL)
    );
```

The composite FK makes "a template pinned to another game's ruleset"
unrepresentable, the same argument `02-Template-Layer.md` gives for the
exercise-side column. Column added nullable, back-filled by seed
`0021_exercise_template_game_rulesets.sql` (Finishing → `TUOD_V1`), then the
pair `CHECK` is added by a follow-up migration `0040` after the seed — the
`0028`/`0032` three-step shape, because the deploy runs all migrations
before seeds (issue #378). **[decide: accept two migrations, or write the
CHECK as `NOT VALID` + `VALIDATE` in one]**

`v_routine_execution` and `v_exercise_template_catalog` are recreated with
`grv.implementation_key AS game_ruleset_version_key` (LEFT JOIN, additive).

## 4. Server

### 4.1 Resolution

`RoutineStepTemplateRow` gains `gameRulesetVersionKey`. `resolveStep` copies
it into `TrainingStepResolved` (new nullable field; `exerciseTypeKey` stays
an enum — adding an exercise *type* is a registry change by design, §26 of
`01-Routines.md`, and the enum is that registry's server half).

### 4.2 Start a game step

`startGameStep` reads `step.gameTypeKey` / `step.gameRulesetVersionKey`,
looks up `RULESET_CAPABILITIES` for the pair the routine path requires
(`ANALYTICS` + `VISUAL_BOARD`), and refuses with `VALIDATION_FAILED`
`{ reason: "game not routine-eligible" }` when the ruleset does not declare
it — the same check `check-game-wiring.sh` enforces statically, applied at
the one dynamic seam. The three constants go.

### 4.3 Validate a game step

`stepConfigurationIssues` stops skipping `GAME`: it calls
`getRulesetValidator(step.gameRulesetVersionKey).validateConfig` with the
routine's capture pair. Closes #392 generically (Phase 1 closed it for
TUOD only).

### 4.4 Duration injection

Phase 1 injected TUOD's `duration_type`/`duration_value` from the step.
Generalise as a per-ruleset hook on the *server* adapter table
(`services/routines/step-duration.ts` **[decide: location]**): for each
routine-eligible ruleset, how the step's seconds enter its config
(`TUOD_V1 → duration_value minutes`, `SCORE_TRAINING minutes preset →
durationMinutes`, `121 timed → …`). Unknown ruleset → not eligible.

## 5. Client — step adapter registry

### 5.1 Shape

`modules/training/routines/step-adapter.registry.ts`:

```ts
type StepAdapterKey = "WARM_UP" | "SWITCHING" | "DOUBLE_PATTERN" | `GAME:${string}`;
interface StepAdapter {
  key: StepAdapterKey;
  headerLabel: string;                       // replaces STEP_LABELS
  panel: string;                             // component id the play page switches on
  open(ctx, step, durationSeconds): void;    // builds engine or wraps a play factory
  facts(ctx): EventsBatch | null;            // what to upload at step end
  summarise(ctx): RoutineStepSummary | null; // null for Warm-Up
  close(ctx): void;
}
```

Non-game adapters wrap what `routine-play.data.ts` already does per kind
(`buildWarmUpEngine`, `buildSwitchingEngine`, …) — a move, not a rewrite.
Game adapters generalise `finishing-step.data.ts` into
`gameStep(playFactory, onStepComplete, onAbandon)`; the TUOD adapter is the
existing code under a new key `GAME:TUOD`. `routine-play.data.ts` keeps one
`adapter` field instead of four engine fields, and the play page renders
panels through `x-if` on `adapter.panel`.

The adapter is *orchestration glue*, not an engine: it holds no rules and
no clock (`app/src/modules/training/CLAUDE.md`); the step timer stays in
the play data, as today.

### 5.2 Delegation boundary (the one §11 of `01-Routines.md` left to "the first game-backed exercise")

**The step timer is the exercise's duration; the game's own timed mode is
configured to it.** At expiry the adapter calls the game's
upload-and-complete exactly as a standalone timed game does when its own
timer ends. A game with no native timed mode would need the adapter to cut
a leg mid-flight and mark it `COMPLETED` — that changes what the game's
facts mean, so such games are not eligible in Phase 2 (§5.3).

### 5.3 Eligibility

A game is routine-eligible when its ruleset (a) declares
`ANALYTICS` + `VISUAL_BOARD` in `RULESET_CAPABILITIES`, (b) has a native
timed mode, and (c) has an entry in both adapter tables (server §4.4, client
§5.1). Today that is TUOD (`TUOD_V1`), Score Training (minutes preset,
`seeds/0004`) and 121 in its timed mode (`2026-08-28-121-rounds-timed-mode`)
**[decide: confirm the list against each ruleset's capability row]**.
501, Shanghai, Around the Clock, Bob's 27, Singles/Doubles Training are
excluded until they have a timed mode or a decided cut-off semantics.

## 6. Content increment (B)

### 6.1 Seeds

`0022_routine_game_templates.sql`: one `exercise_templates` row per eligible
game with `game_type_id`, `game_ruleset_version_id`, a
`default_configuration` valid under that ruleset, `is_system_template = TRUE`.
Names as the player sees them in the picker ("Score Training (timed)").

### 6.2 Touch list for a new *non-game* exercise (the §26 recipe, made concrete)

1. `exercise_types` + `exercise_ruleset_versions` seed rows.
2. Ruleset config type + validator (`services/exercise-rulesets/`), registered.
3. `ExerciseEngine` under `modules/training/exercises/`, registered in `engine.registry.ts` / `dart-engine.registry.ts`.
4. Panel component under `components/layout/training/exercises/`.
5. One client adapter (§5.1) and the `exerciseTypeKey` enum value.
6. `exercise_templates` seed row with `default_configuration`.
7. Tests per layer; verification SQL; docs (`01-Routines.md` §17 "Implemented" paragraph, component inventory).

Candidates already named in `01-Routines.md` §3.4: `CHECKOUT`, `ACCURACY`.
Neither is specified here — each is its own brainstorm with a rules file
under `docs/game-rules/training/routines/` first.

### 6.3 Touch list for a new *game* template (after A)

Seed row + server duration hook + client adapter (wrapping the game's
existing play factory). No schema, no service branch.

## 7. Tests

| File | Asserts |
| --- | --- |
| `tests/services/training-session.service.test.ts` | game type/ruleset from the row; ineligible pair → `VALIDATION_FAILED`; GAME config validated per ruleset; duration hook per ruleset |
| `tests/modules/training/routines/step-adapter.registry.test.ts` | every `exerciseTypeKey` and every seeded `GAME:<key>` resolves; header label and summary come from the adapter |
| `tests/lib/training/routines/routine-play.data.test.ts` | existing Balanced Training flow byte-for-byte through adapters (re-pointed, same guarantee) |
| `tests/lib/training/routines/game-step.data.test.ts` | generalised wrapper: completion gated on `completionStatus`, abandon routes to `/training` |
| `database/verification/0039_*.sql` | pair `CHECK`, composite FK, view column |
| `scripts/check-game-wiring.sh` | unchanged — the adapter tables are asserted by the registry test, not a new gate **[decide]** |

## 8. Documentation and decisions owed

- `02-Template-Layer.md`: the game-side pin (and correct the sentence "a
  GAME template pins a game ruleset version on its session instead" — it
  now pins it on the template, the session copies it).
- `01-Routines.md` §11 gains the decided delegation boundary (§5.2); §17
  "Game Exercise" gets an "Implemented" paragraph.
- `07-Frontend/04-Modules-And-OOP.md`: the adapter registry as a named
  shape; `08-Component-Inventory.md` for any new panel.
- Decisions: game ruleset pinned on the template (database); step timer
  owns a game step's duration and the eligibility rule (game-engine or
  frontend/alpine per routing table); adapter registry as the routine's
  extension point (frontend/architecture).

## 9. Plan seeds

1. `0039` + seed `0021` + `0040` pair `CHECK`; views; verification.
2. Server resolution, eligibility, validation, duration hook (TDD).
3. Client adapter registry; move existing kinds; generalise `gameStep`; play page switch.
4. Content seeds `0022`; adapters for the confirmed eligible games.
5. Docs, decisions, gates.
