---
id: D0219
status: accepted
date: 2026-08-20
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, fact log, 501, Score Training, undo, visit, bust]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Ten Up One Down joins the dual-capture set (ANALYTICS + VISUAL_BOARD)

## Context and Problem Statement
TUOD (D153/D216/D217) was the only ruleset left declaring `RECREATIONAL + QUICK_SCORE` alone — 501, Score Training and 121 had already paired it with `ANALYTICS + VISUAL_BOARD` (D189/D198, `2026-08-15-121-shanghai-atc-analytics-design.md`). Doing the same for TUOD was also the chosen way to resolve the ruleset doc's own stated known limitation (bust indistinguishable from a scoreless miss): real per-dart facts under `VISUAL_BOARD` make the two recomputable from the fact log alone, with no new field — an explicit design goal for this work, not an incidental side effect.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`TuodEngine` gains a second `record()`/`undo()`/`wouldComplete()` shape for `DartObservation`, dispatching on input shape per D198, never on stored mode — mirrors `OneTwentyOneEngine`'s dual-shape dart path, simplified because TUOD has exactly one visit per attempt and one `EXERCISE_BLOCK` stage for the whole session (no per-round stage bookkeeping to add). `tuodValidator.validateConfig` now accepts `ANALYTICS + VISUAL_BOARD` via `isQuickScoreOrVisualBoardCapture`, and `validateBatch` dispatches to `validateVisualBoardTurns` under it. `RULESET_CAPABILITIES.TUOD_V1` becomes `[QUICK_SCORE, VISUAL_BOARD]`, mirrored into seed `0007` and its verification script. `TenUpOneDown.astro` renders `BoardInputPanel` and hides the keypad under `VISUAL_BOARD`, exactly like `OneTwentyOne.astro`/`FiveOhOne.astro`; the D217 `CheckoutConfirm` dialog stays QUICK_SCORE-only, bypassed entirely under board capture the same way 501/121 already bypass their own keypad confirm.".

### Consequences
`docs/game-rules/rulesets/ten-up-one-down.md`'s Known Limitations section is now scoped to `QUICK_SCORE` and gains a "Retired for VISUAL_BOARD sessions" note, matching D189's wording for 501. No `v_*` view yet surfaces the newly-derivable bust/miss distinction — that remains future work. F10 (the ladder's missing ceiling) is untouched, an unrelated open finding. `capabilities.test.ts`'s "rejects visual board for a game with no visual engine path" assertion (written when TUOD was the one ruleset without a board path) and `games-visibility.test.ts`'s TUOD-specific active-session carve-out test are both removed as no-longer-true special cases, not re-pointed at a different guarantee — the games-visibility generic "never hides a game with an active session" test already covers TUOD once it is ANALYTICS-capable. The verification script `database/verification/0007_capability_seed_checks.sql` also had its row-count assertions corrected to the actual 17 → 18 (not the previously-assumed 14 → 15): the script had already drifted stale before this task, undercounting three rows other rulesets' own `VISUAL_BOARD` additions had already added to the seed without a matching update here.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-20
