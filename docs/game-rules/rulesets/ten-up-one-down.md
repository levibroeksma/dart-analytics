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
- **Failure** (no checkout in 3 darts): next target = current − **1** (e.g. 51 → 50).

### Finishing

Each attempt is its own mini-leg. The session is an ongoing ladder; V1 has no fixed end target unless added later.

The **ladder** having no win condition and the **session** having an end are separate axes. V1 ends the session by duration — the seeded presets carry `duration_type` (`ROUNDS`/`MINUTES`) and `duration_value`, exactly as Score Training does — while the ladder itself never "wins". <!-- 2026-07-26 -->

### Bust

Same idea as X01: if the visit would go past 0, leave 1 under double out, or hit 0 without a double, that visit is a **bust** — darts do not count; score returns to the start of the visit. With only one visit per attempt, a bust means the attempt fails (apply **−1**).

**Resolved (V1):** a bust consumes the whole attempt and applies the −1, exactly like any other failure. There is no re-throw and no partial credit; the engine records a busted attempt as a zero-scoring turn, indistinguishable from a plain miss. <!-- 2026-07-26 -->

## Capture

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE — one attempt per turn, **no dart rows**.
- **One dart's fact:** none. TUOD does not record individual darts in V1; the unit of capture is the attempt, because the ladder depends only on whether the attempt checked out.
- **Turn total:** the target just attempted when the attempt checked out on a double — the player scored exactly that — and `0` for any failure, a bust included.
- **Stage type:** one `EXERCISE_BLOCK` for the whole session. Attempts are turns inside it; the ruleset has no per-attempt stage.
- **Derived, never stored:** the ladder position (current target), attempts, successes and failures — all folded from the turn totals.

## Known limitations

**A target below 2 cannot be finished.** V1 has no ladder floor, so a long run of failures can walk the target below the minimum double-out finish (D1 = 2). The engine keeps the ladder falling — that is the no-floor rule — but refuses to record a *checkout* claimed on such a target, since no dart can produce it. A session stranded there can only record failures. Whether the ladder should instead floor at the start score is the open question below. <!-- 2026-07-26 -->

**A bust cannot be told apart from a scoreless attempt**, for the same reason 501 cannot: both persist as a turn total of `0` with no dart rows. Bust rate is therefore not computable, and checkout percentage undercounts attempts. Recovering either requires DETAILED_DARTS capture or a schema revision adding an attempted-score / void-visit fact; both are on the deferred list in `DECISIONS.md`. <!-- 2026-07-26 -->

## Later versions (V2+)

### Variants

- Optional **floor**: never drop below the start score (41)
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

- Whether failing below the start score is allowed or floored at 41. **Still open.** V1 ships no floor, so the target may fall below 41 and, given enough failures, below the finishable minimum of 2 — see Known limitations. A floor is a product decision, not an engine one. <!-- 2026-07-26 -->
- ~~Whether a bust mid-visit still consumes the whole attempt.~~ **Resolved for V1:** yes — see Bust above. <!-- 2026-07-26 -->
