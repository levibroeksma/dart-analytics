<!--
status: design
scope: technical-debt sweep — all 7 open `type:technical-debt` issues
read-when: writing or executing any of the 5 plans this spec hands off (P1–P5)
updated: 2026-09-17
-->

# Technical-Debt Sweep — Design

> Documentation only. Covers every open `type:technical-debt` issue as of 2026-09-17: #297, #348, #281, #282, #295, #286, #386. Approved by the user; hand to `writing-plans` as **five separate plans**, one per section 3–7.

---

## 1. Purpose

Seven debt issues are open. Three of them (#295, #286, #282) were filed with "no action now" as their own proposed fix — deferred until an unrelated task touched the same code. That trigger never fired, so they have sat for weeks. The user's decision is to clear all seven in one deliberate sweep rather than keep waiting for a coincidence.

The sweep is grouped by blast radius, not by issue number: issues that touch the same files land in the same plan, on the same branch.

| Plan | Issues | Area | Risk |
| ---- | ------ | ---- | ---- |
| P1 | #297, #348 | frontend folder taxonomy + dead alias | low (moves + deletions, no behaviour) |
| P2 | #281, #282 | `app/src/lib/game/` types + play-data twin | **high** (only plan that changes runtime code paths) |
| P3 | #295 | migration `0035`, constraint rename | low (rename only, reversible) |
| P4 | #286 | `LEVEL_SKILL_TABLE` bias values | medium (simulation-verified) |
| P5 | #386 | decision-id derivation ergonomics | low (tooling + doc) |

**Out of scope for every plan:** any behaviour change a user could observe. This is a debt sweep; each plan's acceptance criterion is that the app does exactly what it did before.

---

## 2. Sequencing

P3, P4 and P5 are independent of everything else and of each other.

P1 must land before P2 starts. Not because P1 changes duplication — moving a file does not — but because both plans rewrite import paths across `app/src` and `app/tests` at once, and a rebase of P2's extraction onto P1's moves is a conflict nobody should have to resolve by hand. P2 also measures its `npx fallow` baseline against a settled tree.

No branch stacks on another (Hard Invariant: at most one open branch may target another, enforced by `branch-stack-cap`). Every plan cuts its branch from `main` and lands its own PR.

Each plan derives its decision ids at PR time, not at authoring time — see P5 for why. This sweep makes that acute: five branches in flight will consume roughly eight ids (`D294` is the next free id as of 2026-09-17), and whichever lands second collides if both derived at authoring time. The merge-ref gate catches it; P5's renumber helper is what makes the fix cheap.

---

## 3. P1 — Training taxonomy + dead `@forms` layer (#297, #348)

### 3.1 Problem

Two unrelated-looking issues that land on the same files (`07-Frontend/02-Folder-Structure.md`, `app/CLAUDE.md`, the alias configs), so they share a plan.

**#297:** the "trivia" UI category was retired by D265 — Quick Subtract is a flat card under `/training`, a sibling of Balanced Training. Only the page routes moved. `app/src/lib/trivia/`, `app/src/modules/trivia/` and `app/src/components/layout/trivia/` still carry the retired label, so the source tree names an IA that no longer exists.

**#348:** `@forms` maps to `app/src/forms/`, which does not exist. No `*.form.ts` file exists anywhere. Nothing imports `@forms`. Yet `app/CLAUDE.md:118` lists `.form.ts` among the non-negotiable suffix conventions, and `02-Folder-Structure.md` documents the tree entry, the suffix row, the import-direction rules and the `$persist` permission for a layer with zero instances.

### 3.2 Target taxonomy

`training/` becomes an umbrella with three sub-domains. Trivia is preserved as a domain — it does not become "an exercise" — it just lives next to the routine exercises, because `/training` bundles both.

```
app/src/lib/training/
  trivia/        <- app/src/lib/trivia/
  exercises/     <- app/src/lib/exercise/
  routines/      <- today's flat app/src/lib/training/*.ts

app/src/modules/training/
  trivia/        <- app/src/modules/trivia/
  exercises/     <- app/src/modules/exercise/
  routines/      <- today's flat app/src/modules/training/*.ts

app/src/components/layout/training/
  trivia/        <- app/src/components/layout/trivia/
  exercises/     <- ExerciseBoardInputPanel, SwitchingPanel, DoublePatternPanel, WarmUpPanel, BlockedStepModal
  routines/      <- RoutineDetail, RoutineSummaryModal
```

`app/tests/` mirrors `app/src/` path-for-path, so the test tree moves in lockstep:

```
app/tests/lib/training/{trivia,exercises,routines}/
app/tests/modules/training/{trivia,exercises,routines}/
```

This is not cosmetic. `check-test-coverage.sh` resolves "which test covers this source file" by the mirrored path first and by import second; a source file moved without its test either loses its mirror or fails the gate outright. Verified for this move: every runtime `.ts` under the four moving domains has a covering test today, and the only files without one are `types.ts`/`interfaces.ts`, which the gate exempts as type-only.

Two trees are deliberately **not** touched:

- `app/src/components/layout/games/` — games are not training; the umbrella covers the `/training` surface only.
- `app/src/services/exercise-rulesets/` — `services/` is the Worker layer, and "exercise" is not a retired name. Only "trivia" is (D265). The resulting `lib/training/exercises/` ↔ `services/exercise-rulesets/` asymmetry is accepted: the two live on opposite sides of the runtime boundary and were never meant to mirror.

Docs mirror the same shape:

```
docs/architecture/09-Training/
  00-Overview.md      (new — routes the two below, carries the shared model)
  01-Routines.md      <- docs/architecture/09-training-routines.md
  02-Trivia.md        <- docs/architecture/10-trivia.md

docs/game-rules/training/
  trivia/             <- docs/game-rules/trivia/
  routines/           <- docs/game-rules/routines/
```

`docs/game-rules/rulesets/` stays put — those are games, same reasoning as `components/layout/games/`.

### 3.3 Work

Moves are `git mv` only. No file content changes beyond import paths and doc prose. If a plan step finds itself rewriting a function body, it has left P1's scope.

Consumers that must be updated in the same commit as the move:

- every `@lib/trivia`, `@lib/exercise`, `@modules/trivia`, `@modules/exercise` import across `app/src` and `app/tests`
- the type-barrel chain. This is the part of P1 that is not a rename: `check-type-barrels.sh` rule 2 says a barrel raises only a **direct child**, never a grandchild. So `modules/types.ts` cannot raise `./training/trivia/types`. The chain has to gain a level:
  - `modules/training/types.ts` and `modules/training/interfaces.ts` become pure barrels raising `./trivia/*`, `./exercises/*`, `./routines/*`
  - today's declarations in those two files move down into `modules/training/routines/types.ts` / `interfaces.ts`
  - same shape on the `lib/` side, where `lib/training/types.ts`'s current declarations move to `lib/training/routines/types.ts` and `lib/training/exercises/types.ts` keeps raising `./rulesets/types`
  - `modules/types.ts` and `lib/types.ts` drop their `./exercise/types` and `./trivia/types` lines, keeping only `./training/types`
- `app/src/lib/client/alpine/register-route-data.ts`
- `app/src/pages/training/quick-subtract/index.astro`
- `docs/architecture/00-Context-Map.md` — the "New non-game client tool (Trivia)" pack row and any pack naming `09-training-routines.md` / `10-trivia.md`
- `docs/architecture/00-File-Inventory.md` — every row whose path moved
- `decisions/frontend/architecture.md` — D261's cross-reference
- `docs/architecture/07-Frontend/02-Folder-Structure.md` — the tree and the domain table
- `docs/game-rules/README.md` — its links into `trivia/` and `routines/`
- `app/.fallowrc.jsonc` — path-keyed `entry`, `duplicates.ignore` and `health.thresholdOverrides` entries. None of today's entries name a moving path (checked), but `npx fallow` is a **blocking** CI gate (`quality.yml`, "Stale-usage gate"), so a stale path there fails the build rather than degrading quietly.

**Commit granularity:** each domain moves with its consumers, its barrel update and its tests in **one** commit. Splitting a move from its import fixups leaves an intermediate commit that fails `check-test-coverage.sh` and `check-type-barrels.sh` — both run pre-commit, so the split cannot be committed anyway.

Editing `app/CLAUDE.md` needs no matching `AGENT.md` edit: `check-agent-mirrors.sh` requires every `AGENT.md` to be a fixed pointer stub carrying no rules (D213), so the stub is invariant under rule changes.

`@forms` removal, same plan:

- drop `"@forms/*"` from `app/tsconfig.json` and `"@forms"` from `app/vitest.config.ts` (both must go in one commit — `check-alias-sync.sh` fails on divergence)
- drop the `forms/` tree entry, the `@forms/*` alias row, the `.form.ts` suffix row and the `forms/` mentions in the import-direction tables from `02-Folder-Structure.md`
- drop `.form.ts` from `app/CLAUDE.md:118`'s non-negotiable suffix list
- do **not** edit D77 or D86 — they are historical rows, and the ledger is append-only. The new decision records that `settings.store.ts` took over the local-preference role D77 assigned to `forms/`, so the layer is retired unbuilt.

### 3.4 Decisions

Two new decisions, ids derived at PR time:

1. `decisions/frontend/architecture.md` — the training umbrella taxonomy and why `games/` and `rulesets/` stay outside it. Cites D261/D265.
2. `decisions/frontend/alpine.md` — the `forms/` layer is retired unbuilt; `settings.store.ts` is the D77 substitute in practice. Cites D77, D86.

### 3.5 Acceptance

- `npm run check`, `npm test` green with zero test edits other than import paths
- `check-context-map.sh`, `check-doc-links.sh`, `check-file-locations.sh`, `check-alias-sync.sh`, `check-type-barrels.sh`, `check-context-budget.sh` all pass
- `grep -rn "@forms" app/` returns nothing
- `grep -rln "trivia" app/src` returns only paths under `training/trivia/` and files whose *content* legitimately says "trivia" (Quick Subtract's own copy)
- `npx fallow` green
- PR closes #297 and #348 via keyword

No local graph refresh step: `graphify-out/graph.json` freshness is CI-owned and `context-maintenance` step 6 is a no-op by design.

### 3.6 Risk

The one real risk is a missed import in an `.astro` file, since `.astro` is only partially covered by the knowledge graph and `astro check` is the only mechanical proof. The plan must run `npm run check` — not just `npm test` — before claiming done.

---

## 4. P2 — `lib/game` context types and the score-training/TUOD twin (#281, #282)

### 4.1 Problem

**#281:** nine `*PlayContext` types in `app/src/lib/game/types.ts` each hand-restate the ~15 fields of `PlayLifecycleContext<TConfig, TEngine, TResults>` (defined at `types.ts:254`) instead of being defined in terms of it. A field added to the shared lifecycle contract has to be hand-copied nine times.

**#282:** after the `2026-09-03-play-data-lifecycle-dedup` plan removed the literal duplication across the four play-data files, `npx fallow` reported a *higher* total (12.2%, up from 11.4%) because a single near-miss clone group now spans most of `score-training-play.data.ts` and `tuod-play.data.ts` — 531 shared lines across 3 groups, up from 105. The issue's own proposed fix was to wait for the two rulesets to diverge. The user has chosen to act instead.

These are one plan because #281's unification is the precondition that makes #282's extraction tractable: with the nine contexts expressed generically, the shared surface between the two play-data files is a named type rather than two parallel literals.

### 4.2 Step 1 — generic contexts

Each of the nine types becomes:

```ts
export type ScoreTrainingPlayContext = PlayLifecycleContext<
  ScoreTrainingConfig,
  ScoreTrainingEngine,
  ScoreTrainingResultsSnapshot
> & {
  // per-ruleset members only
};
```

Type-level only. No `.data.ts` file changes in this step. The proof is `npm run check` passing with zero implementation edits.

Field-name parity was checked for this spec: all nine contexts already declare every one of `PlayLifecycleContext`'s 17 members, so no context needs the shared type widened or narrowed to absorb it. What the plan still has to verify per context is that the declared **types** match, not just the names — in particular `hiddenTimer?` (optional in the shared type) and each context's `$store: PlayStoreContext<TConfig>` / `resultsSnapshot: TResults | null` instantiation. If one genuinely diverges, the plan records the divergence and leaves that context hand-written rather than bending `PlayLifecycleContext` around it.

### 4.3 Step 2 — the twin

Measure `npx fallow dupes --format json` on a clean tree *after P1 has landed* — that is the plan's baseline, not the 12.2% in the issue.

A function-by-function comparison of the two files was done for this spec, and it changes the shape of the fix. The 531-line clone group is **not** one extractable body:

| Helper | Verdict |
| ------ | ------- |
| `findBotSeat`, `botDartIndex`, `formatRemaining` | byte-identical — extract as-is |
| `resumeEngine`, `startCountdown`, `maybeResumeCountdown` | differ **only** in type annotations (`ScoreTrainingEngine` ↔ `TuodEngine`, `…PlayContext["$store"]["game"]`) — extract as generics |
| `throwOneDart`, `throwBotDart`, `statsFor` | differ **behaviourally**. Score Training's `chooseTarget()` always fires treble 20; TUOD aims at the seat's own `currentTarget`, and its stats route through `tuodCheckoutVisits`. **Leave them.** |
| `computeStats`, `canSubmitVisit`, `throwBotQuickScoreDart`, `tuodCheckoutVisits` | TUOD-only. Nothing to share. |

So P2 extracts roughly 73 duplicated lines across six helpers and deliberately stops there. The residual near-twin is the whole-context structural similarity F27 already named, and forcing a factory over the behaviourally-divergent helpers would fuse two rulesets that genuinely differ. That is the extraction this plan does **not** do.

Explicitly **not** in this step: the `score-training.engine.module.ts` / `tuod.engine.module.ts` engine-side twin that F27 declined. Engines stay untouched. If the play-data extraction turns out to require an engine change, the plan stops and reports — that is a scope upgrade, not a step.

### 4.4 Acceptance

- `npx fallow` green (it is a blocking CI gate, and D232 records it tripping its duplication gate once already) with total duplication **below** the post-P1 baseline and the score-training/TUOD group gone or materially smaller
- every existing assertion in `app/tests/lib/game/` and `app/tests/modules/game/` still passes and still describes the same guarantee. Note the tension to handle deliberately: `check-test-coverage.sh` **requires** a covering test to be touched in the same change set, so "tests unmodified" is not achievable and is not the bar. The bar is directional — assertions may be added or strengthened, never weakened, deleted, or re-pointed at a different input to keep them green (Hard Invariant). The gate proves a test file was edited; only the diff review proves the edit was honest.
- `npm run check` clean
- one decision in `decisions/frontend/architecture.md` recording the factory boundary and why the engine pair stays out

### 4.5 Risk

Highest-risk plan in the sweep, and the only one that touches code a player exercises. TDD applies: characterise the current behaviour of both play-data files with tests *before* extracting, if existing coverage does not already pin it. If the extraction cannot be done without changing observable play behaviour, the correct outcome is to stop and report — #282's original "leave it until they diverge" verdict remains a legitimate answer, and the plan should say so rather than force it.

---

## 5. P3 — Migration `0035`, constraint rename (#295)

### 5.1 Problem

`exercise_configurations` (migration `0005`) names its constraints `uq_exercise_configuration_session` / `fk_exercise_configuration_session` — singular table noun, shortened column. Its mirror table one layer up, `activity_configurations` (migration `0030`), uses `uq_activity_configurations_activity` / `fk_activity_configurations_activity` — the `uq_<table>_<column>` convention the rest of the chain uses. Two mirrored tables, two conventions.

### 5.2 Work

Applied migrations are immutable, so this is a new migration `0035`, not an edit to `0005`:

```sql
ALTER TABLE exercise_configurations
  RENAME CONSTRAINT uq_exercise_configuration_session TO uq_exercise_configurations_exercise_session;
ALTER TABLE exercise_configurations
  RENAME CONSTRAINT fk_exercise_configuration_session TO fk_exercise_configurations_exercise_session;
```

with the inverse in `migrate:down`.

**Naming decision, stated explicitly because it is arguable:** the column is `exercise_session_id`, so `<column>` is `exercise_session`, giving `uq_exercise_configurations_exercise_session`. The shorter `uq_exercise_configurations_session` would read better but would repeat `0005`'s original sin of naming something other than the column. The convention wins over the aesthetics. If the user prefers the shorter form, it is a one-line change to the plan.

Only two places in the repo name these constraints: the migration itself and `app/src/db/schema.ts:657`. `schema.ts` is introspection-generated, so `npm run db:introspect` regenerates it — the plan must not hand-edit it. There is no `database/schema.sql` dump to keep in step (`database/` holds `migrations/`, `seeds/`, `verification/` only), and no `database/verification/` script names either constraint.

**The check that matters before writing the migration:** prove no runtime code catches these constraints by name. This repo does exactly that elsewhere — `app/src/services/session.service.ts:73` branches on `e.constraint === "uq_sessions_single_active"` and on the same string appearing in the message — so a rename *can* silently turn a mapped domain error back into a 500. Today's grep says `uq_exercise_configuration_session` appears nowhere under `app/src/services`, `app/src/repositories` or `app/src/pages/api`; the plan re-runs that grep against the tree it actually edits rather than trusting this line.

`0035` is the next free number and no open PR claims it (#389 adds no migration). Production application goes through the deploy pipeline's migrate job, behind its Neon-branch rehearsal (D288) — nothing manual.

### 5.3 Acceptance

- `npm run db:migrate` applies `0035` against a dev branch; `migrate:down` reverses it cleanly
- `npm run db:introspect` regenerates `schema.ts` with the new names and no other diff
- `check-constraint-mirror.sh` passes (these are UNIQUE/FK, not CHECK, so it is unaffected — confirm, do not assume)
- one decision in `decisions/database.md` fixing `uq_<table>_<column>` as the convention going forward
- `03-Migrations.md` updated for `0035`

### 5.4 Risk

Low. `RENAME CONSTRAINT` is metadata-only — no table rewrite, no row-level lock of consequence on a table this size, and nothing queries these names outside `\d` introspection.

---

## 6. P4 — `LEVEL_SKILL_TABLE` bias values (#286)

### 6.1 Problem

`app/src/modules/dartbot/skill-profile.module.ts` holds 15 levels meant to be 15 distinct hand-tuned points on a smooth curve. Levels 7/8 currently share `biasXMm` 2.5, levels 9/10 share 1.2, levels 12/13 share 0.4. The duplication predates the D-L refit; both D-L's power-law rescale and D-N's log-space interpolation are ratio-preserving, so a pair identical before an edit stays identical after it. Two refits have now carried the artifact forward unchanged.

### 6.2 Work

Give each of the six affected levels its own `biasXMm`/`biasYMm`, interpolated geometrically between the pair's nearest **distinct** neighbours — the same ratio-preserving idea D-N used, applied locally so no level outside the three flat spots moves. The point is to remove the flat spots, not to re-tune the curve's shape.

One wrinkle the method has to respect: **level 6's `biasXMm` is `-5.0`** — a sign flip, because it is measured data, not a fitted point. It is a valid bracket for `biasYMm` (`3.1`, which sits correctly between levels 5 and 7) but not for `biasXMm`, where the pair 7/8 must bracket against level 5 instead. That sign anomaly is real and stays.

All six affected levels move, including level 8. See §6.3 for what that costs.

Hard constraints:

- **Level 6 does not move.** It is the measured anchor from `D-E-extract.md`; the anchor log's latest row pins it, and `skill-profile.module.test.ts` asserts its exact values (`biasXMm` `-5.0` among them).
- Levels 1 and 15 do not move — they are D-N's guardrail anchors, and `skill-profile.module.test.ts` pins their exact sigmas too.
- **Level 8 must stay inside the mid band.** `harness/tier-bands.test.ts` asserts levels 1, 8 and 15 sit in their beginner/mid/elite bands — level 8 is a simulated checkpoint, not just a table row, and it is one of the six levels this plan moves.
- Monotonicity across all 15 levels must hold for every profile field: the existing tests cover scatter spread and `decisionQuality`, plus average/checkout/treble/miss/t20 rates across all 15 levels in `tier-bands.test.ts`.

### 6.3 Acceptance

- `app/tests/modules/dartbot/` green, with two expected and intentional test-side changes:
  - **`__snapshots__/throw-engine.determinism.test.ts.snap` is regenerated.** The committed snapshot is taken at **level 8** — one of the six levels this plan moves — so it necessarily changes. The regenerated snapshot's diff is reviewed as the intended consequence of the bias edit, not accepted blind. It is also a standing hazard worth naming: a determinism snapshot pinned to a tunable level will break on every future refit.
  - **A new bias assertion.** No current test asserts anything about `biasXMm`/`biasYMm` across levels — which is precisely why identical pairs survived two refits unnoticed. The assertion has to be the right one: **no two adjacent levels share an identical `(biasXMm, biasYMm)` pair**, across all 15 levels, plus decreasing magnitude from level 7 to 15. It cannot be plain monotonicity over 1–15, because level 6's measured `-5.0` breaks any such ordering by design.
- a simulation run recorded in the plan showing the level 1 / 6 / 15 anchor bands and the level 8 mid band still hold, with the measured numbers quoted
- a new append-only row in `08-DartBot-Anchor-Log.md` (never an edit to an existing row) describing this as a flat-spot removal, not a re-anchor
- one decision in `decisions/game-engine.md` (where the DartBot decisions live)
- `08-DartBot.md`'s version header updated (it has gone stale twice before — see #285)

### 6.4 Risk

Medium. The values are simulation-verified, not analytically provable, and the verification is seeded. The plan must report the measured numbers, not assert the bands held. If the interpolated values push level 8 out of its mid band, the correct move is to re-derive them on the curve — never to widen the band.

---

## 7. P5 — Decision-id derivation (#386)

### 7.1 Correction to the issue's premise

#386 reports that PRs #381 and #382 declared ids `main` had already issued, and asks whether the derivation belongs in a pre-merge check. Two facts change the shape of the fix:

1. **The substance is already resolved.** The collisions were renumbered; D291, D292 and D293 are on `main` and both PRs merged.
2. **The pre-merge check already exists.** `scripts/check-decision-ids.sh` runs in `quality.yml`, called from `checks.yml` on every `pull_request` to `main`, and `actions/checkout` resolves a `pull_request` event to the *merge* ref. So the uniqueness check already sees branch + main combined — which is exactly how this collision was caught.

What remains is not a missing gate. It is that the gate fails **late** — after the branch is written, the decision cited across `CLAUDE.md`, `00-File-Inventory.md`, `.gitignore` comments and the PR body — and the fix is a manual, error-prone renumber across all of those citations.

### 7.2 Work

- `scripts/next-decision-id.sh` — prints the next free id, derived against `origin/main` (fetched, not the local ref, which is stale in a worktree). Used at the moment a decision is authored **and** re-run immediately before opening the PR.
- `scripts/renumber-decision.sh <old> <new>` — rewrites one id across the working tree's tracked files, reporting every file it touched so the author can eyeball the diff. This is the piece that makes a late-discovered collision cheap.
- `.claude/skills/context-maintenance/SKILL.md` — a step in the pre-PR section: re-derive the id against fresh `origin/main` before opening the PR; if it moved, run the renumber helper.

No new CI job. The existing gate is correct; only the authoring ergonomics change.

### 7.3 Acceptance

- both scripts run clean from a worktree and from the main checkout
- `next-decision-id.sh` returns the correct next id against today's ledger (D294 at time of writing — verify, do not assume, since this sweep's own plans will consume ids)
- `renumber-decision.sh` round-trips: rename an id and back, tree byte-identical
- `check-decision-ids.sh` still passes
- the two scripts registered in `00-File-Inventory.md` — note #388 reports the last four verification scripts were never registered; these two must not repeat that
- one decision in `decisions/context-system.md` recording the derive-at-PR-time rule

### 7.4 Risk

Low. Both scripts are advisory tooling; the enforcing gate is unchanged.

---

## 8. Issues closed by this sweep

| Issue | Closed by | Note |
| ----- | --------- | ---- |
| #297 | P1 | |
| #348 | P1 | |
| #281 | P2 | |
| #282 | P2 | May close as "won't fix, re-verified" if §4.5's stop condition fires |
| #295 | P3 | |
| #286 | P4 | |
| #386 | P5 | Substance already resolved on `main`; P5 closes the ergonomic half |

Anything noticed while executing these plans that they did not ask for is a new `discovered-work` issue per the `capturing-discovered-work` skill — never fixed in the same pass.
