# Bullseye Checkouts (Bullseye Checkout) exercise — design

Date: 2026-09-24
Input: `docs/game-rules/training/exercises/bullseye-checkout.md` (rules, V1 cut, defer list)
Precedent: `SCORE_THRESHOLD_V1` (`app/src/modules/training/exercises/score-threshold.engine.module.ts`, commit `1f051a3`)

## 1. Scope

New exercise type `BULLSEYE_CHECKOUT`, ruleset `BULLSEYE_CHECKOUT_V1`,
template "Bullseye Checkouts", routine step only. Offered by the routine
builder via `v_exercise_template_catalog` once seeded. No standalone page, no
seeded routine, no schema change.

Own engine, not a generalised `ScoreThresholdEngine`: the shipped 65 or More
engine stays untouched, and every exercise type keeps one engine file.

## 2. Persistence

- **Capture/input mode:** `ANALYTICS` + `VISUAL_BOARD`, no game pair (D277).
  Type key joins `DART_EXERCISE_TYPE_KEYS`; ruleset key joins
  `DART_WRITING_RULESET_VERSION_KEYS`.
- **Stage type:** one `EXERCISE_BLOCK` (`exerciseBlockStage()`).
- **`turns`:** one per three-dart visit; `totalScore` = board sum
  (`appendObservedDart`).
- **`darts`:** darts 1–2 carry no intent (both intended columns null —
  `chk_dart_target_consistency` allows it). Dart 3 carries intended target
  `25` / zone `INNER_BULL` — the value `doubleTargetIntent` returns for a
  `BULL` target, reused, not re-declared. Board `score` on every dart.

## 3. Configuration

```ts
BullseyeCheckoutV1Config = z.object({
  startScore: z.literal(81),
}).strict();
```

The start score lives in config so a later widening serves another bull
finish without a new type. V1 accepts 81 only. Setup target is derived:
`startScore − 50` (= 31); never stored.

## 4. Engine — `BullseyeCheckoutEngine`

File: `app/src/modules/training/exercises/bullseye-checkout.engine.module.ts`.
Pure fold over turns in write order:

```
visit with 3 darts → visits++;
                     checkout = darts[0].score + darts[1].score === startScore − 50
                                && darts[2].hitZoneKey === "INNER_BULL";
                     if checkout → checkouts++; lastVisitCheckout = checkout
visit with < 3     → current visit (not judged); currentLeft = startScore − sum
```

State (`BullseyeCheckoutState`, in `app/src/modules/training/exercises/types.ts`):
`startScore`, `checkouts`, `visits`, `lastVisitCheckout` (`boolean | null`,
`null` until a visit is judged), `currentLeft` (`startScore` at visit start),
`dartsInVisit`, `dartsThrown`, `status`.

- `record()` opens/continues the visit via `openOrCreateTurn`; the dart's
  position in the visit picks the intent (dart 3 → bull intent, else none).
  Third dart stamps `completedAt`. Throws once complete.
- A visit never ends early: all three darts are recorded even when the setup
  already missed 31.
- Clockless (D264): `expireTimer()` completes; an unfinished visit stays
  unjudged. `undo()` un-completes first, else pops the last dart
  (`undoLastDart`).
- `foldBullseyeCheckoutState(facts, config, complete)` exported for the
  summary and tests, as `foldScoreThresholdState`.
- Registered via `registerDartExerciseEngineFactory`.

## 5. Server

- `BullseyeCheckoutV1Config` in `app/src/lib/training/exercises/rulesets/types.ts`;
  `BullseyeCheckoutConfigData` in `@lib/types`.
- Parse-only validator
  `app/src/services/exercise-rulesets/bullseye-checkout/bullseye-checkout.validator.ts`,
  registered in `app/src/services/exercise-rulesets/registry.ts`.
- `exerciseTypeKey` enums gain `BULLSEYE_CHECKOUT`
  (`app/src/services/types.ts`, `app/src/pages/api/training-sessions/types.ts`,
  `app/src/services/training-session.service.ts`).

## 6. Seed `0029_bullseye_checkout_exercise_type.sql`

- Type `0199a000-0000-7000-8000-000000000008`, key `BULLSEYE_CHECKOUT`.
- Ruleset `0199a100-0000-7000-8000-000000000007`, `implementation_key`
  `BULLSEYE_CHECKOUT_V1`.
- Template `0199b000-0000-7000-8000-00000000000e` "Bullseye Checkouts",
  `default_configuration` `{"startScore":81}`, `game_type_id NULL`. Duration
  is routine-step configuration (10-minute preset), not a template column.
- Verification script `database/verification/0029_bullseye_checkout_seed_checks.sql`,
  mirroring `0025_score_threshold_seed_checks.sql`.

IDs are the next free values in each prefix as of seed `0028`.

## 7. Client

- Adapter `app/src/lib/training/routines/adapters/bullseye-checkout.adapter.ts`:
  key `BULLSEYE_CHECKOUT`, header "Bullseye checkouts", panel
  `bullseye-checkout`; registered in `step-adapter.registry.ts`.
- `routine-play.data.ts`: `bullseyeCheckoutEngine` slot, dispatch,
  `activeDartEngine()`, `expireTimer()` on step timeout, readout getters.
- **Board preview:** darts 1–2 are a hit when on the board; dart 3 is a hit
  only on `INNER_BULL`.
- **Panel** `BullseyeCheckoutPanel.astro`: Checkouts as the score; Left
  (`currentLeft`), Last (✓ / ✗ / —), Visits, Rate, Time.
- **Summary** (`summariseBullseyeCheckout` in `routine-summary.module.ts`):
  Checkouts, Visits, Checkout rate, Darts.

## 8. Testing

TDD per `app/CLAUDE.md`. Mirrors the 65 or More test set:

- Engine: exact-31 + inner bull = checkout; 31 + outer bull = miss; 30/32 +
  inner bull = miss; missed setup darts still require dart 3; dart 3 intent is
  `25`/`INNER_BULL`, darts 1–2 null; unfinished visit at expiry not judged;
  undo un-completes then pops; resume from prior facts reproduces state.
- Config schema: accepts 81, rejects other numbers and extra keys.
- Validator, registry, adapter, step-adapter registry, routine-play preview,
  summary, API types, training-session service.

## 9. Docs

Routines §3.4 list + subsection; File Inventory; seed ranges → `0029`;
database README; decision in `decisions/game-engine.md`; context-map history;
`app/src/modules/training/CLAUDE.md` exercise list. Rules file
`Current version:` advances to `V1` when it ships.
