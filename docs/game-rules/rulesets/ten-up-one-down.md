# Ten Up One Down

Current version: V1 (shipped 2026-08-20)
Entry points: standalone, routine step

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (1v1) | V1 | 1v1 | |
| Config screen (presets shown) | V1 | All | |
| Start target 41 | V1 | All | |
| Attempt = one visit (3 darts) | V1 | All | |
| Double out checkout | V1 | All | |
| Ten up: success → target +10 | V1 | All | |
| One down: failure → target −1 | V1 | All | |
| Floor at 2 (minimum finishable double-out target) | V1 | All | |
| Floor at start score (cannot drop below 41) | V2+ | All | Wanted, unscheduled: `TuodConfig` models no ladder floor beyond the hard 2, and whether the ladder should stop at 41 is still an open question below |
| Bust within the visit | V1 | All | |
| Climb cap / end target | V2+ | All | Wanted, unscheduled: `TuodConfig` carries no cap key — the session is bounded by `duration_type`/`duration_value` and the ladder itself never wins |
| Alternate start score | V2+ | All | Wanted, unscheduled: `TuodConfig.starting_target` exists, but both seeded presets fix it at 41 (`0002_default_templates.sql`) and no setup control offers another value |
| Alternate step sizes (+10 / −1) | V2+ | All | Wanted, unscheduled: `finish_bonus` and `miss_penalty` exist for the same reason and are fixed at 10 and 1 by the same seeded presets |
| Runs as a routine step (timed) | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

Checkout ladder under pressure: start at **41**, try to finish in **one visit (3 darts)**. Make it → jump **+10**; miss → drop **−1**. Trains short finishes and recovery. Standard dartboard scoring is assumed; finish on a double. (Source note: “starts at 41, 3 darts to finish, success move 10 up, failure go 1 down.”)

## Objective

- **Attempt:** from the current target, reach **exactly 0** on a **double** within **three darts**.
- **Session (V1):** keep climbing (+10) on success and slipping (−1) on failure until the player stops or hits a later end condition.
- **1v1:** ROUNDS mode only. Both seats play the full round budget; highest target reached wins (score-compare, ties possible). <!-- 2026-08-22 --> The round count is player-configurable (1–100) rather than fixed at the 10-round preset. <!-- 2026-08-26 --> Solo play is configurable the same way: either mode's `duration_value` is player-typed (ROUNDS 1–100, MINUTES 3–30), not a locked preset pick. <!-- 2026-08-29 -->

## Config & presets

Before play, a **config screen** shows the session config. Setup radios select the **mode** (Rounds / Time), not preset names.

| Setting           | V1 default          | On config screen (V1) |
| ----------------- | -------------------- | ---------------------- |
| Players           | 1 seat, or 2 (guest or DartBot), Rounds mode only | Editable |
| Start target      | 41                    | Shown, locked           |
| Darts per attempt | 3 (one visit)         | Shown, locked           |
| Out               | Double out            | Shown, locked           |
| On success        | +10 to next target    | Shown, locked           |
| On failure        | −1 to next target     | Shown, locked           |
| Mode              | Rounds or Time        | Toggle                  |
| Rounds (N)        | Default **10** (min **1**, max **100**) | Editable when Rounds |
| Minutes           | Default **10** (min **3**, max **30**)  | Editable when Time   |

## How to play

### Visit

One visit of **up to three darts** at the current target. Scoring is X01-style: subtract each dart from the remaining total.

If the checkout lands on dart 1 or 2, the visit **ends immediately**.

### Progress

- **Success** (checkout in ≤3 darts): next target = current + **10** (e.g. 41 → 51 → 61 …).
- **Failure** (no checkout in 3 darts): next target = current − **1**, floored at **2** — the minimum target any double can finish (e.g. 51 → 50; 3 → 2; 2 → 2).

### Finishing

Each attempt is its own mini-leg. The session is an ongoing ladder; V1 has no fixed end target unless added later.

The **ladder** having no win condition and the **session** having an end are separate axes. V1 ends the session by duration — the seeded presets carry `duration_type` (`ROUNDS`/`MINUTES`) and `duration_value`, exactly as Score Training does — while the ladder itself never "wins". <!-- 2026-07-26 -->

### Bust

Same idea as X01: if the visit would go past 0, leave 1 under double out, or hit 0 without a double, that visit is a **bust** — darts do not count; score returns to the start of the visit. With only one visit per attempt, a bust means the attempt fails (apply **−1**).

**Resolved (V1):** a bust consumes the whole attempt and applies the −1, exactly like any other failure. There is no re-throw and no partial credit; the engine records a busted attempt as a zero-scoring turn, indistinguishable from a plain miss. <!-- 2026-07-26 -->

**Early bust on an unfinishable remainder (V1, ANALYTICS + VISUAL_BOARD):** once only one dart remains in the visit, a remaining target that no double can reach can never be checked out, so the visit busts immediately instead of requiring the last dart to be thrown. Two shapes of remainder qualify: odd (and above 1) — every double scores an even number — and even but above **40** and not **50** — the highest double is D20 (40), and the only score above it a single dart can still finish on is the bull (50). This is TUOD-specific: 501 and 121 still require every dart in the visit to be thrown regardless of whether checkout remains mathematically possible. <!-- 2026-08-26; even-remainder-above-40 case added 2026-08-28 -->

### Ends when

The configured duration runs out, and nothing else — the ladder itself never
wins:

- **Rounds mode** — after **N** attempts (1–100, default 10).
- **Time mode** — when the **M**-minute clock reaches 0 (3–30, default 10); the
  attempt in progress finishes first.

**Single:** the one seat plays its own budget out.

**1v1:** Rounds mode only. Both seats play the full round budget and neither is
cut short; the match ends once both are done. Highest target reached wins; equal
targets is a tie, with no tiebreak. A DartBot seat counts as the opponent seat.

As a routine step, none of this applies: the step inherits the duration the
routine allocated it, and the routine's own summary replaces the result below.

### Result

The highest target reached, attempts made, successes and failures. In 1v1, the
winning seat beside both seats' highest targets, or a tie.

## Capture

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE — one attempt per turn, **no dart rows**.
- **One dart's fact:** none. TUOD does not record individual darts in V1; the unit of capture is the attempt, because the ladder depends only on whether the attempt checked out.
- **Turn total:** the target just attempted when the attempt checked out on a double — the player scored exactly that — and `0` for any failure, a bust included.
- **Stage type:** one `EXERCISE_BLOCK` for the whole session. Attempts are turns inside it; the ruleset has no per-attempt stage.
- **Derived, never stored:** the ladder position (current target), attempts, successes and failures — all folded from the turn totals.

## Known limitations

**Under RECREATIONAL + QUICK_SCORE, a bust cannot be told apart from a scoreless attempt**: both persist as a turn total of `0` with no dart rows. Bust rate is therefore not computable under this capture mode, and checkout percentage undercounts attempts. Recovering either requires DETAILED_DARTS/VISUAL_BOARD capture or a schema revision adding an attempted-score / void-visit fact for QUICK_SCORE itself; QUICK_SCORE sessions remain unfixable, since completed gameplay is immutable and no per-dart fact exists to recover from. <!-- 2026-07-26 -->

**Retired for ANALYTICS + VISUAL_BOARD sessions.** Every dart carries a real landing coordinate and score, so a bust and a plain miss are distinguishable by the pattern in the persisted darts: a bust's darts show an overshoot, a remaining score of exactly 1, or reaching 0 without the last dart in a double; a miss's three darts land short of the target with none of those patterns. No `v_*` view yet queries this distinction — the fact log supports it, and building the view is future work. <!-- 2026-08-20 -->

## Later versions

### Variants

- Optional **floor**: never drop below the start score (41) — separate from, and higher than, the V1 double-out-minimum floor at 2
- Configurable start score and step sizes
- **End target**: win when you successfully check out a chosen high finish
- Multiplayer: shared ladder or alternate attempts

### Match structure

- Race to a cap; best streak; first to N successful checkouts

## Glossary

| Term         | Version | Meaning                                       |
| ------------ | ------- | --------------------------------------------- |
| **Ten up**   | V1      | Successful 3-dart checkout → next target +10. |
| **One down** | V1      | Failed attempt → next target −1.              |
| **Attempt**  | V1      | One visit at the current target.              |

## Open questions

- ~~Whether the ladder floors below the double-out minimum (2).~~ **Resolved (V1):** yes — the ladder floors at **2**, the minimum target any double can finish. A failure at target 2 stays at 2 rather than falling further; see Progress above. <!-- 2026-07-26 -->
- Whether failing below the start score is floored at **41** instead. **Still open, deferred to V2+.** This is a separate, higher floor from the V1 floor at 2 above — an optional variant (see Later versions), not required for V1. <!-- 2026-07-26 -->
- ~~Whether a bust mid-visit still consumes the whole attempt.~~ **Resolved for V1:** yes — see Bust above. <!-- 2026-07-26 -->
