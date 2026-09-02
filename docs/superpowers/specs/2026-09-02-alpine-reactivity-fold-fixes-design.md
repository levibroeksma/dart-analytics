# Design: Alpine reactivity fold fixes (6 play controllers)

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F31. Six `*-play.data.ts` files define `state()` as
`return this.engine?.state() ?? null;` — reading a plain, non-reactive class
instance's internal mutation rather than a tracked Alpine store field, the
same gap issue #161 found and fixed for TUOD. `x-text`/`x-show` expressions
that call `state()` never re-render on a recorded dart, on any input mode.

Fix pattern, already shipped for TUOD and 501: `state()` becomes a fold over
`this.$store.game`'s own `stages`/`turns` — Alpine-tracked fields — through
each engine's `foldXState(facts, config)`, exactly mirroring
`tuod-play.data.ts:221-229` / `five-oh-one-play.data.ts:305-312`.

**Scope correction against F31's own evidence:** the finding states a fold
function is "already exported and available for the same substitution" for
all six games. Checked against the engine modules directly — that's true for
only two:

- **Shape A — fold function already exported, `state()`-swap only:**
  `foldScoreTrainingState` (`score-training.engine.module.ts:62`),
  `foldShanghaiState` (`shanghai.engine.module.ts:183`).
- **Shape B — no exported fold function exists yet.**
  `doubles-training.engine.module.ts`, `around-the-clock.engine.module.ts`,
  `bobs27.engine.module.ts`, `singles-training.engine.module.ts` each derive
  state through a **private** `deriveState()` method on the engine class,
  never extracted to a standalone function. These four tasks include first
  extracting that method's body into an exported `foldXState(facts, config)`
  — verbatim logic, no behavior change — with the class's own `deriveState()`
  rewritten to call it (mirroring `ShanghaiEngine.deriveState()`'s own
  one-line delegation), before the play controller can fold anything.

Six independent tasks, one per game, bundled as one spec — split at
review/PR time if that reads better than one branch.

## Shape A tasks

### Task 1 — Score Training

`score-training-play.data.ts:238-240`'s `state()` reads
`this.engine?.state() ?? null`. Fix, mirroring TUOD (Score Training's engine
also carries a `timerExpired` flag):

```ts
state(this: ScoreTrainingPlayContext): ScoreTrainingState | null {
  const config = this.$store.game.configSnapshot;
  if (!config) return null;
  return foldScoreTrainingState(
    { stages: this.$store.game.stages, turns: this.$store.game.turns },
    config,
    this.$store.game.timerExpired ?? false,
  );
},
```

### Task 2 — Shanghai

`shanghai-play.data.ts:176-178`'s `state()` reads `this.engine?.state() ??
null`. Fix, mirroring 501 (no timer):

```ts
state(this: ShanghaiPlayContext): ShanghaiState | null {
  const config = this.$store.game.configSnapshot;
  if (!config) return null;
  return foldShanghaiState(
    { stages: this.$store.game.stages, turns: this.$store.game.turns },
    config,
  );
},
```

## Shape B tasks

Each of the four follows the same two-step shape. Step 1 (engine module):
move the private `deriveState()` method's body into a new exported
`foldXState(facts: EngineFacts, config: Seated<XSnapshot>): XState`
function — same computation, reading `facts.turns` where the method read
`this.turns` and taking `config` as a parameter where it read `this.config`
— then reduce `deriveState()` to `return foldXState(this.facts(), this.config);`.
Step 2 (play controller): the same `state()` swap as Shape A.

### Task 3 — Doubles Training

`doubles-training.engine.module.ts:190` (`private deriveState()`) →
extract to exported `foldDoublesTrainingState`. `doubles-training-play.data.ts:104-106`
→ fold `$store.game`.

### Task 4 — Around the Clock

`around-the-clock.engine.module.ts:184` (`private deriveState()`) →
extract to exported `foldAroundTheClockState`. `around-the-clock-play.data.ts:175-177`
→ fold `$store.game`.

### Task 5 — Bob's 27

`bobs27.engine.module.ts:151` (`private deriveState()`) → extract to
exported `foldBobs27State`. `bobs27-play.data.ts:195-197` → fold
`$store.game`.

### Task 6 — Singles Training

`singles-training.engine.module.ts:266` (`private deriveState()`) →
extract to exported `foldSinglesTrainingState`. `singles-training-play.data.ts:288-290`
→ fold `$store.game`.

## Testing

- Not independently reproduced in a real browser for any of the six per
  F31's own note (no WebKit/Chromium DOM harness, `.astro` markup untested
  per D101) — verification is by code inspection against the shipped
  TUOD/501 pattern plus unit coverage below, matching how those two shipped.
- Tasks 1–2: extend each `*-play.data.test.ts` with a case that records a
  dart via `$store.game.recordFacts(facts)` (not through `engine`) and
  asserts `state()` reflects it — the exact regression TUOD's own fix added
  coverage for.
- Tasks 3–6: two test additions per task, both required by
  `scripts/check-test-coverage.sh` (D224) since each touches a runtime
  engine module:
  1. A direct unit test for the new `foldXState` export in
     `*.engine.module.test.ts`, asserting it reproduces the same state the
     engine class's own `state()` already returns for an equivalent fact
     log — proves the extraction changed nothing.
  2. The same `$store.game.recordFacts`-driven case as Tasks 1–2 in the
     play controller's own test file.

## Non-goals

No change to any engine's public `state()`/`facts()`/`record()` contract or
return shape — Shape B's extraction is a pure refactor of already-shipped
logic, not a behavior change. No change to `seat-rota.module.ts` or
`seat-state.module.ts`. No change to TUOD's or 501's already-fixed
controllers.
