# Switching Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erase the `SWITCHING_TARGET_SCORING` exercise type completely, then rebuild its rules as the Chain config of a merged `SWITCHING` exercise with two difficulty-bearing templates.

**Architecture:** Two phases that must not interleave. Phase A removes every trace of `SWITCHING_TARGET_SCORING` from the repository, both databases and the client cache, and ends with a verification gate. Phase B widens the tag grammar so an exercise can carry per-config difficulties, then rebuilds Chain as a second ruleset version under the existing `SWITCHING` type. The mode is carried by the ruleset version key, never by the step configuration, so Standard's `step_key` fingerprint — and therefore its stats trend — is byte-identical before and after.

**Tech Stack:** Astro, Alpine.js, TypeScript, Zod, PostgreSQL on Neon, dbmate migrations, idempotent SQL seeds, Vitest, bash gate scripts.

**Spec:** `docs/superpowers/specs/2026-10-19-switching-merge-design.md`

**Branch:** `feat/tag-cards`, in this worktree. Do not branch; this ships inside PR #1025.

## Global Constraints

- Config names, verbatim: **Standard** (Beginner) and **Chain** (Intermediate).
- Standard's `exercise_templates.default_configuration` and its ruleset version key `SWITCHING_V1` are **byte-identical** before and after. No field added, no key renamed, no whitespace change.
- Lookup tables use SMALLINT ids and the database never generates ids.
- No column DEFAULTs; seeds write `now()` explicitly.
- Views only, and views expose keys, not ids.
- Constraint names follow D310.
- Exported types live in `types.ts` behind `@lib/types` (type-barrel gate).
- No inline `//` comments inside function bodies.
- Every source file has a test (test-coverage gate).
- Prefer an `@utility` over a style-gate `ARBITRARY_ALLOW` row.
- Decisions are append-only.
- Seeds run twice per invocation: every seed must be idempotent.
- Never `--no-verify`. A hook failure is fixed at its cause.
- Discovered work that this plan did not ask for becomes a GitHub issue, not a fix.

## Review Focus

Five failure modes the spec implies but no task's happy path exercises. Each has a test pinned to the task that owns the code.

1. **A custom routine left with zero steps** after its only step is deleted — the routine builder and the play page must render it without throwing (Task 2).
2. **Step renumbering must not transiently violate `uq_routine_steps_sequence`** when closing a gap in a routine whose steps are renumbered in place (Task 2).
3. **A stale client stats cache must be discarded, not merged**, when the schema version is bumped — an entry keyed to the erased type must not rehydrate (Task 4).
4. **Replay of an existing Switching session must still render** after `DartExerciseKind` becomes a composite key; an unknown or legacy kind must degrade rather than throw (Task 7).
5. **The Chain seed must be idempotent across two runs in one invocation**, and must not insert a second ruleset version row on the second pass (Task 8).

---

# Phase A — Erasure

Phase A ends with the repository, both databases and the client cache carrying no trace of `SWITCHING_TARGET_SCORING`. No Phase B task may begin until Task 5's gate passes.

### Task 1: Erase the type from application code and tests

**Files:**
- Delete: `app/src/modules/training/exercises/switching-target-scoring.engine.module.ts`
- Delete: `app/src/services/exercise-rulesets/switching-target-scoring/` (whole directory)
- Delete: `app/src/lib/training/routines/adapters/switching-target-scoring.adapter.ts`
- Delete: `app/src/components/layout/training/exercises/SwitchingTargetScoringPanel.astro`
- Delete: `app/tests/modules/training/exercises/switching-target-scoring.engine.module.test.ts`
- Delete: `app/tests/modules/training/exercises/switching-target-scoring.aimed.golden.test.ts`
- Delete: `app/tests/modules/training/exercises/__snapshots__/switching-target-scoring.aimed.golden.test.ts.snap`
- Delete: `app/tests/services/exercise-rulesets/switching-target-scoring.validator.test.ts`
- Delete: `app/tests/lib/training/routines/adapters/switching-target-scoring.adapter.test.ts`
- Modify, removing every mention: `app/src/lib/training/exercises/rulesets/types.ts`, `app/src/lib/training/routines/types.ts`, `app/src/lib/training/routines/routine-play.data.ts`, `app/src/lib/training/routines/exercise-preview.ts`, `app/src/lib/training/routines/adapters/step-adapter.registry.ts`, `app/src/lib/training/routines/adapters/types.ts`, `app/src/lib/stats/replay-fold.ts`, `app/src/lib/stats/replay-presenters.ts`, `app/src/modules/stats/sections/step-result.module.ts`, `app/src/modules/stats/step-metrics.module.ts`, `app/src/modules/stats/types.ts`, `app/src/modules/game/types.ts`, `app/src/modules/game/track-policies.ts`, `app/src/modules/training/exercises/types.ts`, `app/src/modules/training/exercises/score-threshold.engine.module.ts`, `app/src/modules/training/routines/routine-summary.module.ts`, `app/src/pages/api/training-sessions/types.ts`, `app/src/pages/training/routines/play/index.astro`, `app/src/services/exercise-rulesets/registry.ts`, `app/src/services/training-session.service.ts`, `app/src/services/types.ts`, `app/src/modules/training/CLAUDE.md`
- Modify, removing every mention: `app/tests/integration/fixtures/stats-routine.ts`, `app/tests/lib/stats/replay-step-games.ts`, `app/tests/lib/training/exercises/rulesets/types.test.ts`, `app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts`, `app/tests/lib/training/routines/exercise-preview.test.ts`, `app/tests/lib/training/routines/routine-play.data.test.ts`, `app/tests/modules/stats/step-metrics.module.test.ts`, `app/tests/modules/training/routines/routine-summary-engines.module.test.ts`, `app/tests/modules/training/routines/routine-summary.module.test.ts`, `app/tests/pages/api/training-sessions/types.test.ts`, `app/tests/services/exercise-rulesets/registry.test.ts`, `app/tests/services/training-session.service.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a codebase where `SwitchingTargetScoringState`, `SwitchingTargetScoringConfigData`, `switchingTargetScoringAdapter`, `summariseSwitchingTargetScoring` and the `"SWITCHING_TARGET_SCORING"` union member no longer exist. Task 6 reintroduces none of these names.

Before editing, re-run the search yourself — the inventory above is a snapshot, not a contract:

```bash
rg -il 'switching.target.scoring|switchingtargetscoring' app/
```

- [ ] **Step 1: Delete the nine whole files and the validator directory**

- [ ] **Step 2: Remove every remaining mention from the files listed above**

Union members, registry entries, map entries, switch cases, imports, Alpine methods, doc-comment cross-references. The doc-comment mentions in `app/src/modules/game/types.ts:487` and `app/src/modules/game/track-policies.ts:331` cite the type as an example of `resetOnMiss`; replace the example with Target Scoring, which uses the same policy, rather than deleting the sentence.

- [ ] **Step 3: Verify no mention survives under `app/`**

Run: `rg -i 'switching.target.scoring|switchingtargetscoring' app/`
Expected: no output, exit 1.

- [ ] **Step 4: Run the type gate and the suite**

Run: `cd app && npm run check && npx vitest run`
Expected: `0 errors, 0 warnings, 0 hints`; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A app/
git commit -m "refactor(training): erase switching target scoring from app"
```

### Task 2: Erase the type from both databases

**Files:**
- Create: `database/migrations/0048_erase_switching_target_scoring.sql`
- Delete: `database/seeds/0024_switching_target_scoring_exercise_type.sql`
- Delete: `database/verification/0024_switching_target_scoring_seed_checks.sql`
- Modify: `database/seeds/0042_catalog_tags.sql` (regenerated, never hand-edited)
- Modify: `database/README.md:74,125` (seed index row and verification table row)
- Test: `app/tests/integration/switching-target-scoring-erased.itest.ts`, `app/tests/lib/training/routines/routine-builder.data.test.ts`

**Interfaces:**
- Consumes: Task 1's code erasure.
- Produces: databases with no `exercise_types` row whose `implementation_key` is `SWITCHING_TARGET_SCORING`, and none of its descendants.

The migration's `migrate:up` region deletes, in dependency order and all by predicate on `implementation_key` — never by hard-coded session id, since dev and prod hold different ids:

1. `darts` and `turns` belonging to steps of sessions of the type;
2. `exercise_sessions` / session-step rows of the type;
3. `routine_steps` rows referencing the type's template, in seeded and custom routines alike;
4. per affected routine, renumber the surviving steps to close the gap in `uq_routine_steps_sequence`;
5. `exercise_type_tags` rows for the type;
6. the `exercise_templates`, `exercise_ruleset_versions` and `exercise_types` rows.

Each delete raises its row count with `RAISE NOTICE`. The migration must be replayable on an empty database: every statement is a no-op when nothing matches. Confirm the actual table and column names against `app/db/schema.sql` before writing — do not trust this list's spelling.

Renumbering (step 4) must not transiently violate `uq_routine_steps_sequence`. Check whether that constraint is deferrable; if it is not, renumber via a single `UPDATE … SET sequence_number = ranked.rn FROM (SELECT …, row_number() OVER (PARTITION BY routine_template_id ORDER BY sequence_number) AS rn …) ranked`, which assigns all new values in one statement.

- [ ] **Step 1: Write the failing integration test**

`app/tests/integration/switching-target-scoring-erased.itest.ts`, asserting against the live `DATABASE_URL`:

```ts
it("has no switching target scoring exercise type", async () => {
  const rows = await db.execute(
    sql`SELECT 1 FROM exercise_types WHERE implementation_key = 'SWITCHING_TARGET_SCORING'`,
  );
  expect(rows.rows).toHaveLength(0);
});

it("leaves no routine step pointing at a missing template", async () => {
  const rows = await db.execute(
    sql`SELECT 1 FROM routine_steps rs
        LEFT JOIN exercise_templates et ON et.id = rs.exercise_template_id
        WHERE et.id IS NULL`,
  );
  expect(rows.rows).toHaveLength(0);
});

it("numbers every routine's steps consecutively from 1", async () => {
  const rows = await db.execute(
    sql`SELECT routine_template_id FROM routine_steps
        GROUP BY routine_template_id
        HAVING max(sequence_number) <> count(*) OR min(sequence_number) <> 1`,
  );
  expect(rows.rows).toHaveLength(0);
});
```

And, in `app/tests/lib/training/routines/routine-builder.data.test.ts`, for Review Focus 1 — a routine the migration emptied must still render:

```ts
it("renders a routine left with no steps", () => {
  const builder = routineBuilder();
  builder.steps = [];
  expect(() => builder.groups()).not.toThrow();
});
```

Assert only that it does not throw. Add a second assertion on the builder's
own total-duration accessor **only if** that method already exists under some
name; do not invent one.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && npm run test:integration -- switching-target-scoring-erased`
Expected: FAIL — the type is still present.

- [ ] **Step 3: Write `database/migrations/0048_erase_switching_target_scoring.sql`**

Both `migrate:up` and `migrate:down` regions. The down region is a comment explaining the erasure is deliberate and not reversible — the rows it would restore no longer have a seed to restore them from.

- [ ] **Step 4: Delete seed 0024 and its verification script, and remove their rows from `database/README.md`**

- [ ] **Step 5: Regenerate the catalog tag seed**

Run: `cd app && npm run tags:generate`
Expected: `database/seeds/0042_catalog_tags.sql` loses the eight `SWITCHING_TARGET_SCORING` rows.

- [ ] **Step 6: Apply and verify**

Run: `cd app && npm run db:migrate && npm run db:seed && npm run db:drift && npm run test:integration -- switching-target-scoring-erased`
Expected: migrate applies 0048; seed runs twice without error; drift OK; the three tests pass.

- [ ] **Step 7: Commit**

```bash
git add database/ app/tests/integration/switching-target-scoring-erased.itest.ts
git commit -m "feat(db): erase switching target scoring rows and seed"
```

### Task 3: Erase the type from the documentation

**Files:**
- Delete: `docs/game-rules/training/exercises/switching-target-scoring.md`, after copying its two `Dropped` rows verbatim into `/tmp` for Task 9
- Modify: `docs/architecture/00-File-Inventory.md:105,132,211,227,228,265,487,488,630`
- Modify: `docs/architecture/04-Architecture-patterns.md:10,830`
- Modify: `docs/architecture/05-Database/03-Migrations.md:157`
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md:176`
- Modify: `docs/architecture/09-Training/01-Routines.md:176,820,833,835` — removes §3.4's list entry and the whole "Switching Target Scoring" section
- Modify: `docs/architecture/10-Statistics/01-Section-Catalog.md:277`
- Modify: `scripts/engine-kernels.txt:26`
- Modify, removing the cross-reference only: the 15 files under `docs/game-rules/training/exercises/` and `docs/game-rules/training/routines/` that name seed `0024` or the type in a "seeded types" list — `170-practice.md:54`, `420.md:52`, `a1-routine.md:52`, `bull-up-practice.md:47`, `bullseye-500.md:49`, `bullseye-checkout.md:53`, `catch-40.md:55`, `doubles-snakes-and-ladders.md:52`, `frustration.md:52`, `hubbe.md:52`, `mikkos-megatrain.md:51`, `nine-dart-century.md:49`, `score-threshold.md:51,57`, `pre-match-warm-up.md:14`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: the two `Dropped` rows, held for Task 9.

Everything under `decisions/`, `docs/architecture/00-Context-Map-History.md` and `docs/superpowers/` is the historical record and **stays untouched**. A decision is append-only; a superseded one is superseded by a new entry, never edited.

- [ ] **Step 1: Copy the two `Dropped` rows out of `switching-target-scoring.md`**

The per-dart-position-targets row and the restart-every-visit row, both decided against 2026-09-23. Write them verbatim, as the two markdown table rows they already are, to `.superpowers/sdd/2026-10-19-switching-merge/dropped-rows.md`. Task 9 reads that path. Do not use `/tmp` — it is not shared between tasks.

- [ ] **Step 2: Delete `docs/game-rules/training/exercises/switching-target-scoring.md`**

- [ ] **Step 3: Remove the type from the seven live architecture documents and from `scripts/engine-kernels.txt`**

- [ ] **Step 4: Remove the cross-reference lines from the 15 rules documents**

Each is a parenthetical naming the seeded types a new type is "not among". Drop the reference, leave the sentence grammatical.

- [ ] **Step 5: Run the documentation gates**

Run: `bash scripts/check-game-rules.sh && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-engine-kernels.sh`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/ scripts/engine-kernels.txt
git commit -m "docs: erase switching target scoring from live docs"
```

### Task 4: Discard the client cache

**Files:**
- Modify: `app/src/lib/client/stats-cache/db.ts:2`
- Test: `app/tests/lib/client/stats-cache/db.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `STATS_SCHEMA_VERSION = 5`.

`STATS_SCHEMA_VERSION` is currently `4`. Bumping it wipes every IndexedDB store in `dart-stats`, which is the only persisted client state that can hold exercise-shaped data. The two other persisted keys — `starter-method` in localStorage (`app/src/lib/game/starter-step.data.ts:20`) and `wakeLockDebug` in sessionStorage (`app/src/lib/ui/game-layout.data.ts:12`) — hold no exercise data and are left alone. There is no service worker and no Cache API use in `app/src`; confirm that before relying on it.

- [ ] **Step 1: Write the failing test**

```ts
it("bumps the schema version so caches keyed to erased types are discarded", () => {
  expect(STATS_SCHEMA_VERSION).toBe(5);
});

it("wipes every store on upgrade rather than merging", async () => {
  // asserts the upgrade handler deletes and recreates each store in STORES
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && npx vitest run tests/lib/client/stats-cache/db.test.ts`
Expected: FAIL — received 4.

- [ ] **Step 3: Set `STATS_SCHEMA_VERSION = 5` in `app/src/lib/client/stats-cache/db.ts`**

- [ ] **Step 4: Run it to verify it passes**

Run: `cd app && npx vitest run tests/lib/client/stats-cache/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/client/stats-cache/db.ts app/tests/lib/client/stats-cache/db.test.ts
git commit -m "fix(stats): bump cache version to discard erased exercise keys"
```

### Task 5: Erasure gate

**Files:**
- Test: `app/tests/scripts/erasure.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: the gate that permits Phase B to start.

- [ ] **Step 1: Write the gate test**

Asserts that a repository-wide search finds the type only in the historical record — `decisions/`, `docs/superpowers/`, `graphify-out/`, `database/migrations/` and `docs/architecture/00-Context-Map-History.md`:

```ts
it("mentions the erased type only in the historical record", () => {
  const hits = ripgrep("switching.target.scoring|switchingtargetscoring");
  const live = hits.filter(
    (f) =>
      !f.startsWith("decisions/") &&
      !f.startsWith("docs/superpowers/") &&
      !f.startsWith("graphify-out/") &&
      !f.startsWith("database/migrations/") &&
      f !== "docs/architecture/00-Context-Map-History.md",
  );
  expect(live).toEqual([]);
});
```

`database/migrations/` is allowlisted because the chain is append-only history and the erasure migration must name what it erases.

- [ ] **Step 2: Run it**

Run: `cd app && npx vitest run tests/scripts/erasure.test.ts`
Expected: PASS. Any failure names a file Tasks 1–3 missed; fix it there, not here.

- [ ] **Step 3: Run the full validation**

Run: `cd app && npm run validate:app`
Expected: migrate/drift/introspect clean, fallow OK, all tests pass, `astro check` 0/0/0.

- [ ] **Step 4: Commit**

```bash
git add app/tests/scripts/erasure.test.ts
git commit -m "test: gate that switching target scoring stays erased"
```

---

# Phase B — The merge

### Task 6: Widen the tag grammar for per-config difficulties

**Files:**
- Modify: `docs/game-rules/TAGS.md` — the Routine step rule
- Modify: `app/scripts/tags/parse-tags.ts` — `checkAxisRule` and the label rules
- Modify: `scripts/check-game-rules.sh` — the mirrored awk gate
- Modify: `app/scripts/generate-tag-seed.ts` — the multi-labelled Difficulty filter
- Modify: `app/tests/integration/template-difficulty-parity.itest.ts`
- Create: a decision entry in `decisions/context-system.md`
- Test: `app/tests/scripts/tags/parse-tags.test.ts`, `scripts/test-check-game-rules.sh`

**Interfaces:**
- Consumes: nothing.
- Produces: an exercise's flat `## Tags` table may carry several labelled Difficulty values, e.g. `BEGINNER (Standard), INTERMEDIATE (Chain)`. The parser exposes them exactly as it already does for a game's `### Routine step` block.

Today `parse-tags.ts` permits multi-value Difficulty and `(label)` suffixes only when `kind === "game" && block.context === "ROUTINE_STEP"`. An exercise's flat table is assigned context `ROUTINE_STEP` already, so the change is to stop requiring `kind === "game"` — widen the condition, do not add a parallel branch. `scripts/check-game-rules.sh` holds the same rule in awk and must be widened identically; the two are mirrored by hand and their error strings must stay one-for-one.

`generate-tag-seed.ts` today drops the DIFFICULTY axis entirely from a multi-labelled block, which is why Around the Clock's routine-step rows carry no difficulty tag. That behaviour is correct and **stays**: difficulty reaches the database through `exercise_templates.difficulty_tag_id`, not through `exercise_type_tags`.

The parity test asserts per type that the document's Difficulty set equals the set of `difficulty_level`s across that type's system templates. It currently reaches only game types; widen it to exercise types on the same rule.

- [ ] **Step 1: Write the failing parser tests**

```ts
it("accepts labelled difficulties in an exercise's flat table", () => {
  const block = parseTagsBlock(exerciseFixtureWithTwoDifficulties);
  expect(block.difficultyLabels).toEqual(["Standard", "Chain"]);
});

it("still rejects an unlabelled second difficulty in an exercise", () => {
  expect(() => parseTagsBlock(exerciseFixtureTwoUnlabelled)).toThrow(
    /Difficulty takes exactly one value/,
  );
});

it("still rejects subsections in an exercise", () => {
  expect(() => parseTagsBlock(exerciseFixtureWithSubsections)).toThrow(
    /an exercise has one flat table, no subsections/,
  );
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd app && npx vitest run tests/scripts/tags/parse-tags.test.ts`
Expected: FAIL on the first test.

- [ ] **Step 3: Widen the condition in `app/scripts/tags/parse-tags.ts`**

- [ ] **Step 4: Mirror the change in `scripts/check-game-rules.sh` and extend `scripts/test-check-game-rules.sh` with the same three cases**

- [ ] **Step 5: Widen `app/tests/integration/template-difficulty-parity.itest.ts` to exercise types**

- [ ] **Step 6: Run the tag gates**

Run: `cd app && npx vitest run tests/scripts/tags/ && cd .. && bash scripts/test-check-game-rules.sh && bash scripts/check-tag-seeds.sh`
Expected: all PASS, and the generated seed is unchanged — no document uses the new grammar yet.

- [ ] **Step 7: Append the decision to `decisions/context-system.md`**

One entry: an exercise may carry labelled per-config difficulties, as a game's routine-step block does; the consequence is that an exercise's Difficulty values no longer reach `exercise_type_tags`, and `difficulty_tag_id` becomes the only source of an exercise template's level.

- [ ] **Step 8: Commit**

```bash
git add docs/game-rules/TAGS.md app/scripts/tags/ app/scripts/generate-tag-seed.ts scripts/check-game-rules.sh scripts/test-check-game-rules.sh app/tests/ decisions/context-system.md
git commit -m "feat(tags): labelled per-config difficulties for exercises"
```

### Task 7: Rebuild Chain as a second Switching ruleset

**Files:**
- Create: `app/src/modules/training/exercises/switching-chain.engine.module.ts`
- Create: `app/src/services/exercise-rulesets/switching-chain/switching-chain.validator.ts`
- Create: `app/src/lib/training/routines/adapters/switching-chain.adapter.ts`
- Create: `app/src/components/layout/training/exercises/SwitchingChainPanel.astro`
- Modify: `app/src/lib/training/exercises/rulesets/types.ts`, `app/src/modules/training/exercises/types.ts`, `app/src/modules/training/routines/routine-summary.module.ts`, `app/src/modules/stats/step-metrics.module.ts`, `app/src/modules/stats/types.ts`, `app/src/lib/training/routines/adapters/{types.ts,step-adapter.registry.ts}`, `app/src/lib/training/routines/{types.ts,routine-play.data.ts,exercise-preview.ts}`, `app/src/lib/stats/{replay-fold.ts,replay-presenters.ts}`, `app/src/modules/stats/sections/step-result.module.ts`, `app/src/pages/api/training-sessions/types.ts`, `app/src/pages/training/routines/play/index.astro`, `app/src/services/{types.ts,training-session.service.ts}`, `app/src/services/exercise-rulesets/registry.ts`
- Test: one test file per created file, plus the modified files' existing tests

**Interfaces:**
- Consumes: Task 5's clean tree.
- Produces: ruleset version key `SWITCHING_CHAIN_V1`; config `SwitchingChainV1Config` / `SwitchingChainConfigData`; state `SwitchingChainState`; adapter key `SWITCHING_CHAIN`; panel name `switching-chain`; `DartExerciseKind` members `SWITCHING:STANDARD` and `SWITCHING:CHAIN`.

**Chain's rules, to rebuild verbatim.** This is the erased type's behaviour, restated so the implementer never needs the deleted file:

- Config: `{ targets: BoardTarget[] }`, exactly 3 entries, distinct, each an integer 1–20 or 25 (bull). No scoring key. `.strict()`.
- Track-kernel engine via `trackExerciseSpec` + `dartExerciseEngineClass`, as the erased module did.
- Target path: `pathTarget(numbersPath(config.targets))`; 25 becomes `{kind:"BULL"}`, everything else `{kind:"NUMBER"}`.
- Points, delegating to `targetScoringPoints`: off the target number is a miss; on a number, single rings score 1, `TREBLE` scores 3, `DOUBLE` is a **miss**; on the bull, `OUTER_BULL` scores 1 and `INNER_BULL` scores 3.
- `onDart: resetOnMiss(3)`; `visitOpen: closeAfter(3)`. No `onVisitClose`, no `startScore`.
- Hit: advance the target index with wraparound, add the dart's points to the chain, increment hits, and increment completed sequences only when the index wraps to 0.
- Miss: set the target index to 0, zero the chain, and raise `finishedBest` to the chain's pre-miss value only when that value was above zero.
- Intended zone per dart: `INNER_BULL` when the target is 25, otherwise `TREBLE`.
- Projected state: `currentTargetNumber`, `targetIndex`, `currentChain`, `bestChain` (`max(finishedBest ?? 0, chain)` — the live chain counts), `markToBeat` (`finishedBest`, nullable), `completedSequences`, `hits`, `dartsThrown`, `status`.
- Completion only on timer expiry; `record()` throws once complete; `undo()` reverses expiry before popping a dart.
- Summary rows, in order: **Best chain**, **Sequences**, **Darts**, **Hit rate**.
- Stats spec: metrics `{bestChain:"max", sequences:"sum", darts:"sum", hits:"sum"}`, headline `bestChain`, direction `higher`, rate `hits/darts`.
- Panel: score `CHAIN`, a 3-target chip route, tiles **Target**, **To beat** (only when `markToBeat` is non-null) and **Best**.

`DartExerciseKind` becomes a composite. `SWITCHING` alone is no longer a key; the two keys are `SWITCHING:STANDARD` and `SWITCHING:CHAIN`, resolved from the session's ruleset version key. Three call sites resolve a spec from a bare type-key string and must be threaded with the ruleset version: `app/src/lib/stats/section-registry.ts:461`, `app/src/lib/stats/replay-presenters.ts:542`, `app/src/lib/client/stats-cache/cache.ts:379`.

- [ ] **Step 1: Write the failing engine tests**

Port the deleted engine's assertions from its design spec, `docs/superpowers/specs/2026-09-23-switching-target-scoring-exercise-design.md`, under the new names. At minimum: a treble on target scores 3 and advances; a double on target is a miss and restarts at index 0; a miss on an empty chain leaves `markToBeat` null; a wrap to index 0 increments `completedSequences`; the chain and sequence carry across a visit boundary; the bull scores 1 outer and 3 inner.

- [ ] **Step 2: Write the failing replay test for Review Focus 4**

```ts
it("renders a legacy Switching session after the kind key becomes composite", () => {
  const presenter = buildStepPresenter({ exerciseTypeKey: "SWITCHING", rulesetVersionKey: "SWITCHING_V1" });
  expect(presenter.headline).toBe("Points");
});

it("degrades rather than throwing on an unknown kind", () => {
  expect(() => buildStepPresenter({ exerciseTypeKey: "NOPE", rulesetVersionKey: "NOPE_V1" })).not.toThrow();
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `cd app && npx vitest run tests/modules/training/exercises/switching-chain tests/lib/stats/replay-presenters`
Expected: FAIL — module not found.

- [ ] **Step 4: Create the engine, validator, adapter and panel, and wire them through the unions, registries and the play page**

- [ ] **Step 5: Run the tests and the type gate**

Run: `cd app && npx vitest run && npm run check`
Expected: all pass; `0 errors, 0 warnings, 0 hints`.

- [ ] **Step 6: Run the maintainability gate**

Run: `bash scripts/fallow-gate.sh`
Expected: OK. Read the block the wrapper prints after fallow's own output; never chase the "start with" filename.

- [ ] **Step 7: Commit**

```bash
git add app/
git commit -m "feat(training): switching chain ruleset, engine and panel"
```

### Task 8: Seed Chain and pin both difficulties

**Files:**
- Create: `database/seeds/0044_switching_chain.sql`
- Create: `database/verification/0044_switching_chain_checks.sql`
- Modify: `database/README.md` (seed index row and verification table row)
- Test: `app/tests/integration/switching-chain-seed.itest.ts`

**Interfaces:**
- Consumes: Task 7's ruleset version key `SWITCHING_CHAIN_V1`.
- Produces: under exercise type `SWITCHING` (`0199a000-0000-7000-8000-000000000003`), a second `exercise_ruleset_versions` row and a `Chain` `exercise_templates` row; `difficulty_tag_id` pinned on both Switching templates.

The seed inserts, all `ON CONFLICT (id) DO NOTHING` and all writing `now()` explicitly:

- an `exercise_ruleset_versions` row: new id, `exercise_type_id` = the Switching type, `implementation_key` `SWITCHING_CHAIN_V1`, `version_number` 2. **Check first** whether `(exercise_type_id, version_number)` carries a unique constraint, and pick the number accordingly.
- an `exercise_templates` row: new id, the Switching type, the new ruleset version resolved by `implementation_key`, `game_type_id NULL`, name `Chain`, `default_configuration` `'{"targets":[20,19,18]}'::jsonb`, `is_system_template TRUE`.
- an `UPDATE` pinning `difficulty_tag_id`: the existing Switching template (`0199b000-0000-7000-8000-000000000002`) to `BEGINNER`, the new Chain template to `INTERMEDIATE`, both resolved by tag key, following the shape of `database/seeds/0043_exercise_template_difficulty.sql`.

The existing Switching template is **not** touched beyond `difficulty_tag_id`. Its name, description, `default_configuration` and `exercise_ruleset_version_id` stay exactly as they are — that is what keeps its `step_key` stable.

- [ ] **Step 1: Write the failing integration test**

```ts
it("gives the Switching type two system templates", async () => {
  const rows = await catalogRowsForType("SWITCHING");
  expect(rows.map((r) => r.templateName).sort()).toEqual(["Chain", "Switching"]);
});

it("pins Beginner on Standard and Intermediate on Chain", async () => {
  const rows = await catalogRowsForType("SWITCHING");
  expect(levelOf(rows, "Switching")).toBe(1);
  expect(levelOf(rows, "Chain")).toBe(2);
});

it("leaves the Standard template's configuration byte-identical", async () => {
  const row = await templateById("0199b000-0000-7000-8000-000000000002");
  expect(row.defaultConfiguration).toEqual({
    targets: [20, 19, 18],
    scoring: { single: 1, double: 2, treble: 3 },
  });
  expect(row.rulesetVersionKey).toBe("SWITCHING_V1");
});

it("inserts nothing on a second seed run", async () => {
  const before = await countRulesetVersions("SWITCHING");
  await runSeed("0044_switching_chain.sql");
  expect(await countRulesetVersions("SWITCHING")).toBe(before);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && npm run test:integration -- switching-chain-seed`
Expected: FAIL — one template only.

- [ ] **Step 3: Write the seed and its verification script, and add both rows to `database/README.md`**

- [ ] **Step 4: Apply and verify**

Run: `cd app && npm run db:seed && npm run db:drift && npm run test:integration -- switching-chain-seed`
Expected: seed runs twice without error; drift OK; all four tests pass.

- [ ] **Step 5: Commit**

```bash
git add database/ app/tests/integration/switching-chain-seed.itest.ts
git commit -m "feat(db): seed switching chain template and difficulties"
```

### Task 9: Write `switching.md`

**Files:**
- Create: `docs/game-rules/training/exercises/switching.md`
- Modify: `database/seeds/0042_catalog_tags.sql` (regenerated)
- Modify: `scripts/engine-kernels.txt` — the `switching.engine.module.ts` row's rules-file column

**Interfaces:**
- Consumes: Task 6's grammar, Task 8's seeded difficulties, Task 3's two held `Dropped` rows.
- Produces: Switching's first catalog tags.

Copy `docs/game-rules/templates/EXERCISE_TEMPLATE.md` from line 42. Header block:

```
Current version: V1 (shipped 2026-10-19)
Entry points: routine step
Kernel: TRACK
```

`Kernel: TRACK` matches both engines' rows in `scripts/engine-kernels.txt`. State plainly in `## Exercise type` that the Standard engine's fold is still hand-written and its Track migration still `PENDING`, and that this change does not perform it.

The `## Exercise type` section must contain a line beginning ``- Type constant: `SWITCHING` `` — the tag parser uses it to tell an exercise from a game, and without it the file is parsed as a game and the generator demands a `Family` axis.

Tags table — six axes, in `TAGS.md` order, no `Family`:

```
| Axis | Tags |
| --- | --- |
| Skill | SWITCHING (primary), ACCURACY |
| Session role | CORE |
| Format | SOLO |
| Difficulty | BEGINNER (Standard), INTERMEDIATE (Chain) |
| Mechanic | SEQUENTIAL, ACCUMULATION |
| Pressure | RESET |
```

`Pressure | RESET` is a known imprecision: it describes Chain and overstates Standard, and the axis cannot hold both `NONE` and `RESET`. Say so in the document.

`## Features` carries both configs' rows, each `V1`, `Applies to` `Single`, with the config named in the feature text. The two `Dropped` rows held from Task 3 are appended verbatim, their reasons intact.

- [ ] **Step 1: Write `switching.md`**

Both configs' rules as given in the spec's "The merged exercise" section: Standard's cycling target list and configurable zone scoring, Chain's three-target chain with a double as a miss.

- [ ] **Step 2: Point `scripts/engine-kernels.txt` at the new rules file for `switching.engine.module.ts`**

- [ ] **Step 3: Run the rules gate**

Run: `bash scripts/check-game-rules.sh docs/game-rules/training/exercises/switching.md && bash scripts/check-engine-kernels.sh`
Expected: PASS. The gate walks `git ls-files`, so `git add` the new file first or pass its path.

- [ ] **Step 4: Regenerate the tag seed and verify parity**

Run: `cd app && npm run tags:generate && npm run test:integration -- template-difficulty-parity`
Expected: `0042` gains Switching's tag rows; the parity test passes with `{BEGINNER, INTERMEDIATE}` on both sides.

- [ ] **Step 5: Commit**

```bash
git add docs/game-rules/training/exercises/switching.md database/seeds/0042_catalog_tags.sql scripts/engine-kernels.txt
git commit -m "docs(game-rules): switching, standard and chain configs"
```

### Task 10: Write the three remaining #799 documents

**Files:**
- Create: `docs/game-rules/training/exercises/double-pattern.md`
- Create: `docs/game-rules/training/exercises/game.md`
- Create: `docs/game-rules/training/routines/balanced-training.md`
- Modify: `database/seeds/0042_catalog_tags.sql` (regenerated)
- Modify: `scripts/engine-kernels.txt` — the `double-pattern.engine.module.ts` row's rules-file column

**Interfaces:**
- Consumes: Task 9's conventions.
- Produces: #799 fully answered.

All three describe software that **already exists**. Describe it; invent nothing.

**`double-pattern.md`** — type constant `DOUBLE_PATTERN`, `Entry points: routine step`, `Kernel: TRACK`, `Current version: V1 (shipped 2026-09-11)`. Rules as built: config is 1–12 patterns of 1–3 numbers each, every number 1–20 (no bull); the patterns flatten into one repeating cycle; the intended target is always the **double** of the current number; a hit scores 1 and nothing else scores; every dart advances one position whether it hits or misses; the cycle wraps; the run is time-bound. Summary rows: **Doubles hit**, **Darts**, **Hit rate**. Default configuration: `[[20,10,5],[16,8,4],[12,6,3]]`. Note that its Track migration is also still `PENDING`.

**`game.md`** — type constant `GAME`. This is the wrapper that runs a whole game as a routine step, and several template fields do not apply to it. Say which and why, in the document:

- its kernel is the wrapped game's, so the `Kernel:` header is the wrapper's own, not a claim about any game;
- its tags are never generated — `app/scripts/generate-tag-seed.ts` skips the `GAME` key by design — so the table satisfies the gate and nothing else.

Content: the exercise owns the lifecycle, the game owns the mechanics; the step's duration **is** the game's native timed-mode clock, never a second timer racing it, so the game's own end is the step's end (migration `0040`, 2026-09-20); a game is eligible only if it has a native timed mode, declares both `ANALYTICS` and `VISUAL_BOARD`, and appears in **both** the server table `ROUTINE_GAME_STEPS` (`app/src/services/routines/game-step.ts`) and the client's `STEP_ADAPTERS`, which are hand-mirrored and kept in agreement only by `step-adapter.registry.test.ts`. Currently eligible: `TUOD_V1`, `SCORE_TRAINING_V1`, `121_V2`, `AROUND_THE_CLOCK_V2` (D360). `121_V1` is not — it is TARGET-only, with no timed mode.

**`balanced-training.md`** — a routine, so: one header line (`Current version:`), **no** `Entry points:`, **no** `Kernel:`, **no** `## Tags`, **no** `## Capture`. Follow `docs/game-rules/templates/ROUTINE_TEMPLATE.md` and the worked example at `docs/game-rules/training/routines/pre-match-warm-up.md`. The seeded steps, in order: Warm-Up 10 min, Switching 5 min, Double Pattern 5 min, Finishing (TUOD, a GAME step) 10 min — 30 minutes total. It is a system routine, exempt from the 30-minute floor for player-authored routines (D305). Name each step by its exercise type and link its rules file; never restate a step's rules.

- [ ] **Step 1: Write the three documents**

- [ ] **Step 2: Point `scripts/engine-kernels.txt` at `double-pattern.md`**

- [ ] **Step 3: Run the rules gate on all three**

Run: `git add docs/game-rules && bash scripts/check-game-rules.sh && bash scripts/check-engine-kernels.sh`
Expected: PASS.

- [ ] **Step 4: Regenerate the tag seed**

Run: `cd app && npm run tags:generate && bash ../scripts/check-tag-seeds.sh`
Expected: `0042` gains Double Pattern's rows; GAME contributes none; the routine contributes none.

- [ ] **Step 5: Commit**

```bash
git add docs/game-rules/ database/seeds/0042_catalog_tags.sql scripts/engine-kernels.txt
git commit -m "docs(game-rules): double pattern, game wrapper, balanced training"
```

### Task 11: Context maintenance and close-out

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md`, `docs/architecture/07-Frontend/08-Component-Inventory.md`, `docs/architecture/09-Training/01-Routines.md`, `docs/architecture/10-Statistics/01-Section-Catalog.md`, `docs/architecture/04-Architecture-patterns.md`
- Modify: `CLAUDE.md` — the migration chain range, if 0048 lands
- Modify: `decisions/game-engine.md` — a new entry

**Interfaces:**
- Consumes: Tasks 1–10.
- Produces: a green branch and a closed #799.

- [ ] **Step 1: Register every created file in the inventories and the context map**

The new engine, validator, adapter, panel, seeds, verification script and four rules documents. `docs/game-rules/` itself needs no inventory row; everything else does.

- [ ] **Step 2: Append the decision to `decisions/game-engine.md`**

One entry recording the merge: `SWITCHING_TARGET_SCORING` is erased rather than superseded, because there was exactly one active player; Chain is rebuilt as a second ruleset version under `SWITCHING`; the mode is carried by the ruleset version key so Standard's `step_key` is unchanged; `Supersedes:` D357.

- [ ] **Step 3: Run every gate**

Invoke the `run-all-gates` skill. Each script's result is reported explicitly; a failure stops the close-out exactly as a test failure does.

- [ ] **Step 4: Run the full validation**

Run: `cd app && npm run validate:app`
Expected: 0 errors, 0 warnings, 0 hints; fallow OK; all tests pass.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "docs: register switching merge in the context system"
git push
```

- [ ] **Step 6: Comment on #799**

Name the four documents this branch added and ask for the issue to be closed on merge. Do not close it from here — PR #1025 has not landed.
