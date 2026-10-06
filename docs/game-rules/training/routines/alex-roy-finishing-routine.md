# Alex Roy's Finishing Routine

Current version: none (V1 in design)

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Steps run in order: doubles round, outshots 80–100, twenties challenge | V1 | All | |
| Step 1: Doubles round, 10 minutes | Deferred | All | Blocked on: Doubles Training is not routine-eligible — the eligible ruleset versions are `TUOD_V1`, `SCORE_TRAINING_V1`, `121_V2`, `AROUND_THE_CLOCK_V2` (`docs/architecture/09-Training/01-Routines.md` §11) — and the source's "hit them all" needs Hard mode, which is V2+ (`../../rulesets/doubles-training.md` §Features) |
| Step 2: Outshots 80–100, no bull finish, 15 minutes | Deferred | All | Blocked on: Catch 40 (`../exercises/catch-40.md`) has no setting that bars the bullseye as the finishing dart, and the source gives no dart limit per outshot |
| Step 3: Twenties challenge, 30 minutes | V1 | All | |
| Beginner timing | Deferred | All | Blocked on: the source's beginner timing for step 2 (30–40 minutes) puts the total at 70–80 minutes, over the 60-minute cap (§7); it needs the multi-block training concept §7 leaves out of scope |
| Training ends when step 3 ends | V1 | All | |

The routine as a whole cannot ship above its weakest step: while steps 1 and 2
are `Deferred` and Frustration is in design, so is the routine.

## Identity

- A finishing-first session: a lap of the doubles, a run of outshots, then
  score-and-finish pressure. "Finishing is the way you win games." Source:
  Shot Darts, "Practise game 2", Alex Roy
  (https://www.shotdarts.com/blog/practise-game-2, read 2026-10-06).
- System routine.

## Objective

**Single:** one player runs every step; the steps are solo.

- Hit doubles under setup pressure as reliably as from a clean start.

## Steps

| # | Exercise type | Configuration | Duration |
| --- | --- | --- | --- |
| 1 | `GAME` — Doubles Training (no template; see Features) | Low → high, ending on the bull | 10 minutes |
| 2 | Catch 40 (`../exercises/catch-40.md`) | First outshot 80, last 100, no bull finish | 15 minutes |
| 3 | Frustration (`../exercises/frustration.md`) | Targets D1 → D20 (no bullseye) | 30 minutes |

Step rules live in their files: `../../rulesets/doubles-training.md`,
`../exercises/catch-40.md`, `../exercises/frustration.md`. Step 3 is the
source's "twenties challenge" — 80 or more with two darts at the twenties,
then dart 3 at the double — which is Frustration's rule; the routine
overrides only its target list. Step 2 uses the source's advanced timing
(10–15 minutes).

## Total duration

- 10 + 15 + 30 = **55 minutes**.
- Satisfies `0 < duration <= 60 minutes` (§7). As a system routine it has no
  30-minute floor (D305); it would meet one anyway.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Steps and order | As Steps | Shown, locked |
| Step durations | 10, 15, 30 minutes | Shown, locked |

## Ends when

- The last step ends. Abandoning part-way follows the routine player's shared
  behaviour; this routine adds nothing to it.

## Result

- The training summary, one line per step: Doubles Training's hit ratios,
  Catch 40's points and checkouts, Frustration's attempts and targets
  cleared. The routine adds no number of its own.

## Later versions

### Variants

- **Beginner timing** — step 2 at 30–40 minutes. Needs either a shorter
  step 3 or a second training block.

### Other

- Steps 1 and 2 land as their blockers clear; the composition does not
  change.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Twenties challenge** | V1 | The source's name for step 3: Frustration on D1–D20 |
| **Beginner timing** | Deferred | Step 2 at 30–40 minutes |

## Open questions

- Step 3: the source sets 30 minutes as a limit to clear D1–D20. Does the
  step end early once D20 is cleared, leaving the training short?
- Step 2: is "cannot finish on the bullseye" a Catch 40 setting worth adding,
  or should the step simply use Catch 40 as written?
- Step 1: Easy mode (advance after every visit) is shipped; is it close
  enough to "go around the doubles in 10 minutes" to unblock the step once
  Doubles Training is routine-eligible?
