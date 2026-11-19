---
id: D0309
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [frontend/architecture, types]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The score-training/TUOD twin is deduplicated to the line, not to the structure

## Context and Problem Statement
issue #282 reported the duplication percentage rising after an earlier dedup pass, because a near-miss detector bridged a longer span once the divergent bodies between the matches were removed. A function-by-function comparison showed the reported group is not one extractable body: three helpers are byte-identical between the two files, three differ only in type annotations, and three differ behaviourally — Score Training's bot always fires treble 20 via `chooseTarget()`, while TUOD's aims at the seat's own `currentTarget` and routes stats through `tuodCheckoutVisits`. Extracting the last three would fuse two rulesets that genuinely differ, to move a lagging metric. Issue #281 is the same argument at the type level: nine hand-written restatements of one generic drift independently, and the generic already existed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the six helpers `app/src/lib/game/score-training-play.data.ts` and `app/src/lib/game/tuod-play.data.ts` duplicated between themselves for no reason — `findBotSeat`, `botDartIndex`, `formatRemaining`, `startCountdown`, `maybeResumeCountdown` and `resumeEngine` — are extracted into `app/src/lib/game/play-bot-seat.ts`, `app/src/lib/game/play-countdown.ts` and `app/src/lib/game/play-lifecycle.ts` (the last as the generic `resumeGameEngine`), and those two files now import them. This is a two-file scope, not a sweep: the other seven play-data files still declare their own `findBotSeat`/`botDartIndex`/`DartbotSeat`/`resumeEngine`, and `app/src/lib/game/one-twenty-one-play.data.ts` still declares its own countdown trio. Pointing them at the shared modules is separate work on its own branch. `throwOneDart`, `throwBotDart` and `statsFor` stay duplicated on purpose. Separately, the nine `*PlayContext` types in `app/src/lib/game/types.ts` are now defined as `PlayLifecycleContext<TConfig, TEngine, TResults> & { per-game members }` instead of restating the shared type's 17 members by hand.".

### Consequences
`npx fallow` went from 5,170 duplicated lines (13.4%, 63 files) to 5,139 (13.4%, 66 files) — the percentage is unchanged to one decimal because the extracted helpers are small relative to the corpus, while the clone family spanning `one-twenty-one-play.data.ts`, `score-training-play.data.ts` and `tuod-play.data.ts` fell from 6 groups / 190 lines to 4 groups / 102 lines. Whole-file structural similarity between the two files remains and will still be reported. That residue is the same class F27 declined on the engine side, and it is now measured rather than assumed. If the two rulesets ever diverge further, the right response is to let them — not to re-open this extraction. The four structural types the new modules need (`DartbotSeat`, `CountdownGame`, `ExpirableEngine`, `CountdownConfig`) live in `app/src/lib/game/types.ts` rather than beside their functions, because `scripts/check-type-barrels.sh` forbids an implementation file from declaring an exported type.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-18
Refines: D232
