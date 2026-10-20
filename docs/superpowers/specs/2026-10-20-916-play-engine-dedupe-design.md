# #916 Play/Engine/Routine Dedupe — Design

**Status:** approved for build, 2026-10-20
**Ships in:** four PRs (A–D), each independent
**Follows:** #916 (closed; clusters 2, 4, 5 carried here)

## Intent

Remove the duplication `fallow dupes` found in #916 clusters 2, 4 and 5 with
**no behaviour change**: no state-shape change, no persisted-data change, no
user-visible change, no new decision block. Success:

- each duplicated pattern lives in one tested module;
- its clone groups leave `npx fallow dupes --mode mild` output, except where
  this spec keeps a clone on purpose;
- every existing suite stays green with no test re-pointed.

Out of scope: #916 clusters 1, 3, 6 and the unconverted part of 7.

## PR A — Play-data bot helpers (cluster 4a)

`lib/game/play-bot-seat.ts` already exports `findBotSeat` and `botDartIndex`,
yet private copies remain:

| Private copy | Files |
| --- | --- |
| `findBotSeat` | around-the-clock, bobs27, doubles-training, five-oh-one, one-twenty-one, shanghai, singles-training |
| `botDartIndex` | around-the-clock, bobs27, doubles-training, five-oh-one, one-twenty-one, shanghai, singles-training |
| `type DartbotSeat = Extract<…>` | same seven |
| `BOT_PRE_THROW_MS = 900`, `BOT_POST_THROW_MS = 250` | the seven above plus score-training, tuod |

Change:

- `play-bot-seat.ts` exports `BOT_PRE_THROW_MS` and `BOT_POST_THROW_MS`.
  `DartbotSeat` is imported from `@lib/types`, as `play-bot-seat.ts` already
  does.
- The nine `*-play.data.ts` files delete their copies and import the shared
  ones. All values are verified identical (900/250 everywhere).
- `DARTS_PER_VISIT` stays local: it is a game rule, not bot pacing.

Tests: `tests/lib/game/play-bot-seat.test.ts` gains a test pinning both
pacing constants. Behaviour is covered by the existing per-game play-data
suites.

## PR B — Lifecycle guards (cluster 4b)

Four `undoVisit` bodies (five-oh-one, one-twenty-one, score-training, tuod;
fallow groups at `five-oh-one:830-863`, `one-twenty-one:809-834`,
`score-training:545-576`, `tuod:700-724`) repeat one shape:

```ts
if (this.finished || <confirm flags…> || this.$store.game.timerPaused) return;
if (!this.engine) return;
const botSeat = findBotSeat(this.$store.game.seats);
if (botSeat) {
  const humanSeat = seats.find((s) => s.participantTypeKey === "PLAYER")!;
  undoToActiveSeat(this, humanSeat.participantRef);
} else {
  if (!this.engine.undo()) return;
  clearHiddenTimer(this);
  this.$store.game.recordFacts(this.engine.facts());
}
this.scoreInput.clear();
this.error = "";
void this.maybeRunBotVisit();
```

Change — two helpers in `lib/game/play-lifecycle.ts`:

- `isInputBlocked(ctx, ...confirmFlags: boolean[]): boolean` —
  `ctx.finished || ctx.$store.game.timerPaused || confirmFlags.some(Boolean)`.
  Each game passes its own flags; the lists differ (five-oh-one includes
  `showMatchFinishConfirm` and does **not** check `timerPaused` today — that
  site keeps its exact condition, see below).
- `undoBotAwareVisit(ctx)` — everything after the guard, unchanged.

Five-oh-one's guard omits `timerPaused`. The helper must not add it there.
Either `isInputBlocked` takes `{ timerPaused: false }` or five-oh-one keeps
its inline guard and only adopts `undoBotAwareVisit`; the plan picks the
smaller diff after reading the call sites.

Not extracted: `throwOneDart` (x4). Each copy calls a different target
chooser; a shared version needs a chooser callback and saves little.

Tests: new unit tests in `tests/lib/game/play-lifecycle.test.ts` — guard
true/false per flag; bot branch calls `undoToActiveSeat` with the human ref;
no-bot branch stops on a failed `engine.undo()` and records facts otherwise.
Existing game suites prove no change.

## PR C — Engine refusal guard (cluster 5)

21 sites across 16 engine modules plus `dart-exercise-shell.module.ts` and
`marks-close.module.ts` throw
`Cannot record a dart once the <noun>; undo first to correct it.` with six
nouns: "exercise is complete", "game has ended", "match has ended", "match
is complete", "session has ended", "session is complete".

Change:

- `modules/game/turn-log.module.ts` exports
  `refuseWhenEnded(ended: boolean, noun: string): void`, throwing the same
  template.
- All sites call it with their current noun, so every message stays
  byte-identical and tests matching on it stay valid.
- Module-level message constants (`MATCH_ENDED`, `GAME_ENDED`,
  `EXPIRED_REFUSAL`, …) are removed where the helper replaces them.

Not extracted:

- The `turn.completedAt = new Date().toISOString()` stamp in 7 exercise
  engines. The condition that closes a visit differs per engine and carries
  its invariant (`bull-up` every dart, `bullseye-checkout` on dart 3 with the
  finishing intent, `score-threshold` on the third dart, …). A helper would
  only hide the one-line stamp and move the rule out of sight.
- The 96-line `cricket`/`tactics` block. It belongs with the marks-close
  kernel; filed as a separate discovered-work issue, not widened here.

Tests: a `refuseWhenEnded` describe in `tests/modules/game/turn-log.module.test.ts`
asserting the exact message and the no-throw path. All engine suites run
unchanged.

## PR D — Routine completion states (cluster 2)

`pages/training/routines/play/index.astro` repeats, per panel (four panels,
`:127-166`, `:192-231`, `:263-302`, `:316-344`), a `ConfirmDialog` finish
confirm with `stepContextRow()` inlay plus a "Saving…" and a failed block.

Change:

- New `components/layout/training/routines/RoutineCompletionStates.astro` with props
  `description` (the dialog text) and `savingText`. It renders the
  finish-confirm wrapper, the saving block and the failed block with the same
  `x-show` expressions and ids (`routine-finish-confirm-title`).
- Each panel replaces its block with one component tag. Panel-specific gates
  (TUOD's `CheckoutConfirm`) stay in the panel.

Tests: `.astro` has no unit tests (D101). Before/after Playwright screenshots
of each panel's confirm and saving state, compared by eye; if that is not
practical in the container, the PR says so and leaves the visual check open.
`astro check` must pass.

## Cross-cutting

- Order A → B → C → D; each is its own branch and PR from `main` and can be
  dropped without affecting the others.
- Every PR runs `tsc`, `astro check`, `vitest`, `scripts/fallow-gate.sh` and
  the `scripts/check-*.sh` gates; DB steps of `validate:app` cannot run in the
  container.
- Docs: File Inventory rows for any new export or file. No decision block —
  pure refactor, no architectural choice.
- A tracking issue for this work is created before PR A, since #916 is
  closed.
