# Ten Up One Down — Analytics Capture (VISUAL_BOARD) — Design

> **Date:** 2026-08-20
> **Status:** approved (brainstorming consensus)
> **Scope:** `TUOD_V1` gains the `ANALYTICS` + `VISUAL_BOARD` capability pair — dart-by-dart board-tap capture of a checkout attempt — alongside its existing `RECREATIONAL` + `QUICK_SCORE` capture. Engine, validator, capability/seed, frontend, tests.
> **Out of scope:** any new scoring rule, config field, schema/migration change, or `v_*` view. F10 (ladder ceiling/bogey-number gap) is untouched — a separate open finding, not fixed in this pass.

---

## Context

TUOD_V1 (D153/D154, frontend D216/D217) is currently the only ruleset declaring `RECREATIONAL + QUICK_SCORE` alone (`RULESET_CAPABILITIES.TUOD_V1 = [QUICK_SCORE]`, `app/src/lib/game/rulesets/capabilities.ts:42`) — every other quick-score-shaped game (501, Score Training, 121) already paired it with `ANALYTICS + VISUAL_BOARD`, most recently 121 (`2026-08-15-121-shanghai-atc-analytics-design.md`, Group B). This design applies that same pattern a fourth time.

TUOD's shape is closest to 121's Group B, not Shanghai/Around the Clock's Group A: both TUOD and 121 record a *whole visit* under `QUICK_SCORE` (`TuodAttemptInput`/`OneTwentyOneVisitInput`), not individual darts, so both need a dual-shape engine that also accepts a `DartObservation` and builds the visit dart-by-dart. TUOD is structurally simpler than 121 here — TUOD has exactly one visit per attempt already (no 3-visits-per-round budget), so there is no per-round stage bookkeeping to add: the dart-by-dart path resolves directly into the existing single `EXERCISE_BLOCK` stage.

**Decisions made during brainstorming:**
- Resolving the ruleset doc's stated Known Limitation (bust indistinguishable from a scoreless miss) is an explicit goal, not an incidental side effect — real per-dart facts under `VISUAL_BOARD` make the two recomputable from the fact log alone (no new field): a bust's darts show an overshoot / remaining-1 / reached-0-without-a-double pattern; a miss's darts land three attempts short of the target with none of those.
- Under `VISUAL_BOARD`, the shared `CheckoutConfirm` dialog (D217) and its `dartsUsed`/`dartsAtDouble` claims are bypassed entirely — a real dart self-reports whether it finished on a double, exactly as 501/121 already bypass their own keypad confirm under `VISUAL_BOARD`.
- No schema change: `darts.location_x`/`location_y` and `chk_dart_location_pair` already exist (migration history predates this task).

---

## Design

### 1. Engine — `tuod.engine.module.ts`

- `TuodInput = TuodAttemptInput | DartObservation` (new, `modules/game/types.ts`, mirroring `OneTwentyOneInput`).
- `isDartObservation(input): input is DartObservation` — shape guard on `"hitZoneKey" in input`, copied from `one-twenty-one.engine.module.ts`.
- `resolveObservation(observation)` — `classify(locationX, locationY)` when both are present; a scoreless `{ targetNumber: null, zoneKey: observation.hitZoneKey, score: 0 }` when either is null (an unseen dart) — copied verbatim from 121/501.
- `record()` dispatches: a `TuodAttemptInput` takes the existing path (renamed `recordAttemptTotal`, behavior byte-identical to today's `record`); a `DartObservation` takes the new `recordDart`.
- `recordDart(observation)`:
  - `openVisit()` / `openNewVisit()` against `this.stage` (the session's one `EXERCISE_BLOCK` — no new stage is ever opened, unlike 121's per-round stage push).
  - Pushes a dart fact carrying the observation's real `locationX`/`locationY`, `resolveObservation`'s `targetNumber`/`zoneKey`/`score`.
  - `settleVisit(visit)`: `thrown = sum(visit.darts.score)`; `remainingAfter = targetBeforeAttempt - thrown` (target-before-attempt read via `deriveClosedState` over turns strictly before this one, mirroring 121's `remainingBeforeVisit`); `checkedOut = remainingAfter === 0 && lastDart.hitZoneKey === "DOUBLE"`; `busted = remainingAfter < 0 || remainingAfter === 1 || (remainingAfter === 0 && !checkedOut)`. The visit resolves (stamps `completedAt`, sets `totalScore`) on checkout, on bust, or once `visit.darts.length === config.maxDartsPerTurn` — whichever comes first, exactly matching the ruleset doc's "one visit of up to three darts" and its bust rule ("if the visit would go past 0, leave 1 under double out, or hit 0 without a double, that visit is a bust"). `totalScore` = the target the attempt was thrown at on checkout, `0` on bust or a plain 3-dart miss — the same rule `applyTuodAttempt` already folds, so `deriveState()` needs no change: it still folds every *closed* turn through `applyTuodAttempt(config, state, turn.totalScore > 0)` regardless of which path produced the turn.
  - Refuses (throws) when `isComplete()` is already true — same guard `rejectionReason` already applies to the quick-score path.
- `undo()` dispatches on the last turn's shape: `darts.length > 0` → pop one dart (reopening the turn — clear `completedAt`, recompute `totalScore` from remaining darts — or pop the whole turn if no darts remain); otherwise → the existing quick-score pop. Mirrors `OneTwentyOneEngine.undo()`'s `undoDart`/`undoVisitTotal` split. No stage-popping needed (TUOD never opens a second stage).
- `wouldComplete(input)` dispatches: a `DartObservation` variant answers whether this dart would both check out and satisfy `completesAt(attempts + 1)`; the existing `TuodAttemptInput` variant is unchanged.
- Dart facts always carry the observation's real coordinates (never fabricated) — TUOD had no dart facts before this change, so there is no pre-existing coordinate bug to fix, only a new path built correctly from the start (matching the 121-design's own framing of its Group B path).

### 2. Validator — `tuod.validator.ts`

- `validateConfig`: swap `isQuickScoreCapture` for the already-shared `isQuickScoreOrVisualBoardCapture` (`quick-score.validator.ts`); rejection message becomes `QUICK_SCORE_OR_VISUAL_BOARD_MODES`.
- `validateBatch`: branch on capture mode — `ANALYTICS + VISUAL_BOARD` → `validateVisualBoardTurns(batch)` (shared coordinate/claim cross-check; no game-specific max-score parameter needed at this layer, since bust/checkout legality is enforced engine-side, matching how `five-oh-one.validator.ts` calls it); `RECREATIONAL + QUICK_SCORE` → existing `validateQuickScoreTurns(batch, maxTurnScore(config))` + `exceedsRoundsLimit`, untouched.

### 3. Capability & seed

- `capabilities.ts`: `TUOD_V1: [QUICK_SCORE, VISUAL_BOARD]`.
- `database/seeds/0007_ruleset_version_capabilities.sql`: append `('TUOD_V1', 'ANALYTICS', 'VISUAL_BOARD')` to the running ledger — 14 → 15 rows.
- `database/verification/0007_capability_seed_checks.sql`: both hardcoded row-count assertions (14 → 15) and every VALUES list updated in lockstep, the same mechanical edit the 121/Shanghai/ATC task made going 11→14.
- `games-visibility.ts`: no code change — `supportsCaptureMode` already drives card visibility generically; only new/extended test cases in `games-visibility.test.ts`.

### 4. Frontend

- `tuod-play.data.ts`: add a `self` closure (assigned in `init()`, matching 121's anticipatory comment pattern), `recordDart(observation)` delegating to a `commitDart` entry point, `...boardInputData((observation) => self.recordDart(observation))` spread. The existing `recordAttempt`/`CheckoutConfirm` flow (D217) is untouched — it stays the `QUICK_SCORE` path.
- `TenUpOneDown.astro`: add `BoardInputPanel`; gate the existing `ScoreInput`/`CheckoutConfirm` behind `x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"` + `x-cloak` — the exact `FiveOhOne.astro`/`OneTwentyOne.astro` diff.
- `lib/game/types.ts`: `TuodPlayContext` gains `recordDart`, `commitDart` — mirroring `OneTwentyOnePlayContext`'s additions for its own board path.

### 5. Docs

- `docs/game-rules/rulesets/ten-up-one-down.md`, "Known limitations": scope the bust/scoreless-miss-indistinguishable claim to `QUICK_SCORE` capture only — under `VISUAL_BOARD`, the two are recomputable from the persisted dart facts (an overshoot / remaining-1 / reached-0-without-a-double pattern marks a bust; three darts landing short of the target with none of those marks a plain miss). No `v_*` view is added to surface this in this task — the doc records that the data now supports it, not that a query does yet.
- New `decisions/game-engine.md` entry recording TUOD joining the dual-capture set (D196's "adding a pair means editing both sides" consequence, applied a fourth time) — append-only, no edit to D196/D216's existing text.

### 6. Testing

- `tuod.engine.module.test.ts`: dart-by-dart visit building, dart-based bust/checkout/miss resolution, `undo()` over a dart-shaped turn (partial-visit and whole-turn pop), coordinate preservation, `wouldComplete` for a dart that would end the session.
- `tuod.validator.test.ts`: new `ANALYTICS + VISUAL_BOARD` cases mirroring `one-twenty-one.validator.test.ts`.
- `tuod-play.data.test.ts`: new `recordDart`/`commitDart` cases mirroring `one-twenty-one-play.data.test.ts`'s board-input coverage.
- `capability-seed-parity.test.ts`, `capability-validator-parity.test.ts`, `games-visibility.test.ts`: regenerated/extended for the new pair.
- No `.astro` component tests (D101); `.astro` pages verified manually via `/run` after implementation.

### 7. Edge cases

- A dart landing exactly on the target's double with a prior dart already having caused a bust mid-visit: impossible by construction — `settleVisit` resolves (and stops accepting further darts for that turn) the instant a bust condition is met, so a later dart in the same visit can never be recorded against it; `recordDart` always opens a fresh turn once the prior one has `completedAt` set.
- Reload mid-attempt with one or two board darts already thrown: `resumeEngine` replays `$store.game.turns` through `TuodEngine.create(config, prior)` exactly like every other resumable game — an open (unresolved) turn stays open, and the next `recordDart` continues it via `openVisit()`.
- MINUTES timer expiring mid-visit: unchanged from the quick-score path — `completesAt` already guards `attemptCount >= 1`, and the in-progress visit is still allowed to finish (its dart-by-dart resolution runs the same way regardless of `timerExpired`).

---

## Out of scope / deferred

- No `v_*` read-model/reporting view surfacing the newly-derivable bust/miss distinction — the fact log supports it; a view that queries it is future work.
- F10 (ladder can climb onto an unfinishable target) — untouched, a pre-existing open finding independent of capture mode.
- No change to `checkout-darts.module.ts` or the `CheckoutConfirm` dialog itself — it remains the `QUICK_SCORE`-path-only mechanism it is today.

---

## Context Maintenance

Per the root `CLAUDE.md` mandatory protocol, at implementation time:
- `docs/game-rules/rulesets/ten-up-one-down.md` — Known Limitations edit (above).
- `decisions/game-engine.md` — new entry (above); `D196`/`D216`/`D217` are not edited (append-only ledger).
- `database/seeds/0007_ruleset_version_capabilities.sql`, `database/verification/0007_capability_seed_checks.sql` — row-count and VALUES-list edits.
- `graphify-out/graph.json` — refresh via `scripts/refresh-graph.sh` once code lands.
- This spec is docs-only; no code changes ship in this task. Implementation is the next phase (`writing-plans`), on a dedicated branch, PR to `main` on completion.
