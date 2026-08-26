# Ten Up One Down

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                     | Version |
| ------------------------------------------- | ------- |
| Single player                               | v1      |
| Multiplayer                                 | TBD     |
| Config screen (presets shown)               | v1      |
| Start target 41                             | v1      |
| One visit (3 darts) per attempt             | v1      |
| Double out checkout                         | v1      |
| Success: target +10                         | v1      |
| Failure: target −1                          | v1      |
| Floor at 2 (minimum finishable double-out target) | v1 |
| Floor at start score (cannot drop below 41) | TBD     |
| Bust within the visit                       | v1      |
| Climb cap / end target                      | TBD     |
| Alternate start score                       | TBD     |
| Alternate step sizes (+10 / −1)             | TBD     |
| Standard dartboard scoring (assumed)        | v1      |

## Identity

Checkout ladder under pressure: start at **41**, try to finish in **one visit (3 darts)**. Make it → jump **+10**; miss → drop **−1**. Trains short finishes and recovery. Standard dartboard scoring is assumed; finish on a double. (Source note: “starts at 41, 3 darts to finish, success move 10 up, failure go 1 down.”)

## Objective

- **Attempt:** from the current target, reach **exactly 0** on a **double** within **three darts**.
- **Session (V1):** keep climbing (+10) on success and slipping (−1) on failure until the player stops or hits a later end condition.
- **1v1:** ROUNDS mode only. Both seats play the full round budget; highest target reached wins (score-compare, ties possible). <!-- 2026-08-22 --> The round count is player-configurable (1–100) rather than fixed at the 10-round preset. <!-- 2026-08-26 -->

## Config & presets (V1)

Before play, a **config screen** shows the session presets.

| Setting           | V1 preset          | On config screen (V1) |
| ----------------- | ------------------ | --------------------- |
| Players           | Single player      | Shown, locked         |
| Start target      | 41                 | Shown, locked         |
| Darts per attempt | 3 (one visit)      | Shown, locked         |
| Out               | Double out         | Shown, locked         |
| On success        | +10 to next target | Shown, locked         |
| On failure        | −1 to next target  | Shown, locked         |
| Session length    | 10 rounds *or* 10 minutes | Preset choice  |

## How to play (V1)

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

**Early bust on an unfinishable odd remainder (V1, ANALYTICS + VISUAL_BOARD):** once only one dart remains in the visit, a remaining target that is odd (and above 1) can never be checked out — every double scores an even number — so the visit busts immediately instead of requiring the last dart to be thrown. This is TUOD-specific: 501 and 121 still require every dart in the visit to be thrown regardless of whether checkout remains mathematically possible. <!-- 2026-08-26 -->

## Capture

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE — one attempt per turn, **no dart rows**.
- **One dart's fact:** none. TUOD does not record individual darts in V1; the unit of capture is the attempt, because the ladder depends only on whether the attempt checked out.
- **Turn total:** the target just attempted when the attempt checked out on a double — the player scored exactly that — and `0` for any failure, a bust included.
- **Stage type:** one `EXERCISE_BLOCK` for the whole session. Attempts are turns inside it; the ruleset has no per-attempt stage.
- **Derived, never stored:** the ladder position (current target), attempts, successes and failures — all folded from the turn totals.

## Known limitations

**Under RECREATIONAL + QUICK_SCORE, a bust cannot be told apart from a scoreless attempt**: both persist as a turn total of `0` with no dart rows. Bust rate is therefore not computable under this capture mode, and checkout percentage undercounts attempts. Recovering either requires DETAILED_DARTS/VISUAL_BOARD capture or a schema revision adding an attempted-score / void-visit fact for QUICK_SCORE itself; QUICK_SCORE sessions remain unfixable, since completed gameplay is immutable and no per-dart fact exists to recover from. <!-- 2026-07-26 -->

**Retired for ANALYTICS + VISUAL_BOARD sessions.** Every dart carries a real landing coordinate and score, so a bust and a plain miss are distinguishable by the pattern in the persisted darts: a bust's darts show an overshoot, a remaining score of exactly 1, or reaching 0 without the last dart in a double; a miss's three darts land short of the target with none of those patterns. No `v_*` view yet queries this distinction — the fact log supports it, and building the view is future work. <!-- 2026-08-20 -->

## Later versions (V2+)

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
