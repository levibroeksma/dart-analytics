# Quick Subtract — Trivia Section (V1 design)

Status: approved (brainstorming), ready for `writing-plans`

## Problem

Improving checkout mental math (subtracting a dart score from a running
total) is currently untrained by any tool in the app. The user drafted a
rough client engine (`DartCalculationGame` + an extended `SegmentTimer`)
built around a running-score subtraction chain. This spec adjusts that
draft to fit the repo's architecture and fixes a design flaw in it (see
"Independent rounds" below).

## Relationship to `docs/game-rules/trivia/checkouts.md`

Separate tool. `checkouts.md` describes a target-number → dart-route
selection drill (pick S/D/T to reach a checkout). Quick Subtract is pure
arithmetic (`start − subtraction = ?`), no route/combination selection.
Both will live under a new **Trivia** top-level section; `checkouts.md`
remains a separate, not-yet-built spec.

## Scope decisions

- **Ephemeral V1.** No persistence, no `game_types` row, no `GameEngine`
  contract, no server/API involvement. Client-only practice tool.
- **Independent rounds.** Each round picks `start` (random integer, 2–501)
  and `subtraction` (random valid one-dart score ≤ `start`) independently —
  rounds are not chained off the previous result (e.g. round 1: `501 − 57`,
  round 2: `231 − 60`, round 3: `341 − 39`). This replaces the original
  draft's running-score chain, which had a dead end: once the running score
  dropped to 2–3, no valid one-dart score could keep it ≥ 2 and
  `getRandomDartScore` would throw. Decoupling rounds removes the bug
  entirely — there is no floor to protect.
- **Two modes:** fixed count (accuracy-focused, elapsed time still tracked)
  and countdown timer (time-pressure-focused).
- **Answer input:** reuse the existing `ScoreInput.astro` keypad (digit
  buffer + submit + backspace), not a route/combination picker.

## Deferred-persistence shape (Hard Invariant)

Not implemented in V1, but named so a future task isn't boxed in: one fact
per round — `{ start, subtraction, result, submittedValue, correct, atMs }`
— analogous to a `TurnFact` with no stage/seat concept (nothing here is
seat- or leg-scoped; the whole session is one ungrouped block). If
persistence is ever added, `QuickSubtractGame` gains a `facts()` getter
returning this log.

## Architecture

Sits entirely outside the 26-file dartboard-game pipeline
(`07-Frontend/09-Adding-A-Game.md`): no `game_types` row, no
`services/rulesets/registry.ts` entry, no `games-visibility.ts` card, no
`check-game-engines.sh` obligations.

```
app/src/pages/trivia/quick-subtract/index.astro      single page: setup → play → summary (one x-data)
app/src/lib/trivia/quick-subtract-play.data.ts        Alpine factory, plain object, no $store/$persist
app/src/modules/trivia/quick-subtract.module.ts       QuickSubtractGame class (the only OOP piece)
app/src/modules/trivia/dart-scores.module.ts          ONE_DART_SCORES + getRandomDartScore (pure functions)
app/src/modules/trivia/interfaces.ts                  barrel: GameStatus, Calculation, AnswerResult, options
app/src/components/layout/trivia/QuickSubtract.astro  interface markup, reuses ScoreInput.astro + Button
app/src/lib/client/alpine/register-route-data.ts      +1 registration line (shared file)
```

New nav entry: **Trivia** (top-level, alongside Games/Statistics). Landing
page lists Quick Subtract now; Checkout Routes (`checkouts.md`) later.

Single page rather than a setup/+play/ split: no session to resume across a
reload, no shareable mid-session URL needed. `GameStatus`
(`idle`/`running`/`finished`) drives which view renders.

No `.engine.module.ts` suffix — that suffix is scoped to
`app/src/modules/game/` and drives `check-game-engines.sh`'s `GameEngine`
contract checks, which do not apply here. No `stores/*.store.ts` — no
cross-page persistence needed for an ephemeral tool.

## `SegmentTimer` extension (additive, backward-compatible)

Score Training, TUOD, and 121 already depend on `SegmentTimer` for their
shipped pause/resume behavior (`stop()`/`start()` preserving `remaining`).
This design adds to the module without touching that contract:

```ts
// modules/ui/interfaces.ts
export interface SegmentTimerOptions {
  totalMinutes: number;
  intervalMinutes: number;
  direction?: 'countdown' | 'countup'; // default 'countdown'
  onTick?: (secondsRemaining: number) => void;
  onSegmentChange?: (segmentIndex: number) => void;
  onComplete?: () => void;
}
```

- `direction` optional, defaults to `'countdown'`. The 3 existing call
  sites pass no `direction` and are unaffected.
- Countup tick increments `remaining` instead of decrementing it; completes
  when `remaining >= totalSeconds` (used as a generous ceiling, not a real
  limit) instead of `remaining <= 0`.
- New method `getElapsed()`: countdown → `totalSeconds - remaining`;
  countup → `remaining`. `getRemaining()` is unchanged.
- No status enum, no `Set`-based multi-subscriber callbacks, no
  constructor validation — none of that is required by this consumer and
  all of it would widen the blast radius on a module 3 shipped features
  depend on.
- Quick Subtract's fixed-count mode uses
  `new SegmentTimer({ totalMinutes: 180, intervalMinutes: 0, direction: 'countup' })`
  — a 3-hour ceiling as a practical "no cap," no segment beeps — purely to
  produce `elapsedTime` for the summary.

## `QuickSubtractGame`

```ts
// modules/trivia/interfaces.ts
export type GameStatus = 'idle' | 'running' | 'finished';

export interface Calculation {
  readonly start: number;
  readonly subtraction: number;
  readonly expression: string; // "231 - 60"
}

export interface AnswerResult {
  readonly valid: boolean;
  readonly correct: boolean;
  readonly expected: number | null;
  readonly calculation: Calculation | null;
}

export interface QuickSubtractOptions {
  mode: 'count' | 'timer';
  count?: number; // required when mode: 'count'
  timer: SegmentTimer;
}
```

```ts
// modules/trivia/quick-subtract.module.ts
export class QuickSubtractGame {
  constructor(options: QuickSubtractOptions);

  start(): void;
  answer(value: number | string): AnswerResult;
  finish(): void;
  destroy(): void; // unsubscribes timer, stop()

  getStatus(): GameStatus;
  getCurrent(): Calculation | null;
  getCorrectAnswers(): number;
  getAttempts(): number;
  getIncorrectAnswers(): number;
  getGenerated(): number;
  getElapsedTime(): number;
  getRemainingTime(): number; // 0 in count mode
}
```

Each round: `start = randomInt(2, 501)`, `subtraction = getRandomDartScore(start)`
(any `ONE_DART_SCORES` value `v` with `start - v >= 0`), `result = start - subtraction`.
No state carries between rounds.

Fixed-count mode ends when `correctAnswers >= count`. Timer mode ends on
`timer.onComplete`. Both call `finish()`.

`dart-scores.module.ts` carries `ONE_DART_SCORES` (deduplicated — the
user's draft had it declared twice in one file) and
`getRandomDartScore(maxScore)`.

## Alpine wiring + UI

```ts
// lib/trivia/quick-subtract-play.data.ts
export function quickSubtractPlay() {
  return {
    status: 'idle' as GameStatus,
    current: null as Calculation | null,
    value: '',
    correctAnswers: 0,
    attempts: 0,
    incorrectAnswers: 0,
    elapsedTime: 0,
    remainingTime: 0,
    lastAnswer: null as AnswerResult | null,
    game: null as QuickSubtractGame | null,

    startCount(count: number) {}, // builds countup timer + QuickSubtractGame, calls start()
    startTimer(minutes: number) {}, // builds countdown timer + QuickSubtractGame
    digit(d: number) {
      this.value += String(d);
    },
    backspace() {
      this.value = this.value.slice(0, -1);
    },
    submit() {
      const r = this.game!.answer(this.value);
      this.lastAnswer = r;
      this.value = '';
      /* sync fields from game getters */
    },
    destroy() {
      this.game?.destroy();
    },
  };
}
```

Plain reactive object, no `$store`, no `$persist` — matches the ephemeral
decision. Registered in the existing shared `register-route-data.ts`.

`components/layout/trivia/QuickSubtract.astro`: `x-show` swaps idle (setup
controls) → running (calculation display + `ScoreInput` reused as-is,
`digitHandler="digit"`, `onDelete="backspace"`, `onSubmit="submit"`) →
finished (summary: correct vs. incorrect counts, matching the app's
existing results-modal look — no "better route" review, since there's no
route concept here).

**Setup defaults** (adjustable at plan time): count mode 10–100, default
20; timer mode 1–15 minutes, default 5.

## Testing

- `app/tests/modules/trivia/quick-subtract.module.test.ts`
- `app/tests/modules/trivia/dart-scores.module.test.ts`
- `app/tests/lib/trivia/quick-subtract-play.data.test.ts`
- `app/tests/modules/ui/segment-timer.module.test.ts`: add countup cases;
  existing countdown cases unchanged

## Documentation impact

- New context-pack row in `docs/architecture/00-Context-Map.md`: "New
  trivia tool."
- New section in `docs/architecture/07-Frontend/` documenting the Trivia
  pattern as a documented exception to Pattern 18 (non-game client tool,
  no persistence, outside the game-wiring pipeline).
- New decision block in `decisions/frontend/architecture.md`: trivia tools
  are not `GameEngine`s and live outside the game-wiring pipeline — this
  closes the open question `docs/game-rules/trivia/README.md` flagged
  ("No existing architecture pipeline covers this yet").
- `docs/game-rules/trivia/README.md` updated to point at this spec once
  implemented (per its own "disposable once translated" rule for the
  per-tool raw notes — `checkouts.md` is untouched, still pending its own
  future translation).

## Out of scope

- `checkouts.md`'s route-selection trivia — separate future task.
- Any persistence, API, or database work.
- Changes to `SegmentTimer`'s status/callback model beyond the additive
  `direction`/`getElapsed()` fields above.
