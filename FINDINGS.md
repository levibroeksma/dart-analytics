<!--
status: canonical
scope: open findings — defects and contradictions noticed but deliberately not fixed
read-when: triaging what to fix next; never loaded by a task
updated: 2026-08-27
highest-issued: F38
-->

# Findings

> Things an agent noticed while doing something else. A finding is **not** a
> work item: it is logged here and named in the completion report, never fixed
> in the same pass. Acting on one requires explicit user permission, and is a
> new task on its own branch. (Root `CLAUDE.md`, Hard Invariants; D214.)
>
> **Opposite lifecycle to `DECISIONS.md`.** Decisions are permanent and
> append-only. Findings are open until closed, and a closed finding is
> **deleted** — the record of the fix is the commit that fixed it, plus a
> decision in `decisions/**` where the fix embodied a real choice. Nothing
> accumulates here.
>
> Guarded by `scripts/check-findings-log.sh`.

## How to add a finding

- Next id is `highest-issued` in the front matter **plus one**. Bump that line
  in the same edit. Ids are never reused — because entries are deleted, the id
  cannot be derived by scanning the file, which is exactly what the high-water
  mark is for.
- `Status:` is `Open` (logged, not yet shown to the user) or `Raised` (named in
  a completion report). There is no `Resolved`: when a finding is fixed, delete
  its block.
- `Evidence:` cites at least one real path, optionally with a `:line` locator.
  The gate checks every cited path still exists, so a finding whose subject was
  deleted or moved fails the build until the entry is corrected or removed.
- Block format:

```markdown
### F<next> — Short statement of what is wrong
Status: Open · Found: YYYY-MM-DD · Task: <branch>
Claim: what the repo asserts
Evidence: `path/to/file.md:12` vs what is actually true
Impact: what it costs an agent that trusts the claim
Proposed: the smallest change that would resolve it — a proposal, not a plan
```

---

### F5 — A broken script is filed as a deferred feature
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `scripts/check-context-map.sh`'s migration-range regex cannot tell a seed range from a migration range, so a seed chain quoted as ending at `0003` is compared against the migration chain end and fails
Evidence: `scripts/check-context-map.sh` — the check at its "2. Migration range consistency" section; the workaround was to reword the affected doc line, leaving the script deliberately unfixed (2026-07-26)
Impact: the defect sat in `DECISIONS.md`'s Deferred list among eleven unbuilt features, where "we chose not to build this" and "this is broken" are indistinguishable
Proposed: narrow the regex to skip lines naming seeds — partly done for `decisions/**` and seed lines by D194, but the seed-vs-migration ambiguity itself remains

### F9 — A game-frontend plan written one-commit-per-task collides with `check-game-wiring.sh`'s atomicity requirement
Status: Open · Found: 2026-08-20 · Task: claude/tuod-implementation-2lb1mh
Claim: `docs/architecture/07-Frontend/09-Adding-A-Game.md`'s touch list, and a plan written by `writing-plans` from it, break a new game's frontend into sequential per-file tasks (setup controller, setup page, play controller, play page, wiring), each with its own commit
Evidence: `scripts/check-game-wiring.sh`'s "3a"/"3b" checks require a ruleset to be fully wired (both setup/play data modules, both pages, both Alpine registrations, and its games-visibility card) or fully absent — "half a row is a failure whichever half it fell on" — in the state of every commit, not just the final one; TUOD's frontend plan (`docs/superpowers/plans/2026-08-20-tuod-frontend.md`) called for one commit per task, and the first task's commit (setup controller alone) failed the pre-commit `game-wiring` hook because `app/src/lib/game/tuod-setup.data.ts` existed while `app/src/lib/game/rulesets/games-visibility.ts` still had no `TUOD_V1` card
Impact: an agent following either the doc's task breakdown or a plan written from it hits a rejected pre-commit hook on the first task, discovers the constraint only by trial, and must fall back to committing the whole frontend fan-out in one commit instead of the plan's intended per-task history
Proposed: note the atomicity requirement in `09-Adding-A-Game.md` (e.g., "land all six trees in one commit, or hold every task's changes uncommitted until wiring lands") so a future plan is written commit-shape-aware from the start

### F10 — TUOD's ladder can climb onto a target no double can finish
Status: Open · Found: 2026-08-20 · Task: claude/tuod-implementation-2lb1mh
Claim: `applyTuodAttempt` floors the target at 2 on a miss but has no ceiling on a success, so a run of checkouts walks the ladder past 170 and onto bogey numbers on the way (41, 51, … 161, 171; a penalty can land it on 159, 162, 163, 165, 166, 168, 169)
Evidence: `app/src/modules/game/tuod.engine.module.ts` — `MIN_FINISHABLE_TARGET` is applied only to the failure branch, while the success branch is `state.currentTarget + config.finishBonus` with no bound; `checkoutPathFor` returns null for every one of those targets
Impact: once the ladder reaches such a target the session can only ever record failures — `submitVisit` skips the checkout dialog when the chart has no route (matching 501's bogey-number behaviour, D217), so the target drops by `missPenalty` each attempt until it re-enters the chart. Reaching 171 needs 13 consecutive checkouts inside 10 rounds or 10 minutes, so it is unreachable in practice today; it becomes reachable the moment `duration_value` or `finish_bonus` is made editable
Proposed: decide whether the ladder caps at 170 (the chart's ceiling), skips unfinishable targets on the way up, or is left unbounded on the grounds that the duration ends the session first — and record it, since the current behaviour is unstated rather than chosen

### F15 — Every game interface repeats a fragile `max-h-2/5 h-full` sizing pair, and one grid item carries a dead `flex-1`
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: fixing a real-device-only (iPhone 12 Pro, not reproducible in this environment's Chromium or in desktop-simulated mobile viewports) overlap in the split scoreboard found the nested `glass` (`backdrop-filter`) stack unique to that path and removed it; this closes the one occurrence actually reported, not the underlying sizing pattern all nine interfaces share
Evidence: every interfaces file passes `class="max-h-2/5 h-full"` (or `min-h-2/5 max-h-2/5 h-full`) to its `SinglePlayerDisplay`/`SplitScoreboard` — `app/src/components/layout/games/interfaces/Shanghai.astro:24`, `app/src/components/layout/games/interfaces/ScoreTraining.astro:23`, `app/src/components/layout/games/interfaces/TenUpOneDown.astro:21`, `app/src/components/layout/games/interfaces/OneTwentyOne.astro:21`, `app/src/components/layout/games/interfaces/DoublesTraining.astro:24`, `app/src/components/layout/games/interfaces/SinglesTraining.astro:24`, `app/src/components/layout/games/interfaces/Bobs27.astro:24`, `app/src/components/layout/games/interfaces/AroundTheClock.astro:23`, `app/src/components/layout/games/interfaces/FiveOhOne.astro:25` — stacking `h-full` (percentage height) on a flex item whose `flex-1` already sets `flex-basis: 0%`, which per spec makes the percentage height inert; separately, `app/src/components/layout/games/SplitScoreboardHalf.astro:53`'s root div carries `flex-1`, but its parent (`app/src/components/layout/games/SplitScoreboard.astro`) is `display: grid`, where `flex-*` properties have no effect at all. The `SplitScoreboard` call site at `app/src/components/layout/games/interfaces/FiveOhOne.astro:76` was changed to h-2/5 (2026-08-22, reported production overlap still visible under the old classes) — this only fixes that one call site, not the pattern across the other eight interfaces
Impact: the pattern was never proven to be the reported bug's cause (the nested `glass` fix was), so it may or may not harbor a real cross-browser sizing risk on the other eight interfaces' own iOS rendering — unverified either way since no WebKit engine is available in this environment; the dead `flex-1` class is harmless but misleads a reader into thinking `SplitScoreboardHalf`'s height is flex-resolved when it is actually grid-row-stretched
Proposed: audit whether `h-full` can simply be dropped everywhere it sits beside `flex-1` (no behavior change per spec, one less redundant declaration), and replace `SplitScoreboardHalf.astro:53`'s `flex-1` with nothing (or an explicit `h-full`, if grid stretch is ever found unreliable) — small, mechanical, but touches nine files and deserves its own task and on-device verification rather than folding into this one

### F18 — TUOD's live-stats banner shows combined-seat data during the post-match save window
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `TenUpOneDownResults.astro`'s pre-existing "live" `<dl>` block (unfiltered `x-show="completionStatus !== 'succeeded'"`) reads `$store.game.turns.length`/filtered counts and `currentTargetLabel()` as if there is exactly one player throwing
Evidence: `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro` — the live stats block, against `app/src/lib/game/tuod-play.data.ts`'s `currentTargetLabel()`, which now delegates to whichever seat is `activeParticipantRef` (added when TUOD gained 1v1 support in this plan's Task 12)
Impact: during the brief `pending`/`saving` window right after a 1v1 TUOD match finishes, this block shows attempt/success/failure counts summed across BOTH seats' turns, and a "Target reached" value keyed to whichever seat happened to be active last — not the viewer's own seat. Harmless while TUOD was solo-only (one player, one set of turns); now seat-count-dependent and misleading for the one window it's visible
Proposed: scope the live block's `turns`/`currentTargetLabel` reads to the viewer's own seat (or to `state()?.activeParticipantRef`'s seat specifically), mirroring the seat-scoped accessors (`*For(seatRef)`) already added elsewhere in this file's sibling engines during this plan

### F20 — `foldShanghaiState`'s `winningSideKey` reads non-null for a solo session that ends on a Shanghai
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `raceWinner` is called unconditionally on every seat, including a solo (1-seat) session; a lone seat that hits a Shanghai is the sole `finished: true` entry, so `raceWinner` returns that seat's own `sideKey` rather than `null` — flagged as a Minor, non-blocking review note on the prior task that added this function, deferred to this task to determine whether it leaks into the frontend
Evidence: `app/src/modules/game/shanghai.engine.module.ts:165-170` (`raceResult = raceWinner(seats.map(...))`, no `seats.length > 1` guard, unlike the `compareResult` branch two lines below which does gate on `seats.length > 1`); confirmed via `foldShanghaiState`'s own solo-Shanghai test in `app/tests/lib/game/shanghai-play.data.test.ts` ("SINGLE, DOUBLE, TREBLE in one visit wins instantly with a Shanghai"), whose `resultsSnapshot.winningSideKey` is the solo seat's own `"A"`, not `null`. `foldOneTwentyOneState` (`app/src/modules/game/one-twenty-one.engine.module.ts`) carried the identical unguarded `raceWinner` call and was FIXED on 2026-08-22 by the whole-plan review-fix pass, with a solo-checkout-at-170 regression test in `app/tests/modules/game/one-twenty-one.engine.module.test.ts`; Shanghai was left as-is because its `winningSideKey` is `raceResult ?? compareResult` rather than a bare `raceWinner` result, so the guard's placement is a judgment call the fix pass had no mandate to make
Impact: currently masked in the UI — `ShanghaiResults.astro`'s banner logic short-circuits to the classic solo "Shanghai!"/"Session complete" text whenever `($store.game.seats?.length ?? 1) < 2`, regardless of `winningSideKey`, so today's rendering is unaffected (verified this task). But `winningSideKey` is otherwise documented/used everywhere else as "null unless a 2+-seat match has a decided winner" (mirrors `AroundTheClockState`/`TuodState`'s own field, and now `OneTwentyOneState`'s), so any future direct consumer of `ShanghaiState.winningSideKey` that does not itself re-check seat count would misread a solo Shanghai as having a "winning side" — and Shanghai is now the last engine that does
Proposed: gate `raceResult` on `seats.length > 1` in `foldShanghaiState`, matching the `compareResult` branch's own existing guard two lines below and 121's now-shipped `seats.length === 1 ? null :` guard — restores `winningSideKey: null` for every solo completion, symmetric with the rest of the function

### F21 — A solo MINUTES TUOD session with two-or-more attempts can get permanently stuck once the timer expires mid-session
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `TuodEngine.recordDart`/`recordAttemptTotal` (via `rejectionReason`) throw whenever `this.isComplete()` is already `true`, and `wouldCompleteDart`/`wouldComplete` answer `false` in the same case, with no carve-out for solo sessions — unlike the narrower `ScoreTrainingEngine.isMatchDecided()` guard added by this same task (D229), which deliberately excludes solo sessions from tripping
Evidence: `app/src/modules/game/tuod.engine.module.ts:316-318` (`rejectionReason`'s `isComplete()` check), `app/src/modules/game/tuod.engine.module.ts:393-397` (`recordDart`), `app/src/modules/game/tuod.engine.module.ts:505` (`wouldCompleteDart`); `seatCompletesAt` (`app/src/modules/game/tuod.engine.module.ts:132-141`) reads `timerExpired && attemptCount >= 1` for MINUTES, so a solo MINUTES session's `isComplete()` reads `true` from `expireTimer()` alone once one attempt already exists — the exact shape of the bug D229 found and fixed for Score Training. Confirmed directly against `TuodEngine` (ad hoc test, not committed): recording one attempt, then `expireTimer()`, then a second attempt — `isComplete()` is `true` before the second attempt, `wouldComplete(...)` on that second attempt already answers `false` (not `true`, as `app/src/lib/game/tuod-play.data.ts`'s `recordAttempt`/`recordDart` need to defer to the finish-confirm dialog), and `record(...)` on it throws. No test in `app/tests/modules/game/tuod.engine.module.test.ts` or `app/tests/lib/game/tuod-play.data.test.ts` covers this — every existing MINUTES test there either expires the timer with zero attempts recorded first, or records exactly one attempt total
Impact: in `tuod-play.data.ts`'s real MINUTES flow, `recordAttempt`/`recordDart` check `wouldComplete` first; once it reads `false` here, `showFinishConfirm` never becomes `true`, so the code falls through to `engine.record(input)` in a try/catch, which throws — caught, surfaces as `this.error`, and returns. Every subsequent attempt hits the same path: `wouldComplete` stays `false` and `record` keeps throwing, so the session can never be finished or uploaded from this state — a real player stuck mid-match with an unrecoverable error on every throw, reachable simply by throwing more than one attempt in a MINUTES TUOD session before the clock runs out
Proposed: add an `app/tests/lib/game/tuod-play.data.test.ts` case recording one attempt, expiring the timer, then completing via a second attempt (mirroring `app/tests/lib/game/score-training-play.data.test.ts`'s "drives a MINUTES session to completion once the timer expires") to lock in the regression, then narrow `TuodEngine`'s guard the same way D229 narrowed Score Training's (an `isMatchDecided()`-style check scoped to `seats.length > 1`, or equivalent)

### F27 — Duplication still sits at 14.8%, concentrated in the play-data lifecycle and the Score Training / TUOD engine pair
Status: Open · Found: 2026-08-23 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `npx fallow` now exits 0 (76 clone groups, 14.8% duplicated, 0 files above the health threshold), but two large clone families were deliberately left standing rather than refactored
Evidence: `cd app && npx fallow dupes` — an 8-group / 236-line family across `app/src/lib/game/five-oh-one-play.data.ts` and `app/src/lib/game/one-twenty-one-play.data.ts`, a matching 8-group family across `app/src/lib/game/score-training-play.data.ts` and `app/src/lib/game/tuod-play.data.ts` (both centred on `uploadAndCompleteSession` / `playAgain` / `computeStats` around `app/src/lib/game/play-lifecycle.ts`), and one 354-line structural clone between `app/src/modules/game/score-training.engine.module.ts:81-344` (264 lines) and `app/src/modules/game/tuod.engine.module.ts`
Impact: the play-data family was left alone on purpose — that code was hardened days earlier by the Play Again session-participant/config reseating fix, and refactoring it immediately afterwards would put regression risk on the most fragile, most recently repaired path in the app. The engine pair's remaining clone is whole-class structural similarity (two duration-bounded, dual-input engines converted by the same recipe), not a set of extractable blocks; the pieces that WERE extractable have been (`turn-log.module.ts`, `seat-state.module.ts`, `scoreCompareOutcome`). The result is a passing but thin margin: `.fallowrc.jsonc`'s `duplicates.threshold` is configured at `0.0` (unset), so the actual gate is fallow's own inferred default, empirically somewhere between 14.8% (this passes) and 18.6% (the pre-fix state failed) — not a confirmed "15%" figure — so a modest future addition can fail CI again without any new duplication of its own
Proposed: a dedicated task should take the play-data lifecycle family on its own branch, with the Play Again 1v1 path exercised end to end before and after; the engine pair is better left as-is until one of the two rulesets diverges on its own, at which point the clone dissolves without a refactor

### F28 — `00-File-Inventory.md` still describes `context-maintenance` as an "8-step procedure"
Status: Open · Found: 2026-08-23 · Task: claude/findings-grouping-specs-aekw5m
Claim: `docs/architecture/00-File-Inventory.md:235` describes `.claude/skills/context-maintenance/SKILL.md` as an "8-step procedure"
Evidence: `.claude/skills/context-maintenance/SKILL.md` currently numbers 9 steps (step 9, "Component inventory," follows step 8 "Findings gate")
Impact: an agent trusting the row's step count as a checklist length stops after 8, skipping the component-inventory step whenever it applies
Proposed: reword the row to "9-step procedure," or drop the number and just say "procedure" so it can't go stale again

### F29 — 5 near-identical `*PlayContext` types restate `PlayLifecycleContext`'s shape instead of reusing it
Status: Open · Found: 2026-08-26 · Task: claude/dart-previews-architecture-9tomxf
Claim: `Bobs27PlayContext`, `SinglesTrainingPlayContext`, `DoublesTrainingPlayContext`, `ShanghaiPlayContext`, `AroundTheClockPlayContext`, `FiveOhOnePlayContext`, `OneTwentyOnePlayContext`, `ScoreTrainingPlayContext`, and `TuodPlayContext` (all in `app/src/lib/game/types.ts`) each hand-declare `hiddenTurnKey`, `hiddenTimer`, `loading`, `error`, `finished`, and the rest of `PlayLifecycleContext<TConfig, TEngine, TResults>`'s fields, rather than being defined in terms of it
Evidence: `app/src/lib/game/types.ts` — compare `PlayLifecycleContext` (around line 181) against any of the 9 named types; each restates the same ~15 fields verbatim with only `TConfig`/`TEngine`/`TResults` substituted by hand
Impact: a future field added to the shared lifecycle contract (e.g. a new timer or status field) must be hand-copied into 9 places instead of one; noticed while extracting `playPreviewSegments`/unifying the reveal timer, then widened when `FiveOhOnePlayContext`/`OneTwentyOnePlayContext`/`ScoreTrainingPlayContext`/`TuodPlayContext` picked up the same fields (D234) — a full generic-based unification is a separate, larger type-level refactor outside either task's scope
Proposed: define each `*PlayContext` as `PlayLifecycleContext<XxxSnapshot, XxxEngine, XxxResultsSnapshot> & { <per-game methods> }` instead of a fully hand-written object type, once a task is scoped to take on that refactor across all 9 files at once

### F30 — `00-File-Inventory.md`'s `decisions/frontend/alpine.md` row undercounts its decision blocks
Status: Open · Found: 2026-08-26 · Task: claude/dart-cleanup-timing-xk9ucw
Claim: the row's description says "13 decisions," matching only the file's table-format rows; it was already stale before this task (D187, D206, D233 are block-format entries the count never included) and is now off by one more after this task's D234
Evidence: `docs/architecture/00-File-Inventory.md` row for `decisions/frontend/alpine.md`; `git grep -cE '^\| D[0-9]+ \||^### D[0-9]+' decisions/frontend/alpine.md` currently returns 15
Impact: cosmetic only — the row's `~Nk` size field (what `scripts/check-context-budget.sh` actually validates) was corrected in this task; the decision count in the description text has no gate checking it and can keep drifting silently
Proposed: either recount it to the true total the next time this file is touched, or reword the description to drop the specific count (e.g. "Alpine, stores, state, persist, recovery, x-data, x-show") so it can't go stale again

### F31 — 6 more `*-play.data.ts` files still read `state()` off `engine.state()` instead of folding `$store.game`, the same Alpine reactivity gap issue #161 found in TUOD
Status: Open · Found: 2026-08-26 · Task: claude/dart-cleanup-timing-xk9ucw
Claim: `score-training-play.data.ts`, `doubles-training-play.data.ts`, `around-the-clock-play.data.ts`, `bobs27-play.data.ts`, `singles-training-play.data.ts`, and `shanghai-play.data.ts` all define `state()` as `return this.engine?.state() ?? null;` — reading a plain, non-reactive class instance's internal mutation, not a tracked Alpine store field — the exact pattern issue #161 reported as "the target doesn't update" for TUOD's ANALYTICS + VISUAL_BOARD mode, and that `five-oh-one-play.data.ts`/`one-twenty-one-play.data.ts` were already rewritten to avoid before this task
Evidence: `app/src/lib/game/score-training-play.data.ts:236`, `app/src/lib/game/doubles-training-play.data.ts:88`, `app/src/lib/game/around-the-clock-play.data.ts:159`, `app/src/lib/game/bobs27-play.data.ts:142`, `app/src/lib/game/singles-training-play.data.ts:202`, `app/src/lib/game/shanghai-play.data.ts:99` — each `return this.engine?.state() ?? null;`. Compare `app/src/lib/game/five-oh-one-play.data.ts:185-199`'s `foldFiveOhOneState({stages: this.$store.game.stages, turns: this.$store.game.turns}, config)`, the pattern this task applied to `app/src/lib/game/tuod-play.data.ts`'s `state()`, each with a fold function (`foldScoreTrainingState`, `foldShanghaiState`, etc.) already exported and available for the same substitution
Impact: any Alpine `x-text`/`x-show` expression that calls `state()` (directly, or via a `*For(seatRef)` accessor) subscribes only to `this.engine`'s object identity, which never changes after `init()` — so a dart/attempt recorded via `context.$store.game.recordFacts(facts)` never triggers a re-render of that expression in these 6 games, on any input mode, even though the underlying data is correct. Not verified in a real browser for any of the 6 (no WebKit/Chromium DOM harness in this environment, and `.astro` markup has no test runner per D101), so this is reported as the same-shaped defect already confirmed for TUOD, not independently reproduced per game
Proposed: apply the identical `foldXxxState({stages, turns}, config, ...)` rewrite to each of the 6 files' `state()`, one game (or a small batch) per task so each gets its own regression coverage and gate run, mirroring this task's `tuod-play.data.ts` fix and the pre-existing `five-oh-one-play.data.ts`/`one-twenty-one-play.data.ts` precedent

### F32 — Singles Training's dart preview has the identical seat-unscoped round-index bug Shanghai had (#166)
Status: Open · Found: 2026-08-27 · Task: claude/issue-166-shanghai-preview
Claim: `singles-training-play.data.ts`'s `previewSegmentsFor` computes `targetAt(numbersPath(config.targetOrder), turns.length - 1)` — the same global-turn-count index Shanghai's own `previewSegmentsFor` used before this issue's fix, wrong the moment a 1v1 session's turns from two seats interleave
Evidence: `app/src/lib/game/singles-training-play.data.ts:145-155`; `previewSegments()` (line 256-263) passes `this.$store.game.turns` unfiltered, exactly as Shanghai's did before `docs/superpowers/plans/2026-08-27-shanghai-preview-seat-scoping.md`'s fix; Singles Training supports 1v1 (`app/src/components/layout/games/interfaces/SinglesTraining.astro` renders `SplitScoreboard` with `seats[1]`), so the bug is reachable there the same way it was in Shanghai
Impact: in a 1v1 Singles Training session, the per-dart hit/miss preview strip misclassifies darts once both players have thrown at least once, and can throw (via `targetAt`'s own out-of-range guard) once the combined turn count runs past the target list — same shape as issue #166's report, not yet reported against this ruleset
Proposed: apply the identical fix `shanghai-play.data.ts`'s `previewSegmentsFor` received — derive the round index from a count of turns filtered to the last turn's own `participantRef`, not `turns.length`

### F34 — `visitScoreBandCounts`'s 180 check is an equality test, not the "highest threshold" its contract promises
Status: Open · Found: 2026-08-27 · Task: claude/issue-169-brainstorming-hxzm90
Claim: the function's JSDoc and D238/Pattern 21 both say a visit tallies into whichever is the *highest* threshold its total meets; the implementation checks `score === 180` for the top band while the other three bands use `>=`
Evidence: `app/src/lib/game/play-visit-stats.ts` — `visitScoreBandCounts`'s `if (score === 180) counts.oneEighties += 1;` branch, versus `else if (score >= 140)`/`>= 120`/`>= 100` below it
Impact: inert today — every seeded template's `max_visit_score` is 180 (`database/seeds/0002_default_templates.sql:113,131`, `database/seeds/0004_score_training_minutes_preset.sql:24`) and the engine rejects any visit total above it, so no visit can ever exceed 180. The moment a template is seeded or configured with a higher ceiling, a visit above 180 would fall through to `oneFortyPlus` instead of `oneEighties` — the exact double/wrong-band outcome D238 exists to prevent
Proposed: change the check to `score >= 180`, matching the pattern of the other three bands — a one-character fix once a task is scoped to touch this file again

### F35 — Score Training's per-seat `total` counts open visits; the other seven summary stats do not
Status: Open · Found: 2026-08-27 · Task: claude/issue-169-brainstorming-hxzm90
Claim: `statsFor`'s `total` field is read straight off the engine's `seat.totalScore`, which sums every turn whether open or closed (deliberate, per issue #168); `threeDartAverage`, `firstNineAverage`, `highestScore`, and the four score-band counts all derive from `completedVisits(seatTurns)`, excluding any open visit
Evidence: `app/src/lib/game/score-training-play.data.ts` — `statsFor(seat, turns)`'s `total: seat.totalScore` line versus its calls to `perVisitAverageDisplay`/`firstNineAverageDisplay`/`highestVisitScore`/`visitScoreBandCounts`, all of which filter through `completedVisits` in `app/src/lib/game/play-visit-stats.ts`
Impact: a results snapshot taken while a visit is still open (reachable via the persisted-mirror retry path, not the normal `confirmFinish` route, which always closes the visit first) renders a `Total` no combination of the other seven rows can reproduce — the modal would show, e.g., a total 40 points higher than `highestScore` plus what `threeDartAverage` × visits implies. The old modal showed only Total/Visits/Average, where this gap was invisible; the new eight-row layout makes it legible for the first time. Pre-existing semantics, not introduced by this task — surfaced during issue #169's final whole-branch review
Proposed: decide whether `total` should also derive from `completedVisits` (dropping the open visit's running score from the summary) or whether the open-visit case simply can't reach the results modal in practice and the inconsistency is acceptable — a decision, not an obvious fix either way

### F36 — Results-modal comparison rows put `<dt>`/`<dd>` directly inside a `<div>`, not a `<dl>`
Status: Open · Found: 2026-08-27 · Task: claude/issue-169-brainstorming-hxzm90
Claim: per the HTML spec, `<dt>`/`<dd>` are only valid as children of a `<dl>` (or of a `<div>` that is itself a direct child of a `<dl>`); the 1v1 comparison-row markup wraps them in a plain `<div>` with no enclosing `<dl>`
Evidence: `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro`'s 1v1 comparison-row block (added this task, mirroring the identical structure already shipped in `app/src/components/layout/games/result-modals/ShanghaiResults.astro`) — both files' per-stat rows are `<div class="flex justify-between items-center ..."><dd/><dt/><dd/></div>` with no ancestor `<dl>`
Impact: assistive tech loses the term/definition association between each stat's label and its two values — a screen reader has no structural cue that the `dt`/`dd` triple is a definition-list entry. This task copied the pattern exactly as specified ("mirror Shanghai's existing pattern"), so fixing only `ScoreTrainingResults.astro` would break the mirror and leave the sibling file wrong; it is a two-file cleanup, not a one-file fix
Proposed: wrap each 1v1 comparison block's row-container in a `<dl>` (or restructure to a `<dl>` of alternating `<dt>`/`<dd>` pairs per row) in both `ShanghaiResults.astro` and `ScoreTrainingResults.astro` together, in one task

### F37 — No 1v1 test asserts the reshaped `ScoreTrainingResultsSnapshot`'s top-level `winningSideKey`/`status`
Status: Open · Found: 2026-08-27 · Task: claude/issue-169-brainstorming-hxzm90
Claim: issue #169's reshape moved `winningSideKey`/`status` from a flat object to sitting alongside a new `seats` array, but no added or reshaped test exercises a 1v1 session where the two seats' totals actually differ enough to produce a non-null `winningSideKey` or a `"TIE"` status
Evidence: `app/tests/lib/game/score-training-play.data.test.ts` — the 1v1 test added by this task asserts only `resultsSnapshot?.seats`; every `winningSideKey` assertion in the file (including this task's) is `null`, and its 1v1 fixture's 20-round budget with 3 total turns leaves the engine's fold at `IN_PROGRESS`, so the `status === "TIE" ? "TIE" : "COMPLETE"` collapse in `statsFor`'s call site is exercised only on its trivial branch
Impact: the modal's winner-title and tie-title copy (`ScoreTrainingResults.astro`) are the only consumers of `resultsSnapshot.winningSideKey`/`.status`, and neither branch has regression coverage for the reshaped object's top level — a future change to that collapse or to `winningSideKey`'s passthrough could silently break the winner/tie banner with no test catching it
Proposed: add a 1v1 test that plays both seats to a decided finish with different totals (asserting `winningSideKey` matches the higher-scoring seat's `sideKey`) and, separately, a tie case (`status: "TIE"`, `winningSideKey: null`) — cheap to add once a task is scoped to touch this test file again

### F33 — Around the Clock's dart preview reads the wrong seat's turns during the reveal-then-clear window in 1v1
Status: Open · Found: 2026-08-27 · Task: claude/issue-166-shanghai-preview
Claim: `around-the-clock-play.data.ts`'s `previewSegments()` filters `this.$store.game.turns` down to `state.activeParticipantRef`'s own turns before computing the preview — but `seat-rota.module.ts`'s `activeSeat` rotates to the other seat the instant a turn closes (`completedAt !== null`), before `playCommitDart`'s 1.5s reveal timer even starts, so during that reveal window `state.activeParticipantRef` already names the *next* thrower, not the seat whose darts are fading out
Evidence: `app/src/modules/game/seat-rota.module.ts:53-78` (`activeSeat`'s own doc: "A visit still open always holds its own seat... the thrower keeps the turn until it resolves" — implying, correctly, that a *closed* turn does not); `app/src/lib/game/around-the-clock-play.data.ts:225-235` (`previewSegments()` filters by `state.activeParticipantRef` before calling `previewSegmentsFor`)
Impact: in a 1v1 Around the Clock session, for the 1.5s window after a turn closes, the visible preview strip is scoped to the wrong seat's turn history — at minimum showing a stale/empty strip instead of the just-thrown darts' hit/miss marks, since the newly-active seat's own last turn (if any) is a different turn entirely; not yet reported by a user, found while tracing issue #166's identical-shaped Shanghai bug
Proposed: scope `previewSegments()`'s turn filter to the last turn's own `participantRef` (`this.$store.game.turns.at(-1)?.participantRef`), not `state.activeParticipantRef` — the same fix direction as F32 and this issue's own Shanghai fix, adapted to Around the Clock's `previewSegmentsFor(config, seatTurns, hiddenTurnKey)` signature

### F38 — Issue #169 Part B's own spec names the wrong file for its new shared type
Status: Open · Found: 2026-08-27 · Task: claude/issue-169-brainstorming-hxzm90
Claim: `docs/superpowers/specs/2026-08-27-score-training-rounds-limit-seat-fix-design.md`'s Design section states `ExistingTurnCounts` is defined in `app/src/services/rulesets/types.ts`, but the implementation plan written from that same spec (and the shipped code) correctly places it in `app/src/repositories/interfaces.ts` instead, per `app/CLAUDE.md`'s Controller → Service → Repository type-flow direction and the `ProvisionedPlayer` precedent in that same file
Evidence: `docs/superpowers/specs/2026-08-27-score-training-rounds-limit-seat-fix-design.md:73` (`// app/src/services/rulesets/types.ts`) vs. `docs/superpowers/plans/2026-08-27-score-training-rounds-limit-seat-fix.md:13` and the shipped `app/src/repositories/interfaces.ts`, which both use the repository location
Impact: `docs/superpowers/specs/**` is a historical record (`docs/CLAUDE.md`), so this is not corrected in place; a future reader of the spec alone (not the plan) would look for the type in the wrong file
Proposed: none — historical specs are status notes, never rewritten; noted here only so the discrepancy isn't mistaken for a live doc defect
