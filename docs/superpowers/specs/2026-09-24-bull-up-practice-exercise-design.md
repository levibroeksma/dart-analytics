# Bull Up Practice (Bull Up) exercise — design

Date: 2026-09-24
Input: `docs/game-rules/training/exercises/bull-up-practice.md` (rules, V1 cut, defer list)
Precedent: `BULLSEYE_CHECKOUT_V1` (`app/src/modules/training/exercises/bullseye-checkout.engine.module.ts`, spec `2026-09-24-bullseye-checkout-exercise-design.md`)

## 1. Scope

New exercise type `BULL_UP`, ruleset `BULL_UP_V1`, template "Bull Up
Practice", routine step only. Offered by the routine builder via
`v_exercise_template_catalog` once seeded. No standalone page, no seeded
routine, no schema change.

Own engine: no shipped engine models a one-dart visit, and every exercise
type keeps one engine file.

## 2. Persistence

- **Capture/input mode:** `ANALYTICS` + `VISUAL_BOARD`, no game pair (D277).
  Type key joins `DART_EXERCISE_TYPE_KEYS`; ruleset key joins
  `DART_WRITING_RULESET_VERSION_KEYS`.
- **Stage type:** one `EXERCISE_BLOCK` (`exerciseBlockStage()`).
- **`turns`:** one per throw, holding exactly one dart; `completedAt` stamped
  on that dart; `totalScore` = its board score (`appendObservedDart`). First
  exercise with one-dart turns — no constraint in `0007_constraints.sql`
  requires more, and turn resolution is the ruleset's rule
  (`appendObservedDart` doc comment).
- **`darts`:** intended target `25` / zone `INNER_BULL` on every dart —
  `doubleTargetIntent({ kind: "BULL" })`, reused, not re-declared. Board
  `score` on every dart.

## 3. Configuration

```ts
BullUpV1Config = z.object({}).strict();
```

The target is fixed (the bull); duration is routine-step configuration
(5-minute preset), not a template column. Empty object, not absent, so the
ruleset registry and validator path stay uniform.

## 4. Engine — `BullUpEngine`

File: `app/src/modules/training/exercises/bull-up.engine.module.ts`.
Pure fold over turns in write order:

```
each turn (one dart) → throws++;
                       tier = INNER_BULL → "BULLSEYE" (bullseyes++, bulls++)
                              OUTER_BULL → "OUTER_BULL" (bulls++)
                              else       → "MISS"
                       lastTier = tier
```

State (`BullUpState`, in `app/src/modules/training/exercises/types.ts`):
`throws`, `bullseyes`, `bulls`, `lastTier`
(`"BULLSEYE" | "OUTER_BULL" | "MISS" | null`, `null` before the first throw),
`status`. Rates are derived by the panel/summary (`bullseyes / throws`,
`bulls / throws`, `—` when `throws` is 0), not held in state.

- `record()` always opens a new turn (`openOrCreateTurn` with a predicate
  that never reuses), appends the dart with the bull intent, stamps
  `completedAt`. Throws once complete.
- No unfinished visit exists: a turn is complete when written.
- Clockless (D264): `expireTimer()` completes. `undo()` un-completes first,
  else pops the last dart (`undoLastDart`), which removes its now-empty turn.
- `foldBullUpState(facts, complete)` exported for the summary and tests, as
  `foldBullseyeCheckoutState`.
- Registered via `registerDartExerciseEngineFactory`.

## 5. Server

- `BullUpV1Config` in `app/src/lib/training/exercises/rulesets/types.ts`
  (joins `EXERCISE_RULESET_CONFIGS`); `BullUpConfigData` in `@lib/types`.
- Parse-only validator
  `app/src/services/exercise-rulesets/bull-up/bull-up.validator.ts`,
  registered in `app/src/services/exercise-rulesets/registry.ts`.
- `exerciseTypeKey` enums gain `BULL_UP`
  (`app/src/services/types.ts`, `app/src/pages/api/training-sessions/types.ts`,
  `app/src/services/training-session.service.ts`).

## 6. Seed `0030_bull_up_exercise_type.sql`

- Type `0199a000-0000-7000-8000-000000000009`, key `BULL_UP`.
- Ruleset `0199a100-0000-7000-8000-000000000008`, `implementation_key`
  `BULL_UP_V1`.
- Template `0199b000-0000-7000-8000-00000000000f` "Bull Up Practice",
  `default_configuration` `{}`, `game_type_id NULL`.
- Verification script `database/verification/0030_bull_up_seed_checks.sql`,
  mirroring `0029_bullseye_checkout_seed_checks.sql`.

IDs are the next free values in each prefix as of seed `0029`.

## 7. Client

- Adapter `app/src/lib/training/routines/adapters/bull-up.adapter.ts`: key
  `BULL_UP`, header "Bull up practice", panel `bull-up`; registered in
  `step-adapter.registry.ts`.
- `routine-play.data.ts`: `bullUpEngine` slot, dispatch, `activeDartEngine()`,
  `expireTimer()` on step timeout, readout getters.
- **Board preview:** a hit on either bull; `INNER_BULL` shown as the
  stronger hit.
- **Panel** `app/src/components/layout/training/exercises/BullUpPanel.astro`,
  wired in `app/src/pages/training/routines/play/index.astro`: Bullseyes as
  the score; Last (Bullseye / Outer bull / Miss / —), Throws, Bulls,
  Bullseye rate, Bull rate, Time.
- **Summary** (`summariseBullUp` in `routine-summary.module.ts`): Throws,
  Bullseyes, Bulls, Bullseye rate, Bull rate.

## 8. Testing

TDD per `app/CLAUDE.md`. Mirrors the Bullseye Checkouts test set:

- Engine: inner bull → bullseye + bull; outer bull → bull only; any other
  zone and off-board → miss; every dart intent is `25`/`INNER_BULL`; each
  dart is its own completed turn; expiry completes with no unjudged throw;
  undo un-completes then pops the dart and its turn; resume from prior facts
  reproduces state; record after complete throws.
- Config schema: accepts `{}`, rejects extra keys.
- Validator, registry, adapter, step-adapter registry, routine-play preview,
  summary (rates with zero throws), API types, training-session service.

## 9. Docs

Routines §3.4 list + subsection; File Inventory; seed ranges → `0030`;
database README; decision in `decisions/game-engine.md` (first one-dart-turn
exercise); context-map history; `app/src/modules/training/CLAUDE.md` exercise
list. Rules file `Current version:` advances to `V1` when it ships.
