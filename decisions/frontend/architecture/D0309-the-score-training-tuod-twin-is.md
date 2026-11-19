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

# The score-training/TUOD twin is deduplicated to the line, not to the structure

## Context and Problem Statement
issue #282 reported the duplication percentage rising after an earlier dedup pass, because a near-miss detector bridged a longer span once the divergent bodies between the matches were removed. A function-by-function comparison showed the reported group is not one extractable body: three helpers are byte-identical between the two files, three differ only in type annotations, and three differ behaviourally — Score Training's bot always fires treble 20 via `chooseTarget()`, while TUOD's aims at the seat's own `currentTarget` and routes stats through `tuodCheckoutVisits`. Extracting the last three would fuse two rulesets that genuinely differ, to move a lagging metric. Issue #281 is the same argument at the type level: nine hand-written restatements of one generic drift independently, and the generic already existed. Issue #282's own proposed fix was to wait for the two rulesets to diverge. The technical-debt sweep spec records that the owner chose to act instead, and that the generic context types of #281 make the extraction tractable.

## Decision Drivers
* Issue #282 reported total duplication rising from 11.4% to 12.2% after an earlier dedup pass.
* Issue #281: nine hand-written `*PlayContext` types restate one generic and drift independently.
* The extraction must not change observable play behaviour; the spec keeps stop-and-report a legitimate outcome.

## Considered Options
* Extract the six helpers that are byte-identical or differ only in type annotations, and define the nine contexts through `PlayLifecycleContext`.
* Also extract `throwOneDart`, `throwBotDart` and `statsFor` through a shared factory.
* Leave the twin until the two rulesets diverge, the original proposal in issue #282.

## Decision Outcome
Chosen option: "the six helpers `app/src/lib/game/score-training-play.data.ts` and `app/src/lib/game/tuod-play.data.ts` duplicated between themselves for no reason — `findBotSeat`, `botDartIndex`, `formatRemaining`, `startCountdown`, `maybeResumeCountdown` and `resumeEngine` — are extracted into `app/src/lib/game/play-bot-seat.ts`, `app/src/lib/game/play-countdown.ts` and `app/src/lib/game/play-lifecycle.ts` (the last as the generic `resumeGameEngine`), and those two files now import them. This is a two-file scope, not a sweep: the other seven play-data files still declare their own `findBotSeat`/`botDartIndex`/`DartbotSeat`/`resumeEngine`, and `app/src/lib/game/one-twenty-one-play.data.ts` still declares its own countdown trio. Pointing them at the shared modules is separate work on its own branch. `throwOneDart`, `throwBotDart` and `statsFor` stay duplicated on purpose. Separately, the nine `*PlayContext` types in `app/src/lib/game/types.ts` are now defined as `PlayLifecycleContext<TConfig, TEngine, TResults> & { per-game members }` instead of restating the shared type's 17 members by hand.".

### Consequences
`npx fallow` went from 5,170 duplicated lines (13.4%, 63 files) to 5,139 (13.4%, 66 files) — the percentage is unchanged to one decimal because the extracted helpers are small relative to the corpus, while the clone family spanning `one-twenty-one-play.data.ts`, `score-training-play.data.ts` and `tuod-play.data.ts` fell from 6 groups / 190 lines to 4 groups / 102 lines. Whole-file structural similarity between the two files remains and will still be reported. That residue is the same class F27 declined on the engine side, and it is now measured rather than assumed. If the two rulesets ever diverge further, the right response is to let them — not to re-open this extraction. The four structural types the new modules need (`DartbotSeat`, `CountdownGame`, `ExpirableEngine`, `CountdownConfig`) live in `app/src/lib/game/types.ts` rather than beside their functions, because `scripts/check-type-barrels.sh` forbids an implementation file from declaring an exported type.

* Good, because the clone family spanning `one-twenty-one-play.data.ts`, `score-training-play.data.ts` and `tuod-play.data.ts` fell from 6 groups / 190 lines to 4 groups / 102 lines.
* Bad, because total duplication stays at 13.4% to one decimal, and whole-file structural similarity between the two files is still reported.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's acceptance list (§ 4.4) names four bullets, three of them checks. `npx fallow` must pass as a blocking CI gate with total duplication below the post-P1 baseline, which `.github/workflows/quality.yml` runs through `scripts/fallow-gate.sh`. `npm run check` must be clean. Existing assertions under `app/tests/lib/game/` and `app/tests/modules/game/` must pass without being weakened, deleted or re-pointed.

## Pros and Cons of the Options
### Extract the six helpers and re-derive the nine contexts (chosen)

* Good, because the function-by-function comparison found three helpers byte-identical and three differing only in type annotations, so the move changes no behaviour.
* Bad, because the duplication percentage does not move to one decimal.

### Also extract `throwOneDart`, `throwBotDart` and `statsFor`

* Bad, because the three differ behaviourally: Score Training always fires treble 20 via `chooseTarget()`, while TUOD aims at the seat's `currentTarget` and routes stats through `tuodCheckoutVisits`. A shared factory would fuse two rulesets to move a lagging metric.

### Leave the twin until the rulesets diverge

* Neutral, because spec § 4.5 keeps this a legitimate outcome if extraction cannot avoid changing play behaviour. The issue had sat open for weeks under this verdict.

## Evidence / More Information
Decided: 2026-09-18
Refines: D232

* `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` (§ 1, § 4.1–4.5): rebuilt Context, Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-09-17-p2-play-context-dedup.md` (Goal, Global Constraints, file table): rebuilt Decision Drivers and Confirmation.
* Commit `0c29c61c` (2026-09-18; adds the `decisions/frontend/architecture.md` row): rebuilt Consequences.
* Applied in: `docs/superpowers/plans/2026-10-20-916-pr-a-bot-helpers.md`, `docs/superpowers/plans/2026-10-20-916-pr-b-lifecycle-guards.md`, `docs/superpowers/plans/2026-10-20-916-pr-c-engine-refusal-guard.md`.
