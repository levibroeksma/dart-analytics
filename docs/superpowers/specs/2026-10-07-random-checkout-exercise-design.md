# Random Checkout exercise — design

Date: 2026-10-07
Input: `docs/game-rules/training/exercises/random-checkout.md` (rules, V1 cut, defer list; open questions resolved 2026-10-07)
Precedent: `CHECKOUT_SEQUENCE_V1` (`app/src/modules/training/exercises/checkout-sequence.engine.module.ts`, PR #804); DartBot seed (`generateBotSeed`, `app/src/lib/id.ts`)

## 1. Scope

New exercise type `RANDOM_CHECKOUT`, ruleset `RANDOM_CHECKOUT_V1`, template
"Random Checkout", routine step only. Offered by the routine builder via
`v_exercise_template_catalog` once seeded. No standalone page, no seeded
routine, no schema change. Configurable range, fixed-round bound, average
darts per checkout and head-to-head stay `V2+`.

Own engine. Shares the X01 rule `resolveCheckoutAttempt`
(`app/src/modules/game/checkout-bust.module.ts`) with Catch 40.

## 2. Resolved open questions

- **Where the drawn start score lives:** nowhere. The run's **draw seed** is
  the stored fact; every start score is derived from it. No turn or dart
  column carries a per-visit start score, and a seed needs none.
- **Draw shape:** uniform over the finishable scores in range. Weighting
  toward common finishes is not sourced; not proposed.

## 3. Persistence

- **Capture/input mode:** `ANALYTICS` + `VISUAL_BOARD`, no game pair (D277).
  Type key joins `DART_EXERCISE_TYPE_KEYS`; ruleset key joins
  `DART_WRITING_RULESET_VERSION_KEYS`.
- **Stage type:** one `EXERCISE_BLOCK` (`exerciseBlockStage()`).
- **`turns`:** one per attempt; an attempt is exactly one visit and closes on
  a checkout, a bust or its third dart. `totalScore` = board sum
  (`appendObservedDart`), never zeroed on bust.
- **`darts`:** one row per thrown dart, free aim (both intended columns
  null). No row for darts not thrown after a bust. Board `score` on every dart.
- **Stored fact:** `drawSeed` in the run's `exercise_configurations` snapshot
  (immutable, `0005_runtime_core.sql`).
- **Derived only:** each attempt's start score, remaining, bust, checked out,
  checkouts, attempts, checkout rate.

## 4. Draw

- **Pool:** the scores `minStart..maxStart` with a three-dart double-out —
  40–170 minus 159, 162, 163, 165, 166, 168, 169: 124 scores, ascending.
- **Draw:** attempt *n* (0-based) starts from
  `pool[floor(u × pool.length)]`, `u` the first uniform of a PRNG keyed by
  `(drawSeed, n)`.
- **Index-keyed, not stream-keyed:** a draw depends on the seed and the
  attempt index only — never on earlier darts. Replay is deterministic, and
  undo cannot change a later draw.
- **One PRNG:** `hashSeed` + `mulberry32` move out of
  `app/src/modules/dartbot/rng.module.ts` into a shared
  `app/src/modules/game/seeded-rng.module.ts` (no `modules/shared/` exists; `game/` already holds cross-engine rules such as `checkout-bust.module.ts`) exporting
  `seededUniform(seed, index): () => number`. `createDartRng` keeps its
  signature and output, built on it; DartBot callers unchanged. Existing
  DartBot tests prove the move is output-preserving.
- **Frozen per ruleset version:** the pool and the PRNG are part of
  `RANDOM_CHECKOUT_V1`. Changing either is a new ruleset version, never an
  edit — a stored seed must replay to the same scores forever.

## 5. Configuration

```ts
RandomCheckoutV1Config = z.object({
  minStart: z.literal(40),
  maxStart: z.literal(170),
  drawSeed: z.number().int().min(0).max(0xffffffff),
}).strict();
```

- Range lives in config so a configurable range later widens the schema, not
  the type. V1 accepts only 40–170.
- `drawSeed` is **server-minted**: `training-session.service.ts` sets it with
  `generateDrawSeed()` (new, beside `generateBotSeed` in `app/src/lib/id.ts`,
  Web Crypto) after `mergedConfiguration` and before
  `stepConfigurationIssues`, as `injectGameStepDuration` does. It overwrites
  any template or step value, so no client or saved routine can fix the draws.
- Template `default_configuration` carries no seed; the validator requires
  one, so an uninjected snapshot fails validation instead of persisting.
- Duration is routine-step configuration (10-minute preset, draft value).

## 6. Engine — `RandomCheckoutEngine`

File: `app/src/modules/training/exercises/random-checkout.engine.module.ts`.
Pure fold over turns in write order; attempt *n* = turn *n*.

Per turn, start = `drawStartScore(config, n)`; walk its darts with
`resolveCheckoutAttempt(remaining, score, zone ∈ {DOUBLE, INNER_BULL})`:

- **checked out** → `checkouts++`, `attempts++`, turn closed.
- **bust** → `attempts++`, turn closed (failed).
- **third dart, no checkout** → `attempts++`, turn closed (failed).
- fewer darts and no close → open attempt; `remaining` shows the walked value.

Turn closure is derived from the darts, never read from `completedAt`.

State (`RandomCheckoutState`, `app/src/modules/training/exercises/types.ts`):
`startScore` (current attempt), `remaining`, `dartsInVisit`, `checkouts`,
`attempts` (judged only), `lastAttempt` (`"CHECKOUT" | "FAILED" | null`),
`dartsThrown`, `status`.

- `record()` opens/continues the attempt via `openOrCreateTurn`; stamps
  `completedAt` when the dart closes it.
- **Time-bound only:** `isComplete()` is true once the timer expired
  (`expireTimer()`, D264). An attempt open at expiry is not judged — not in
  `attempts`, its darts still recorded and counted in `dartsThrown`.
- `undo()` un-expires first, else pops the last dart (`undoLastDart`).
- `foldRandomCheckoutState(facts, config, expired)` and
  `drawStartScore(config, index)` exported for summary, stats replay and
  tests. Registered via `registerDartExerciseEngineFactory`.

## 7. Server

- `RandomCheckoutV1Config` in `app/src/lib/training/exercises/rulesets/types.ts`;
  `RandomCheckoutConfigData` re-exported via `@lib/types`.
- Parse-only validator
  `app/src/services/exercise-rulesets/random-checkout/random-checkout.validator.ts`,
  registered in `app/src/services/exercise-rulesets/registry.ts`.
- `exerciseTypeKey` enums gain `RANDOM_CHECKOUT`
  (`app/src/services/types.ts`, `app/src/pages/api/training-sessions/types.ts`,
  `app/src/services/training-session.service.ts`).
- Seed injection per §5.

## 8. Seed `0036_random_checkout_exercise_type.sql`

- Type `0199a000-0000-7000-8000-00000000000b`, key `RANDOM_CHECKOUT`.
- Ruleset `0199a100-0000-7000-8000-00000000000a`, `RANDOM_CHECKOUT_V1`.
- Template `0199b000-0000-7000-8000-000000000011` "Random Checkout",
  `default_configuration` `{"minStart":40,"maxStart":170}`,
  `game_type_id NULL`.
- Verification `database/verification/0036_random_checkout_seed_checks.sql`,
  mirroring `0035_checkout_sequence_seed_checks.sql`.

IDs are the next free values in each prefix as of seed `0035`.

## 9. Client

- Adapter `app/src/lib/training/routines/adapters/random-checkout.adapter.ts`:
  key `RANDOM_CHECKOUT`, header "Random Checkout", panel `random-checkout`.
- `routine-play.data.ts`: engine slot, dispatch, `activeDartEngine()`,
  `expireTimer()` on timeout, readout getters. No self-complete path.
- **Board preview:** free aim — a dart on the board is a hit, as Catch 40.
- **Panel** `RandomCheckoutPanel.astro`: Checkouts as the score; Start, Left,
  Dart (n/3), Last (✓ / ✗ / —), Rate, Time.
- **Summary** (`summariseRandomCheckout`): Checkouts, Attempts, Rate, Darts.
- **Stats:** `DartExerciseKind` gains `RANDOM_CHECKOUT`;
  `STEP_METRIC_SPECS` `{checkouts, attempts, darts}` (all `sum`), headline
  `checkouts`, rate `checkouts/attempts`; replay presenter darts key `darts`;
  replay shows each attempt's start score from `drawStartScore`; engine
  module imported by `replay-fold.ts` and `step-result.module.ts`.

## 10. Testing

TDD per `app/CLAUDE.md`.

- **Draw:** pool is 124 scores and excludes the seven non-finishes; same
  `(seed, index)` → same score; draw independent of prior darts; a pinned
  seed's first five draws are a golden vector (guards the freeze in §4).
- **RNG move:** `createDartRng` output unchanged for pinned seeds.
- **Engine:** checkout on a double ends the attempt and counts; checkout on
  the bullseye counts; 0 on a non-double busts; leaving 1 busts; going below
  0 busts and voids later darts; three darts without checkout fails; next
  attempt starts from the next draw; expiry with an open attempt leaves it
  unjudged; undo un-expires then pops; undo across an attempt boundary
  restores the earlier start score; replay from prior facts reproduces state.
- **Server:** config schema rejects a missing or out-of-range seed and any
  range other than 40–170; injection overwrites a step-supplied seed;
  validator, registry, API types, training-session service.
- **Client:** adapter, step-adapter registry, routine-play (dispatch, expiry,
  preview), summary, step metrics.

## 11. Docs

Routines §3.4 list + "Random Checkout" section; File Inventory; seed ranges →
`0036`; database README; **D424** in `decisions/game-engine.md` (draw seed as
the stored fact; index-keyed PRNG frozen per ruleset version; shared
seeded-RNG module); `08-DartBot.md` §Determinism points at the shared module;
context-map history; `app/src/modules/training/CLAUDE.md` exercise list;
Component Inventory; Statistics Section Catalog. Rules file: open questions
resolved in this PR; `Current version:` → `V1` when it ships.
