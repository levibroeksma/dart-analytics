# Catch 40 (Checkout Sequence) exercise — design

Date: 2026-10-06
Input: `docs/game-rules/training/exercises/catch-40.md` (rules, V1 cut, defer list; open questions resolved 2026-10-06)
Precedent: `BULLSEYE_CHECKOUT_V1` (`app/src/modules/training/exercises/bullseye-checkout.engine.module.ts`, PR #586)

## 1. Scope

New exercise type `CHECKOUT_SEQUENCE`, ruleset `CHECKOUT_SEQUENCE_V1`,
template "Catch 40", routine step only. Offered by the routine builder via
`v_exercise_template_catalog` once seeded. No standalone page, no seeded
routine, no schema change. Catch 20 / Catch 70 / head-to-head stay `V2+`.

Own engine. Finishing Pyramid stays a separate future type; both share the
X01 rule `resolveCheckoutAttempt` (`app/src/modules/game/checkout-bust.module.ts`).

## 2. Persistence

- **Capture/input mode:** `ANALYTICS` + `VISUAL_BOARD`, no game pair (D277).
  Type key joins `DART_EXERCISE_TYPE_KEYS`; ruleset key joins
  `DART_WRITING_RULESET_VERSION_KEYS`.
- **Stage type:** one `EXERCISE_BLOCK` (`exerciseBlockStage()`).
- **`turns`:** one per visit; a visit closes on a checkout, a bust or its
  third dart. `totalScore` = board sum (`appendObservedDart`), never zeroed
  on bust.
- **`darts`:** one row per thrown dart, free aim (both intended columns
  null). No row for darts not thrown after a bust. Board `score` on every dart.
- **Derived only:** current outshot, remaining, bust, darts used, attempt
  points, points, checkouts, attempts.

## 3. Configuration

```ts
CheckoutSequenceV1Config = z.object({
  firstOutshot: z.literal(61),
  lastOutshot: z.literal(100),
  dartLimit: z.literal(6),
}).strict();
```

Range and limit live in config so Catch 20/70 later widen the schema, not
the type. V1 accepts only the Catch 40 values. Duration is routine-step
configuration (30-minute preset), not a template column.

## 4. Engine — `CheckoutSequenceEngine`

File: `app/src/modules/training/exercises/checkout-sequence.engine.module.ts`.
Pure fold over turns in write order. Per attempt: `outshot`, `visitIndex`
(0 or 1), `remaining` at visit start.

Per visit, walk its darts with `resolveCheckoutAttempt(remaining, score,
zone ∈ {DOUBLE, INNER_BULL})`:

- **checked out** at dart *i* → darts used = `3 × visitIndex + i + 1`;
  attempt points 3 (≤2 darts), 2 (3 darts; 3 when outshot is 99), 1 (4–6);
  `checkouts++`, `attempts++`, next outshot.
- **bust** → visit closes; remaining back to the visit's start value.
- **third dart, no checkout** → visit closes; remaining carried.
- closed without checkout: `visitIndex 0` → `visitIndex 1`; `visitIndex 1`
  → attempt failed, 0 points, `attempts++`, next outshot.
- fewer darts and no close → open visit; `remaining` shows the walked value.

Next outshot past `lastOutshot` → `sequenceComplete`. Visit closure is
derived from the darts, never read from `completedAt`.

State (`CheckoutSequenceState`, `app/src/modules/training/exercises/types.ts`):
`currentOutshot` (`null` once the sequence is done), `remaining`,
`attemptDart` (darts used in the open attempt, 0–5), `points`, `checkouts`,
`attempts`, `lastAttemptPoints` (`null` until an attempt resolves),
`dartsInVisit`, `dartsThrown`, `status`.

- `record()` opens/continues the visit via `openOrCreateTurn` (reusable while
  the fold says a visit is open); stamps `completedAt` when the dart closes
  it. Throws once complete.
- **Self-completing:** `isComplete()` is true once the timer expired
  (`expireTimer()`, D264) **or** the fold reports the sequence done. First
  dart exercise that ends itself.
- `undo()` un-expires first, else pops the last dart (`undoLastDart`).
- `foldCheckoutSequenceState(facts, config, expired)` exported for summary,
  stats replay and tests. Registered via `registerDartExerciseEngineFactory`.

## 5. Server

- `CheckoutSequenceV1Config` in `app/src/lib/training/exercises/rulesets/types.ts`;
  `CheckoutSequenceConfigData` re-exported via `@lib/types`.
- Parse-only validator
  `app/src/services/exercise-rulesets/checkout-sequence/checkout-sequence.validator.ts`,
  registered in `app/src/services/exercise-rulesets/registry.ts`.
- `exerciseTypeKey` enums gain `CHECKOUT_SEQUENCE`
  (`app/src/services/types.ts`, `app/src/pages/api/training-sessions/types.ts`,
  `app/src/services/training-session.service.ts`).

## 6. Seed `0035_checkout_sequence_exercise_type.sql`

- Type `0199a000-0000-7000-8000-00000000000a`, key `CHECKOUT_SEQUENCE`.
- Ruleset `0199a100-0000-7000-8000-000000000009`, `CHECKOUT_SEQUENCE_V1`.
- Template `0199b000-0000-7000-8000-000000000010` "Catch 40",
  `default_configuration`
  `{"firstOutshot":61,"lastOutshot":100,"dartLimit":6}`, `game_type_id NULL`.
- Verification `database/verification/0035_checkout_sequence_seed_checks.sql`,
  mirroring `0030_bull_up_seed_checks.sql`.

IDs are the next free values in each prefix as of seed `0034`.

## 7. Client

- Adapter `app/src/lib/training/routines/adapters/checkout-sequence.adapter.ts`:
  key `CHECKOUT_SEQUENCE`, header "Catch 40", panel `checkout-sequence`.
- `routine-play.data.ts`: engine slot, dispatch, `activeDartEngine()`,
  `expireTimer()` on timeout, readout getters. `recordCheckoutSequenceDart`
  calls `completeCurrentStep()` when the engine reports complete — the run
  ends at the end of the sequence without waiting for the clock.
- **Board preview:** free aim — a dart on the board is a hit, as 65 or More.
- **Panel** `CheckoutSequencePanel.astro`: Points as the score; Outshot,
  Left, Dart (n/6), Last (+3 … 0 / —), Checkouts, Time.
- **Summary** (`summariseCheckoutSequence`): Points, Checkouts, Attempts,
  Darts.
- **Stats:** `DartExerciseKind` gains `CHECKOUT_SEQUENCE`;
  `STEP_METRIC_SPECS` `{points, checkouts, attempts, darts}` (all `sum`),
  headline `points`, rate `checkouts/attempts`; replay presenter darts key
  `darts`; engine module imported by `replay-fold.ts` and `step-result.module.ts`.

## 8. Testing

TDD per `app/CLAUDE.md`. Engine: 2-dart checkout = 3; 3-dart = 2; 99 in 3 =
3; visit-two checkout = 1; failure after six darts = 0 and advances; bust
restores remaining and ends the visit; bust in visit one carries into visit
two; bust counts its unthrown darts; checkout on non-double busts; leaving 1
busts; sequence end completes the run and rejects further darts; expiry
completes; undo un-expires then pops; replay from prior facts reproduces
state. Plus config schema, validator, registry, adapter, step-adapter
registry, routine-play (dispatch, self-complete, preview), summary, step
metrics, API types, training-session service.

## 9. Docs

Routines §3.4 list + "Catch 40" section; File Inventory; seed ranges →
`0035`; database README; **D423** in `decisions/game-engine.md`;
context-map history; `app/src/modules/training/CLAUDE.md` exercise list;
Component Inventory; Statistics Section Catalog. Rules file
`Current version:` → `V1` when it ships.
