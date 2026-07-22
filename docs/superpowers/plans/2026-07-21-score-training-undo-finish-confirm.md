# Score Training Undo + Finish Confirm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ScoreInput undo control pop the last committed visit, and gate session completion behind a confirm modal that holds the completing score pending until Confirm (Cancel restores it into the input).

**Architecture:** Client-only. Non-completing submits still `recordVisit` → `recordTurn`. Completing submits stash `pendingFinishScore` and open `showFinishConfirm` without mutating turns. Confirm commits then reuses the existing D119 upload hard-gate; Cancel restores `visitInput`. Undo pops store + engine (with resume-safe rebuild when the engine has no local visits). UI: rewire ScoreInput left button; add finish-confirm overlay on the play page.

**Tech Stack:** Astro, Alpine.js v3, TypeScript, Vitest, existing `ScoreTrainingEngine`, `game.store`, `scoreTrainingPlay()` factory

## Global Constraints

- Field/method names from the spec: `undoVisit`, `confirmFinish`, `cancelFinish`, `pendingFinishScore`, `showFinishConfirm`, `undoLastTurn`, `undoLastVisit`
- Normal undo clears `visitInput` (does **not** restore the undone score)
- Completing Cancel restores `visitInput = String(pendingFinishScore)` and does **not** commit
- While `showFinishConfirm`: keypad / submit / undo are disabled or no-ops
- No undo after `finished === true` / mid-upload
- No Vitest for `.astro` markup (D101)
- No schema/API changes
- No git worktrees — stay on the current branch in the main working copy
- Commit when a plan step says commit (this plan authorizes those commits)
- Existing tests that assume “final `submitVisit` uploads immediately” **must** be updated to call `confirmFinish()` after the completing submit

## File Structure

**Modify:**

| File | Responsibility |
| ---- | -------------- |
| `app/src/modules/game/score-training.engine.module.ts` | `undoLastVisit(): boolean` |
| `app/tests/modules/game/score-training.engine.module.test.ts` | Engine undo tests |
| `app/src/stores/game.store.ts` | `undoLastTurn()` |
| `app/tests/stores/game.store.test.ts` | Store undo tests |
| `app/src/lib/game/types.ts` | Play context: pending fields, undo/confirm methods, `$store.game.undoLastTurn` |
| `app/src/lib/game/score-training-play.data.ts` | Branch `submitVisit`; `undoVisit` / `confirmFinish` / `cancelFinish` |
| `app/tests/lib/game/score-training-play.data.test.ts` | New behavior + update completion tests that assumed immediate finish |
| `app/src/components/layout/games/ScoreInput.astro` | Left button → `undoVisit()`; disable when unavailable |
| `app/src/pages/games/score-training/play/index.astro` | Finish-confirm overlay |
| `DECISIONS.md` | D122 pending finish-confirm one-liner |

**Do not touch:**

| File | Why |
| ---- | --- |
| API / migrations / payload builder | Client-only until confirm → existing upload path |
| `clearVisitInput` removal | Keep unless unused after rewire; Delete still owns digit clear |
| Shared FinishConfirmModal component | Inline overlay (YAGNI) |

---

### Task 1: `ScoreTrainingEngine.undoLastVisit` (TDD)

**Files:**

- Modify: `app/src/modules/game/score-training.engine.module.ts`
- Test: `app/tests/modules/game/score-training.engine.module.test.ts`

**Interfaces:**

- Consumes: existing `recordVisit`, private `visits`
- Produces: `undoLastVisit(): boolean` — pops last visit if any; `true` if popped, `false` if empty

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/modules/game/score-training.engine.module.test.ts`:

```ts
describe('ScoreTrainingEngine.undoLastVisit', () => {
  it('pops the last visit and returns true; next recordVisit reuses that sequence', () => {
    const engine = new ScoreTrainingEngine({
      durationType: 'ROUNDS',
      durationValue: 10,
      maxDartsPerTurn: 3,
    });
    engine.recordVisit(40);
    engine.recordVisit(60);
    expect(engine.undoLastVisit()).toBe(true);
    expect(engine.currentTotal()).toBe(40);
    const next = engine.recordVisit(50);
    expect(next.sequence).toBe(2);
    expect(engine.currentTotal()).toBe(90);
  });

  it('returns false when there are no visits', () => {
    const engine = new ScoreTrainingEngine({
      durationType: 'ROUNDS',
      durationValue: 10,
      maxDartsPerTurn: 3,
    });
    expect(engine.undoLastVisit()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts -t "undoLastVisit"`

Expected: FAIL — `undoLastVisit` is not a function

- [ ] **Step 3: Write minimal implementation**

In `app/src/modules/game/score-training.engine.module.ts`, add:

```ts
/**
 * Pops the last visit recorded by this engine instance.
 * @returns true if a visit was removed; false if there was nothing to undo.
 */
undoLastVisit(): boolean {
  if (this.visits.length === 0) return false;
  this.visits.pop();
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts -t "undoLastVisit"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/score-training.engine.module.ts \
  app/tests/modules/game/score-training.engine.module.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): add undoLastVisit for Score Training

EOF
)"
```

---

### Task 2: `game.store` `undoLastTurn` (TDD)

**Files:**

- Modify: `app/src/stores/game.store.ts`
- Test: `app/tests/stores/game.store.test.ts`

**Interfaces:**

- Consumes: `turns: RecordedTurn[]`
- Produces: `undoLastTurn(): void` — `turns = turns.slice(0, -1)` when non-empty; no-op when empty

- [ ] **Step 1: Write the failing test**

In `app/tests/stores/game.store.test.ts`, after the `recordTurn` test, add:

```ts
it('undoLastTurn pops the last turn; no-op when empty', () => {
  const store = gameStore(stubPersistFactory());
  store.startSession({
    gameTypeKey: 'SCORE_TRAINING',
    sessionId: 's1',
    participantRef: 'p1',
    configSnapshot: { durationType: 'ROUNDS', durationValue: 10, maxDartsPerTurn: 3 },
  });
  store.recordTurn({ clientKey: 't1', sequence: 1, totalScore: 45, completedAt: null });
  store.recordTurn({ clientKey: 't2', sequence: 2, totalScore: 60, completedAt: null });
  store.undoLastTurn();
  expect(store.turns).toHaveLength(1);
  expect(store.turns[0].clientKey).toBe('t1');
  store.undoLastTurn();
  expect(store.turns).toEqual([]);
  store.undoLastTurn();
  expect(store.turns).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/stores/game.store.test.ts -t "undoLastTurn"`

Expected: FAIL — `undoLastTurn` is not a function

- [ ] **Step 3: Write minimal implementation**

In `app/src/stores/game.store.ts`, after `recordTurn`:

```ts
undoLastTurn() {
  if (this.turns.length === 0) return;
  this.turns = this.turns.slice(0, -1);
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/stores/game.store.test.ts -t "undoLastTurn"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/stores/game.store.ts app/tests/stores/game.store.test.ts
git commit -m "$(cat <<'EOF'
feat(store): add undoLastTurn for in-play visit correction

EOF
)"
```

---

### Task 3: Play factory — `undoVisit` (TDD)

**Files:**

- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**

- Consumes: `engine.undoLastVisit()`, `$store.game.undoLastTurn()`, `configSnapshot`
- Produces:
  - `undoVisit(this: ScoreTrainingPlayContext): void`
  - `$store.game.undoLastTurn(): void` on the context type
  - Resume-safe: when `undoLastVisit()` returns `false`, rebuild engine with `startingSequence: turns.length`

- [ ] **Step 1: Extend `gameStub` and types**

In `app/tests/lib/game/score-training-play.data.test.ts`, add to `GameStub`:

```ts
undoLastTurn: () => void;
```

And in `gameStub()`:

```ts
undoLastTurn: vi.fn(function (this: { turns: RecordedTurn[] }) {
  this.turns = this.turns.slice(0, -1);
}),
```

In every inline `$store.game` object that lists `recordTurn` / `reset` by hand (e.g. `makePlay` in Completion sequence), add:

```ts
undoLastTurn: vi.fn(function (this: { turns: RecordedTurn[] }) {
  this.turns = this.turns.slice(0, -1);
}),
```

In `app/src/lib/game/types.ts`, add to `$store.game`:

```ts
undoLastTurn(): void;
```

And to `ScoreTrainingPlayContext`:

```ts
undoVisit(this: ScoreTrainingPlayContext): void;
```

- [ ] **Step 2: Write the failing tests**

Append:

```ts
describe('undoVisit', () => {
  it('pops store + engine and clears visitInput; discards typed digits', async () => {
    const store = gameStub({
      configSnapshot: { durationType: 'ROUNDS', durationValue: 20, maxDartsPerTurn: 3 },
    });
    const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '45' };
    await component.init.call(component);
    await component.submitVisit.call(component);
    expect(store.turns).toHaveLength(1);

    component.visitInput = '99';
    component.undoVisit();

    expect(store.turns).toHaveLength(0);
    expect(store.undoLastTurn).toHaveBeenCalled();
    expect(component.visitInput).toBe('');
    expect(component.error).toBe('');
  });

  it('is a no-op when there are no turns', async () => {
    const store = gameStub({
      configSnapshot: { durationType: 'ROUNDS', durationValue: 20, maxDartsPerTurn: 3 },
    });
    const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '12' };
    await component.init.call(component);
    component.undoVisit();
    expect(store.undoLastTurn).not.toHaveBeenCalled();
    expect(component.visitInput).toBe('12');
  });

  it('after resume undo, next visit sequence continues from remaining turns', async () => {
    const store = gameStub({
      configSnapshot: { durationType: 'ROUNDS', durationValue: 20, maxDartsPerTurn: 3 },
      turns: [
        { clientKey: 't1', sequence: 1, totalScore: 40, completedAt: 'x' },
        { clientKey: 't2', sequence: 2, totalScore: 50, completedAt: 'x' },
      ],
    });
    const component = { ...scoreTrainingPlay(), $store: { game: store } };
    await component.init.call(component);
    // Engine was created with startingSequence=2 and empty visits — undoLastVisit returns false.
    component.undoVisit();
    expect(store.turns).toHaveLength(1);

    component.visitInput = '60';
    await component.submitVisit.call(component);
    const last = store.turns[store.turns.length - 1];
    expect(last.sequence).toBe(2);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "undoVisit"`

Expected: FAIL — `undoVisit` is not a function (or similar)

- [ ] **Step 4: Implement `undoVisit`**

In `app/src/lib/game/score-training-play.data.ts`:

```ts
undoVisit(this: ScoreTrainingPlayContext) {
  if (this.finished || this.showFinishConfirm) return;
  if (!this.engine || this.$store.game.turns.length === 0) return;

  this.$store.game.undoLastTurn();
  const poppedLocal = this.engine.undoLastVisit();
  if (!poppedLocal) {
    const config = this.$store.game.configSnapshot;
    if (!config) return;
    this.engine = new ScoreTrainingEngine({
      durationType: config.durationType,
      durationValue: config.durationValue,
      maxDartsPerTurn: config.maxDartsPerTurn,
      startingSequence: this.$store.game.turns.length,
    });
  }

  this.visitInput = "";
  this.error = "";
},
```

Note: `showFinishConfirm` is added in Task 4 — for this task, either add `showFinishConfirm: false` now (preferred) or omit the guard until Task 4. Prefer adding the field now as `showFinishConfirm: false` and `pendingFinishScore: null as number | null` so Task 4 only branches submit.

Also add to the factory return object (alongside other state):

```ts
pendingFinishScore: null as number | null,
showFinishConfirm: false,
```

And in `types.ts`:

```ts
pendingFinishScore: number | null;
showFinishConfirm: boolean;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "undoVisit"`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/score-training-play.data.ts \
  app/tests/lib/game/score-training-play.data.test.ts
git commit -m "$(cat <<'EOF'
feat(play): undoVisit pops last committed Score Training visit

EOF
)"
```

---

### Task 4: Pending finish gate — branch `submitVisit` + confirm/cancel (TDD)

**Files:**

- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**

- Consumes: `engine.isComplete(turnsSoFar, timerExpired)`, `engine.recordVisit`, `store.recordTurn`, `uploadAndCompleteSession`
- Produces:
  - Completing `submitVisit` → `pendingFinishScore` + `showFinishConfirm = true` (no commit, no upload)
  - `confirmFinish(): Promise<void>` — commit pending → `finished` + upload
  - `cancelFinish(): void` — restore `visitInput`, clear pending/confirm

- [ ] **Step 1: Write new failing tests**

```ts
describe('finish confirm gate', () => {
  it('completing submitVisit stashes pending score and does not commit or upload', async () => {
    const store = gameStub(); // durationValue: 2
    vi.mocked(appendBatch).mockResolvedValue({ created: { stages: 1, turns: 2, darts: 0 } });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: 's1',
      statusKey: 'COMPLETED',
      completedAt: 'now',
    });
    const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '30' };
    await component.init.call(component);
    await component.submitVisit.call(component); // visit 1
    component.visitInput = '55';
    await component.submitVisit.call(component); // would complete

    expect(store.turns).toHaveLength(1);
    expect(component.showFinishConfirm).toBe(true);
    expect(component.pendingFinishScore).toBe(55);
    expect(component.visitInput).toBe('');
    expect(component.finished).toBe(false);
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it('cancelFinish restores visitInput and clears pending without committing', async () => {
    const store = gameStub();
    const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '30' };
    await component.init.call(component);
    await component.submitVisit.call(component);
    component.visitInput = '55';
    await component.submitVisit.call(component);

    component.cancelFinish();

    expect(component.showFinishConfirm).toBe(false);
    expect(component.pendingFinishScore).toBeNull();
    expect(component.visitInput).toBe('55');
    expect(store.turns).toHaveLength(1);
    expect(component.finished).toBe(false);
  });

  it('confirmFinish commits pending, sets finished, and uploads', async () => {
    const store = gameStub();
    vi.mocked(appendBatch).mockResolvedValue({ created: { stages: 1, turns: 2, darts: 0 } });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: 's1',
      statusKey: 'COMPLETED',
      completedAt: 'now',
    });
    const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '30' };
    await component.init.call(component);
    await component.submitVisit.call(component);
    component.visitInput = '55';
    await component.submitVisit.call(component);

    await component.confirmFinish.call(component);

    expect(store.turns).toHaveLength(2);
    expect(store.turns[1].totalScore).toBe(55);
    expect(component.showFinishConfirm).toBe(false);
    expect(component.pendingFinishScore).toBeNull();
    expect(component.finished).toBe(true);
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith('s1', 'COMPLETED');
    expect(component.completionStatus).toBe('succeeded');
  });

  it('undoVisit is a no-op while finish confirm is open', async () => {
    const store = gameStub();
    const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '30' };
    await component.init.call(component);
    await component.submitVisit.call(component);
    component.visitInput = '55';
    await component.submitVisit.call(component);
    const turnsBefore = store.turns.length;

    component.undoVisit();

    expect(store.turns).toHaveLength(turnsBefore);
  });
});
```

- [ ] **Step 2: Update existing tests that assumed immediate completion on final submit**

These currently call `submitVisit` twice and expect `finished` / upload. After each completing `submitVisit`, add `await component.confirmFinish.call(component)` (or the local variable name).

Update at least:

1. `'uploads the batch and completes the session on the final visit'`
2. `'submitVisit is a no-op when finished is already true'`
3. `'sets finished and completionStatus pending on final visit before upload settles'`
4. `'retries uploadAndCompleteSession without recording a new turn'`

Example for (1):

```ts
it('uploads the batch and completes the session on the final visit', async () => {
  const store = gameStub();
  vi.mocked(appendBatch).mockResolvedValue({ created: { stages: 1, turns: 2, darts: 0 } });
  vi.mocked(completeSession).mockResolvedValue({
    sessionId: 's1',
    statusKey: 'COMPLETED',
    completedAt: 'now',
  });
  const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '30' };
  await component.init.call(component);
  await component.submitVisit.call(component); // visit 1
  component.visitInput = '30';
  await component.submitVisit.call(component); // visit 2 — opens confirm
  expect(component.showFinishConfirm).toBe(true);
  expect(appendBatch).not.toHaveBeenCalled();

  await component.confirmFinish.call(component);

  expect(appendBatch).toHaveBeenCalledTimes(1);
  expect(completeSession).toHaveBeenCalledWith('s1', 'COMPLETED');
  expect(component.finished).toBe(true);
  expect(component.completionStatus).toBe('succeeded');
  expect(store.reset).not.toHaveBeenCalled();
});
```

Apply the same `confirmFinish` step to the other three.

- [ ] **Step 3: Run tests to verify new ones fail / updated ones fail for the right reason**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "finish confirm|final visit|finished is already|pending on final|retries upload"`

Expected: FAIL — missing `confirmFinish` / completing submit still uploads immediately

- [ ] **Step 4: Implement branching + confirm/cancel**

In `types.ts` add:

```ts
confirmFinish(this: ScoreTrainingPlayContext): Promise<void>;
cancelFinish(this: ScoreTrainingPlayContext): void;
```

Replace `submitVisit` body with:

```ts
async submitVisit(this: ScoreTrainingPlayContext) {
  if (!this.engine || this.finished || this.showFinishConfirm) return;

  const score = Number(this.visitInput);
  if (!Number.isInteger(score) || score < 0 || score > 180) {
    this.error = "Enter a score between 0 and 180.";
    return;
  }
  this.error = "";

  const timerExpired = this.$store.game.timerExpired ?? false;
  const wouldComplete = this.engine.isComplete(
    this.$store.game.turns.length + 1,
    timerExpired,
  );

  if (wouldComplete) {
    this.pendingFinishScore = score;
    this.visitInput = "";
    this.showFinishConfirm = true;
    return;
  }

  this.visitInput = "";
  const visit = this.engine.recordVisit(score);
  this.$store.game.recordTurn(visit);
},
```

Add:

```ts
async confirmFinish(this: ScoreTrainingPlayContext) {
  if (!this.engine || this.finished || !this.showFinishConfirm) return;
  if (this.pendingFinishScore == null) return;

  const score = this.pendingFinishScore;
  this.pendingFinishScore = null;
  this.showFinishConfirm = false;

  const visit = this.engine.recordVisit(score);
  this.$store.game.recordTurn(visit);

  this.finished = true;
  this.completionStatus = "pending";
  await this.uploadAndCompleteSession();
},

cancelFinish(this: ScoreTrainingPlayContext) {
  if (!this.showFinishConfirm || this.pendingFinishScore == null) return;
  this.visitInput = String(this.pendingFinishScore);
  this.pendingFinishScore = null;
  this.showFinishConfirm = false;
},
```

Optionally guard keypad helpers:

```ts
appendDigit(this: ScoreTrainingPlayContext, digit: number) {
  if (this.showFinishConfirm || this.finished) return;
  // ...existing body
},
deleteLast(this: ScoreTrainingPlayContext) {
  if (this.showFinishConfirm || this.finished) return;
  this.visitInput = this.visitInput.slice(0, -1);
},
clearVisitInput(this: ScoreTrainingPlayContext) {
  if (this.showFinishConfirm || this.finished) return;
  this.visitInput = "";
},
```

- [ ] **Step 5: Run full play test file**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/score-training-play.data.ts \
  app/tests/lib/game/score-training-play.data.test.ts
git commit -m "$(cat <<'EOF'
feat(play): gate Score Training finish behind confirm modal state

EOF
)"
```

---

### Task 5: Wire `ScoreInput` + finish-confirm overlay

**Files:**

- Modify: `app/src/components/layout/games/ScoreInput.astro`
- Modify: `app/src/pages/games/score-training/play/index.astro`

**Interfaces:**

- Consumes: parent-scope `undoVisit`, `showFinishConfirm`, `finished`, `$store.game.turns`, `confirmFinish`, `cancelFinish`
- Produces: working undo button + finish-confirm UI (no new `.ts` modules)

- [ ] **Step 1: Rewire ScoreInput left button**

Replace the clear/undo control in `app/src/components/layout/games/ScoreInput.astro`:

```astro
<InputButton
  class="flex-1 h-full"
  aria-label="Undo last visit"
  :disabled="!$store.game.turns.length || showFinishConfirm || finished"
  @click="undoVisit()"
>
  <UndoIcon class="size-6 text-fg-subtle" />
</InputButton>
```

Also disable Submit while confirm is open (keep existing `!visitInput` check):

```astro
:disabled="!visitInput || showFinishConfirm || finished"
```

And digit buttons / delete — either leave as-is (factory no-ops) or add `:disabled="showFinishConfirm || finished"` on the keypad row `InputButton`s. Prefer factory no-ops from Task 4; optional UI disable for clarity on the three bottom controls + number pad is fine if done consistently.

- [ ] **Step 2: Add finish-confirm overlay on play**

In `app/src/pages/games/score-training/play/index.astro`, insert **before** the results modal (so confirm stacks under results only after confirm). Match `ExitModal` / results styling:

```astro
{/* Finish confirm (before results) */}
<div
  class="fixed inset-0 flex items-center justify-center bg-black/70 z-50 p-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="finish-confirm-title"
  x-show="showFinishConfirm"
  x-cloak
>
  <div class="bg-bg rounded-lg shadow-lg p-6 max-w-sm surface w-full">
    <h2 id="finish-confirm-title" class="text-lg font-semibold text-fg">Finish session?</h2>
    <p class="text-sm text-fg-muted mt-2">
      This visit completes the session. Confirm to save, or cancel to adjust the score.
    </p>
    <div class="flex gap-3 mt-6 justify-end">
      <button type="button" class="btn btn-ghost" @click="cancelFinish()">
        Cancel
      </button>
      <button type="button" class="btn btn-primary" @click="confirmFinish()">
        Confirm
      </button>
    </div>
  </div>
</div>
```

Ensure gameplay view can still show behind the overlay (`x-show` for gameplay stays `!finished && hasActiveSession` — confirm does not set `finished`).

- [ ] **Step 3: Manual smoke (dev server)**

Run: `cd app && npx astro dev` (or `astro dev --background`)

Check:

1. Submit non-final visit → undo removes it; total drops; input empty
2. Submit final visit → confirm modal; Cancel restores score in input; turns unchanged
3. Confirm → results modal + save flow

- [ ] **Step 4: Commit**

```bash
git add app/src/components/layout/games/ScoreInput.astro \
  app/src/pages/games/score-training/play/index.astro
git commit -m "$(cat <<'EOF'
feat(ui): wire undo visit and finish-confirm modal on play

EOF
)"
```

---

### Task 6: Decision ledger + verify suite

**Files:**

- Modify: `DECISIONS.md`
- (No context-map registration for `docs/superpowers/**` — historical/spec area)

**Interfaces:**

- Produces: `D122` one-liner

- [ ] **Step 1: Add D122**

In `DECISIONS.md` Frontend / app table (after D121), add:

```md
| D122 | 2026-07-21 | Score Training completing visits use a client-side `pendingFinishScore` + finish-confirm modal before results/upload; Cancel restores the score into `visitInput` without committing; Confirm commits then reuses the D119 hard-gate. In-play undo pops the last committed turn (store + engine; resume-safe engine rebuild when the instance has no local visits). | Lets players correct the last score before irreversible completion upload |
```

Bump the `updated:` HTML comment date to `2026-07-21` if present.

- [ ] **Step 2: Run full app tests**

Run: `cd app && npm test`

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add DECISIONS.md
git commit -m "$(cat <<'EOF'
docs: record D122 Score Training undo + finish confirm

EOF
)"
```

---

## Self-Review (plan vs spec)

| Spec requirement | Task |
| ---------------- | ---- |
| Undo pops visit, empty input | Task 3 + 5 |
| Undo discards typed digits | Task 3 |
| Completing submit pending (no commit) | Task 4 |
| Confirm → commit + results/upload | Task 4 + 5 |
| Cancel → restore input, no commit | Task 4 + 5 |
| Disable undo/keypad while confirm | Task 3/4 guards + Task 5 UI |
| Store `undoLastTurn` | Task 2 |
| Engine `undoLastVisit` | Task 1 |
| Resume-safe sequence after undo | Task 3 resume test |
| Update tests that assumed immediate finish | Task 4 Step 2 |
| D122 / DECISIONS | Task 6 |
| No Vitest for `.astro` | Task 5 (manual smoke only) |

**Placeholder scan:** none intentional.

**Type consistency:** `pendingFinishScore: number | null`, `showFinishConfirm: boolean`, `undoVisit()`, `confirmFinish()`, `cancelFinish()`, `undoLastTurn()`, `undoLastVisit(): boolean` — same names across tasks.
