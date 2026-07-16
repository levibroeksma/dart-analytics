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

## How to play (V1)

### Visit

One visit of **up to three darts** at the current target. Scoring is X01-style: subtract each dart from the remaining total.

If the checkout lands on dart 1 or 2, the visit **ends immediately**.

### Progress

- **Success** (checkout in ≤3 darts): next target = current + **10** (e.g. 41 → 51 → 61 …).
- **Failure** (no checkout in 3 darts): next target = current − **1** (e.g. 51 → 50).

### Finishing

Each attempt is its own mini-leg. The session is an ongoing ladder; V1 has no fixed end target unless added later.

### Bust

Same idea as X01: if the visit would go past 0, leave 1 under double out, or hit 0 without a double, that visit is a **bust** — darts do not count; score returns to the start of the visit. With only one visit per attempt, a bust means the attempt fails (apply **−1**).

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

- Whether failing below the start score is allowed or floored at 41.
- Whether a bust mid-visit still consumes the whole attempt (yes in V1 description above).
