# Score Training Play UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Score Training play to `GameLayout` + game components (`ScoreInput`, `SinglePlayerDisplay`, `ExitModal`), move keypad state onto `scoreTrainingPlay()`, and implement explicit in-game abandon (batch + `ABANDONED` + store reset) without treating browser close as abandon.

**Architecture:** Play routes use a new `GameLayout` (exit header + confirm modal, no `BottomNav`). `ScoreInput` loses its inline `x-data` and binds parent-scope `visitInput` / keypad helpers. `SinglePlayerDisplay` accepts Alpine expression strings (`score` / `target`) with `isTarget` selecting which value and label to show. Exit confirm dispatches `confirm-exit`; the play factory's `abandonAndExit()` uploads partial turns (if any), PATCHes `ABANDONED`, resets `$persist` state, and navigates to `/games`. Browser close/refresh does nothing server-side — `$persist` + D88 resume handle return.

**Tech Stack:** Astro, Alpine.js v3, TypeScript, Vitest, existing `@client/api/sessions` (`appendBatch`, `completeSession`), `buildEventsBatch` from `@modules/game/score-training.payload.module`

## Global Constraints

- Keep factory field name `visitInput` and method name `submitVisit` — do **not** rename to `score` / `submitScore`
- Score Training play: `<SinglePlayerDisplay isTarget={false} score="..." />` (scoring game, not target game)
- `isTarget` default `true` (most future games are target games); `false` → show `score`, label `"Score"`; `true` → show `target`, label `"Target"`
- Browser close / refresh / navigate-away without Leave confirm → **no** API call; `$persist` retains state
- Manual Leave confirm → `appendBatch` if `turns.length > 0`, then `completeSession(id, "ABANDONED")`, then `store.reset()`, then `/games`
- Alpine-expression-as-Astro-prop for `x-text` / `:bind` values: pass the prop directly — `x-text={prop}` or `x-text={isTarget ? target : score}`. Do **not** wrap with `` `'${prop}'` ``; that emits a quoted string literal Alpine will not evaluate.
- Click-handler Astro props are already Alpine expressions: use `@click={click}` (do **not** wrap with `'${click}'` — that turns the handler into a string literal)
- Every element with `x-show` must also have `x-cloak`
- No Vitest for `.astro` markup (D101)
- No git worktrees — branch in the main working copy (`git checkout -b …`)
- Commit only when the user asks (or when a plan step says commit and the executing human/agent has been told to commit)

## File Structure

**Create:**

| File                                              | Responsibility                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `app/src/components/layout/games/ExitModal.astro` | Presentational leave-confirm dialog; parent provides `showExitModal` |
| `app/src/layouts/GameLayout.astro`                | Play shell: exit button + `ExitModal`, no `BottomNav`                |

**Modify:**

| File                                                        | Responsibility                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `app/src/lib/game/types.ts`                                 | Extend `ScoreTrainingPlayContext` with keypad helpers + `abandonAndExit` / `abandonLoading` |
| `app/src/lib/game/score-training-play.data.ts`              | Keypad methods + `abandonAndExit()`                                                         |
| `app/tests/lib/game/score-training-play.data.test.ts`       | TDD for keypad helpers, validation clear behavior, abandon flows                            |
| `app/src/components/layout/games/ScoreInput.astro`          | Remove inline `x-data`; bind `visitInput`; `click` prop                                     |
| `app/src/components/layout/games/SinglePlayerDisplay.astro` | Alpine expression props + `isTarget` semantics                                              |
| `app/src/pages/games/score-training/play/index.astro`       | `GameLayout`, components, `@confirm-exit`, `x-cloak` gaps                                   |
| `DECISIONS.md`                                              | One-liner for `GameLayout` / in-game abandon                                                |
| `docs/architecture/07-Frontend/03-Alpine-Patterns.md`       | Expression-prop + `x-show`/`x-cloak` + no `;`-separated `@click`                            |
| `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`  | Mirror Alpine rules                                                                         |
| `docs/architecture/07-Frontend/07-Style-Guide.md`           | Harden `x-show` + `x-cloak`                                                                 |
| `docs/architecture/07-Frontend/05-Astro-Components.md`      | `SinglePlayerDisplay` pattern note                                                          |
| `docs/architecture/07-Frontend/02-Folder-Structure.md`      | Note `GameLayout` under `layouts/` if inventory lists layouts                               |

**Do not touch:**

| File                                                   | Why                                                   |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `app/src/lib/game/score-training-setup.data.ts`        | Setup abandon stays PATCH-only (no batch)             |
| `app/src/pages/games/score-training/setup/index.astro` | Stays on `AppLayout`                                  |
| `app/src/layouts/AppLayout.astro`                      | Hub/setup only                                        |
| Results modal markup on play                           | Unchanged behavior (only layout wrapper / cloak gaps) |

---

### Task 1: Keypad helpers on `scoreTrainingPlay` (TDD)

**Files:**

- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**

- Consumes: existing `visitInput: string`, `submitVisit()`
- Produces:
  - `appendDigit(this: ScoreTrainingPlayContext, digit: number): void`
  - `deleteLast(this: ScoreTrainingPlayContext): void`
  - `clearVisitInput(this: ScoreTrainingPlayContext): void`
  - Invalid `submitVisit` leaves `visitInput` unchanged

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/game/score-training-play.data.test.ts`:

```ts
describe('keypad helpers + visitInput validation', () => {
  it('appendDigit appends digits and rejects length > 3', () => {
    const component = { ...scoreTrainingPlay(), $store: { game: gameStub() } };
    component.appendDigit(1);
    component.appendDigit(8);
    component.appendDigit(0);
    expect(component.visitInput).toBe('180');
    component.appendDigit(0);
    expect(component.visitInput).toBe('180');
  });

  it('appendDigit replaces a lone "0" instead of prefixing', () => {
    const component = { ...scoreTrainingPlay(), $store: { game: gameStub() } };
    component.appendDigit(0);
    expect(component.visitInput).toBe('0');
    component.appendDigit(5);
    expect(component.visitInput).toBe('5');
  });

  it('deleteLast removes the last character; clearVisitInput empties', () => {
    const component = {
      ...scoreTrainingPlay(),
      $store: { game: gameStub() },
      visitInput: '45',
    };
    component.deleteLast();
    expect(component.visitInput).toBe('4');
    component.clearVisitInput();
    expect(component.visitInput).toBe('');
  });

  it('submitVisit rejects non-integer / out-of-range and does not clear visitInput', async () => {
    const store = gameStub();
    const component = {
      ...scoreTrainingPlay(),
      $store: { game: store },
      visitInput: '999',
    };
    await component.init.call(component);
    await component.submitVisit.call(component);
    expect(component.error).toBe('Enter a score between 0 and 180.');
    expect(component.visitInput).toBe('999');
    expect(store.recordTurn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "keypad helpers"
```

Expected: FAIL — `appendDigit` / `clearVisitInput` not defined (or similar).

- [ ] **Step 3: Extend** `ScoreTrainingPlayContext` **in** `types.ts`

Add to the type (keep existing fields):

```ts
  abandonLoading: boolean;
  appendDigit(this: ScoreTrainingPlayContext, digit: number): void;
  deleteLast(this: ScoreTrainingPlayContext): void;
  clearVisitInput(this: ScoreTrainingPlayContext): void;
  abandonAndExit(this: ScoreTrainingPlayContext): Promise<void>;
```

(`abandonLoading` / `abandonAndExit` land in Task 2; adding them to the type now avoids a second types edit — implement stubs that throw or leave `abandonAndExit` for Task 2 only if you prefer a tighter Task 1. Prefer adding type members only when implemented: add keypad three methods in Task 1; add `abandonLoading` + `abandonAndExit` in Task 2.)

Task 1 type additions only:

```ts
  appendDigit(this: ScoreTrainingPlayContext, digit: number): void;
  deleteLast(this: ScoreTrainingPlayContext): void;
  clearVisitInput(this: ScoreTrainingPlayContext): void;
```

- [ ] **Step 4: Implement keypad helpers in** `score-training-play.data.ts`

Inside the object returned by `scoreTrainingPlay()`, next to `visitInput: ""`:

```ts
appendDigit(this: ScoreTrainingPlayContext, digit: number) {
  const next = this.visitInput === "0" ? String(digit) : this.visitInput + String(digit);
  if (next.length > 3) return;
  this.visitInput = next;
},

deleteLast(this: ScoreTrainingPlayContext) {
  this.visitInput = this.visitInput.slice(0, -1);
},

clearVisitInput(this: ScoreTrainingPlayContext) {
  this.visitInput = "";
},
```

Confirm existing `submitVisit` already clears `visitInput` only after successful validation (it does today). No rename.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "keypad helpers"
```

Expected: PASS

- [ ] **Step 6: Commit** (only if user asked to commit)

```bash
git add app/src/lib/game/types.ts app/src/lib/game/score-training-play.data.ts app/tests/lib/game/score-training-play.data.test.ts
git commit -m "$(cat <<'EOF'
feat(play): move score keypad helpers onto scoreTrainingPlay factory

EOF
)"
```

---

### Task 2: `abandonAndExit` (TDD)

**Files:**

- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**

- Consumes: `appendBatch`, `completeSession`, `buildEventsBatch` (already imported in play factory), `$store.game.turns` / `sessionId` / `participantRef` / `idempotencyKey` / `reset()`
- Produces: `abandonLoading: boolean`, `abandonAndExit(): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```ts
describe('abandonAndExit', () => {
  function makeAbandonPlay(gameOverrides: Partial<GameStub> = {}) {
    return {
      ...scoreTrainingPlay(),
      $store: { game: gameStub(gameOverrides) },
    };
  }

  it('with turns: appendBatch then completeSession ABANDONED, reset, navigate /games', async () => {
    const locationSpy = { href: '' };
    vi.stubGlobal('location', locationSpy);
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: 's1',
      statusKey: 'ABANDONED',
      completedAt: 'now',
    });
    const play = makeAbandonPlay({
      turns: [
        {
          clientKey: 't1',
          sequence: 1,
          totalScore: 60,
          completedAt: '2026-07-21T10:00:00Z',
        },
      ],
    });

    await play.abandonAndExit.call(play);

    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith('s1', 'ABANDONED');
    expect(play.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe('/games');
  });

  it('with zero turns: skips batch, PATCHes ABANDONED, reset, navigate', async () => {
    const locationSpy = { href: '' };
    vi.stubGlobal('location', locationSpy);
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: 's1',
      statusKey: 'ABANDONED',
      completedAt: 'now',
    });
    const play = makeAbandonPlay({ turns: [] });

    await play.abandonAndExit.call(play);

    expect(appendBatch).not.toHaveBeenCalled();
    expect(completeSession).toHaveBeenCalledWith('s1', 'ABANDONED');
    expect(play.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe('/games');
  });

  it('ignores a second call while abandonLoading is true', async () => {
    let resolveComplete!: (
      v: Awaited<ReturnType<typeof completeSession>>,
    ) => void;
    vi.mocked(completeSession).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveComplete = resolve;
        }),
    );
    const play = makeAbandonPlay();

    const first = play.abandonAndExit.call(play);
    const second = play.abandonAndExit.call(play);
    expect(completeSession).toHaveBeenCalledTimes(1);

    resolveComplete({
      sessionId: 's1',
      statusKey: 'ABANDONED',
      completedAt: 'now',
    });
    await Promise.all([first, second]);
    expect(completeSession).toHaveBeenCalledTimes(1);
  });

  it('sets error on PATCH failure and does not navigate or reset', async () => {
    const locationSpy = { href: '/games/score-training/play' };
    vi.stubGlobal('location', locationSpy);
    vi.mocked(completeSession).mockRejectedValue(new Error('Network error'));
    const play = makeAbandonPlay();

    await play.abandonAndExit.call(play);

    expect(play.error).toBe('Could not abandon session. Try again.');
    expect(play.abandonLoading).toBe(false);
    expect(play.$store.game.reset).not.toHaveBeenCalled();
    expect(locationSpy.href).toBe('/games/score-training/play');
  });

  it('with no sessionId: reset and navigate without API calls', async () => {
    const locationSpy = { href: '' };
    vi.stubGlobal('location', locationSpy);
    const play = makeAbandonPlay({ sessionId: null });

    await play.abandonAndExit.call(play);

    expect(appendBatch).not.toHaveBeenCalled();
    expect(completeSession).not.toHaveBeenCalled();
    expect(play.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe('/games');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "abandonAndExit"
```

Expected: FAIL — `abandonAndExit` missing.

- [ ] **Step 3: Extend types**

```ts
  abandonLoading: boolean;
  abandonAndExit(this: ScoreTrainingPlayContext): Promise<void>;
```

- [ ] **Step 4: Implement** `abandonAndExit` **in the factory**

Add `abandonLoading: false` to initial state. Implement:

```ts
async abandonAndExit(this: ScoreTrainingPlayContext) {
  if (this.abandonLoading) return;
  const sessionId = this.$store.game.sessionId;
  if (!sessionId) {
    this.$store.game.reset();
    globalThis.location.href = "/games";
    return;
  }
  this.abandonLoading = true;
  this.error = "";
  try {
    const turns = this.$store.game.turns;
    if (turns.length > 0) {
      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const completedTurns = turns.map((turn) => ({
        ...turn,
        completedAt: turn.completedAt ?? new Date().toISOString(),
      }));
      const batch = buildEventsBatch(this.$store.game.participantRef!, completedTurns);
      await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
    }
    await completeSession(sessionId, "ABANDONED");
    this.timer?.stop();
    this.$store.game.reset();
    globalThis.location.href = "/games";
  } catch {
    this.error = "Could not abandon session. Try again.";
    this.abandonLoading = false;
  }
},
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts
```

Expected: all tests in the file PASS (including existing suite).

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add app/src/lib/game/types.ts app/src/lib/game/score-training-play.data.ts app/tests/lib/game/score-training-play.data.test.ts
git commit -m "$(cat <<'EOF'
feat(play): abandonAndExit batches turns then marks session ABANDONED

EOF
)"
```

---

### Task 3: `ExitModal` + `GameLayout`

**Files:**

- Create: `app/src/components/layout/games/ExitModal.astro`
- Create: `app/src/layouts/GameLayout.astro`

**Interfaces:**

- Consumes: `@layouts/BaseLayout.astro`, `@icons/exit.svg`, parent Alpine scope `{ showExitModal: boolean }`
- Produces: layout that slots play content; Leave dispatches `confirm-exit` (window-listened by play page in Task 6)

- [ ] **Step 1: Create** `ExitModal.astro`

```astro
---
// Presentational — parent GameLayout owns showExitModal
---

<div
  class="fixed inset-0 flex items-center justify-center bg-black/70 z-50 p-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="exit-modal-title"
  @click.self="showExitModal = false"
>
  <div class="bg-bg rounded-lg shadow-lg p-6 max-w-sm surface w-full">
    <h2 id="exit-modal-title" class="text-lg font-semibold text-fg">Leave game?</h2>
    <p class="text-sm text-fg-muted mt-2">
      This session will be recorded as abandoned.
    </p>
    <div class="flex gap-3 mt-6 justify-end">
      <button type="button" class="btn btn-ghost" @click="showExitModal = false">
        Cancel
      </button>
      <button type="button" class="btn btn-primary" @click="$dispatch('confirm-exit')">
        Leave
      </button>
    </div>
  </div>
</div>
```

Use the copy from the approved spec exactly: title **"Leave game?"**, body **"This session will be recorded as abandoned."**

- [ ] **Step 2: Create** `GameLayout.astro`

```astro
---
import BaseLayout from "@layouts/BaseLayout.astro";
import ExitModal from "@components/layout/games/ExitModal.astro";
import ExitIcon from "@icons/exit.svg";

interface Props {
  title?: string;
}

const { title }: Props = Astro.props;
---

<BaseLayout title={title}>
  <div class="app-shell" x-data="{ showExitModal: false }">
    <header class="flex items-center p-3">
      <button
        type="button"
        class="btn btn-ghost p-2"
        aria-label="Exit game"
        @click="showExitModal = true"
      >
        <ExitIcon class="size-6 text-fg-subtle" />
      </button>
    </header>
    <main class="app-main">
      <slot />
    </main>
    <template x-if="showExitModal">
      <ExitModal />
    </template>
  </div>
</BaseLayout>
```

No `BottomNav`. Mirror `AppLayout` shell classes (`app-shell` / `app-main`).

- [ ] **Step 3: Smoke-check imports resolve**

```bash
cd app && npx astro check 2>&1 | head -80
```

Expected: no errors naming `GameLayout` / `ExitModal` / `@icons/exit.svg`. (Other pre-existing diagnostics may appear — only fail this step on new import errors.)

- [ ] **Step 4: Commit** (only if user asked)

```bash
git add app/src/components/layout/games/ExitModal.astro app/src/layouts/GameLayout.astro
git commit -m "$(cat <<'EOF'
feat(ui): add GameLayout and ExitModal for in-game exit chrome

EOF
)"
```

---

### Task 4: Refactor `ScoreInput.astro`

**Files:**

- Modify: `app/src/components/layout/games/ScoreInput.astro`

**Interfaces:**

- Consumes: parent scope `visitInput`, `appendDigit`, `deleteLast`, `clearVisitInput`; prop `click?: string` (e.g. `"submitVisit()"`)
- Produces: presentational keypad with no own `x-data`

- [ ] **Step 1: Replace the component**

Follow `05-Astro-Components.md` frontmatter order and `@client/cn` (same as `Button.astro` / `NavBtn.astro`):

```astro
---
interface Props {
  click?: string;
  class?: string;
}

// Props
const { click = "submitVisit()", class: classNameProp }: Props = Astro.props;

// Components
import InputButton from "./InputButton.astro";
// Icons
import DeleteIcon from "@icons/delete.svg";
import UndoIcon from "@icons/undo.svg";
// Lib
import { cn } from "@client/cn";

// Data
const numberRows = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

// Styles
const rootClass = cn("flex flex-1 flex-col gap-3 p-2", classNameProp);
---

<div class={rootClass}>
  <div class="flex items-center gap-3">
    <div
      class="surface-elevated flex min-h-11 flex-1 items-center justify-center rounded-lg px-4"
    >
      <span
        class="text-4xl font-mono font-bold tabular-nums"
        :class="!visitInput && 'text-fg-subtle'"
        x-text="visitInput || '0'"
      ></span>
    </div>
    <button
      type="button"
      class="btn btn-primary shrink-0 rounded-md px-5 disabled:pointer-events-none disabled:opacity-40"
      :disabled="!visitInput"
      @click={click}
    >
      Submit
    </button>
  </div>

  <div class="surface flex flex-1 flex-col gap-1.5 p-3 w-full">
    {
      numberRows.map((row) => (
        <div class="flex gap-1.5 w-full">
          {row.map((value) => (
            <InputButton @click={`appendDigit(${value})`}>{value}</InputButton>
          ))}
        </div>
      ))
    }
    <div class="flex gap-2 w-full">
      <InputButton class="p-0" aria-label="Clear score" @click="clearVisitInput()">
        <UndoIcon class="size-6 text-fg-subtle" />
      </InputButton>
      <InputButton @click="appendDigit(0)">0</InputButton>
      <InputButton aria-label="Delete last digit" @click="deleteLast()">
        <DeleteIcon class="size-6 text-fg-subtle" />
      </InputButton>
    </div>
  </div>
</div>
```

Notes:

- If the linter rejects `@click` on `InputButton`, use the Astro escape hatch only for those attributes: `{...{ "x-on:click": \`appendDigit(${value}) }}` — nowhere else.
- Do **not** wrap the submit handler as `@click={`'${click}'`}` — that quotes the call into a string literal.

- [ ] **Step 2: Commit** (only if user asked)

```bash
git add app/src/components/layout/games/ScoreInput.astro
git commit -m "$(cat <<'EOF'
refactor(ScoreInput): bind parent visitInput; drop inline x-data

EOF
)"
```

---

### Task 5: Refactor `SinglePlayerDisplay.astro`

**Files:**

- Modify: `app/src/components/layout/games/SinglePlayerDisplay.astro`

**Interfaces:**

- Consumes: `score?: string`, `target?: string` (Alpine expression strings), `isTarget?: boolean` (default `true`)
- Produces: `x-text` primary value + label from `isTarget`

- [ ] **Step 1: Replace the component**

```astro
---
interface Props {
  score?: string;
  target?: string;
  isTarget?: boolean;
}

// Props
const { score, target, isTarget = true }: Props = Astro.props;
---

{
  /** TODO:
   * Add checkout route tips based on configuration (if config.showRoutes && isTarget)
   * Note: config not yet implemented, deferred
   */
}
<div class="px-3 flex-1 surface">
  <div
    class="container h-full p-3 mx-auto flex-1 flex flex-col items-center justify-center rounded"
  >
    <h1
      class="text-7xl font-mono font-bold tabular-nums"
      x-text={isTarget ? target : score}
    ></h1>
    <span class="text-sm text-fg-subtle uppercase">
      {isTarget ? "Target" : "Score"}
    </span>
    {
      /**
       * TODO: progress slot — darts thrown, 3-dart avg, previous score (per game).
       * Out of scope for Score Training play UI.
       */
    }
    <slot name="progress" />
  </div>
</div>
```

- [ ] **Step 2: Commit** (only if user asked)

```bash
git add app/src/components/layout/games/SinglePlayerDisplay.astro
git commit -m "$(cat <<'EOF'
refactor(SinglePlayerDisplay): Alpine expression props for score/target

EOF
)"
```

---

### Task 6: Wire play page

**Files:**

- Modify: `app/src/pages/games/score-training/play/index.astro`

**Interfaces:**

- Consumes: `GameLayout`, `ScoreInput`, `SinglePlayerDisplay`, `abandonAndExit`, `submitVisit`
- Produces: play UI without `AppLayout` / `Input` / form submit button / inline total

- [ ] **Step 1: Replace play page shell and gameplay branch**

Frontmatter:

```astro
---
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
import Button from "@components/forms/Button.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
---
```

Root:

```astro
<GameLayout title="Score Training — Play">
  <div
    class="flex flex-col flex-1 min-h-0"
    x-data="scoreTrainingPlay()"
    @confirm-exit.window="abandonAndExit()"
  >
```

Gameplay branch (replace the current form + live total):

```astro
    <div
      class="flex flex-col flex-1 min-h-0"
      x-show="!finished && hasActiveSession"
      x-cloak
    >
      <p
        class="text-sm text-fg-muted px-3"
        x-show="$store.game.configSnapshot?.durationType === 'MINUTES'"
        x-text="`Time remaining: ${remainingLabel()}`"
        x-cloak
      ></p>
      <p
        class="text-sm text-fg-muted px-3"
        x-show="$store.game.configSnapshot?.durationType === 'ROUNDS'"
        x-text="`Visit ${$store.game.turns.length + 1}`"
        x-cloak
      ></p>

      <SinglePlayerDisplay
        isTarget={false}
        score="$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0)"
      />

      <p
        class="px-3 mt-2 text-sm text-red-500"
        x-show="error"
        x-text="error"
        x-cloak
      ></p>

      <ScoreInput click="submitVisit()" />
    </div>
```

- [ ] **Step 2: Add missing** `x-cloak` **on every remaining** `x-show`

In the same file, ensure **every** `x-show` element also has `x-cloak`, including results-modal inner branches that currently lack it (e.g. `completionStatus !== 'succeeded'`, `completionStatus === 'failed'`, `playAgainError`, saving/succeeded status lines). Do not change results-modal behavior — cloak only.

- [ ] **Step 3: Keep reconciliation / no-session / results modal structure**

Do not remove the results modal or change its action wiring (`back`, `playAgain`, `uploadAndCompleteSession`). Only the layout wrapper and gameplay input/display change.

- [ ] **Step 4: Manual smoke checklist** (dev server)

```bash
cd app && astro dev --background
```

| Check                         | Expected                                                               |
| ----------------------------- | ---------------------------------------------------------------------- |
| Open play with active session | No bottom nav; exit icon top-left; keypad; running total labeled Score |
| Enter score + Submit          | Visit recorded; total updates; input clears                            |
| Refresh mid-game              | Session resumes; turns preserved; no abandon PATCH                     |
| Exit → Cancel                 | Modal closes; still playing                                            |
| Exit → Leave with turns       | Batch + ABANDONED; redirected to `/games`; local store cleared         |
| Exit → Leave with 0 turns     | ABANDONED only; `/games`                                               |
| Finish a game                 | Results modal still works                                              |

Stop when done: `astro dev stop`.

- [ ] **Step 5: Run unit tests**

```bash
cd app && npm test
```

Expected: PASS

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add app/src/pages/games/score-training/play/index.astro
git commit -m "$(cat <<'EOF'
feat(play): wire GameLayout, ScoreInput, and SinglePlayerDisplay

EOF
)"
```

---

### Task 7: Docs + context maintenance

**Files:**

- Modify: `DECISIONS.md`
- Modify: `docs/architecture/07-Frontend/03-Alpine-Patterns.md`
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md`
- Modify: `docs/architecture/07-Frontend/05-Astro-Components.md`
- Modify: `docs/architecture/07-Frontend/02-Folder-Structure.md` (only if layouts are listed by name)
- Possibly: `docs/architecture/00-Context-Map.md` ISO date touch if inventory rows change

**Interfaces:**

- Consumes: approved spec rules
- Produces: hardened agent-facing Alpine rules + decision ledger entry

- [ ] **Step 1: Add** `DECISIONS.md` **row**

Next free id after D120 → **D121**:

| #    | Source     | Decision                                                                                                                                                                                                                                                      | Rationale                                                                        |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| D121 | 2026-07-21 | Game **play** routes use `GameLayout` (exit chrome + confirm modal, no `BottomNav`). In-game Leave → `appendBatch` when turns exist, then `PATCH ABANDONED`, then `store.reset()` + `/games`. Browser close/refresh is not abandon — `$persist` + D88 resume. | Separates resume-friendly persistence from explicit session close for statistics |

- [ ] **Step 2: Harden** `03-Alpine-Patterns.md`

Add a short section (near directive syntax / Astro exception), dated `<!-- 2026-07-21 -->`:

1. **Alpine-expression-as-Astro-prop:** when an Astro prop holds an Alpine expression rendered into `x-text` / bind attributes, pass it directly — `x-text={prop}` or `x-text={isTarget ? target : score}`. Do **not** wrap with `` `'${prop}'` ``; that emits a quoted string literal Alpine will not evaluate.
2. **Parent-method props:** pass handler expressions as string props (e.g. `click="submitVisit()"`) and bind `@click={click}`. Never `;`-separated multi-statements or `$dispatch` solely to chain parent calls.
3. `x-show` **+** `x-cloak`**:** every `x-show` element must also carry `x-cloak`.

Add anti-pattern rows:

| Anti-pattern                         | Reason                      |
| ------------------------------------ | --------------------------- |
| `x-show` without `x-cloak`           | FOUC before Alpine hydrates |
| `;`-separated statements on `@click` | Prefer one factory method   |

- [ ] **Step 3: Mirror in** `10-Frontend-Agent-Guide.md`

Under §2 Alpine bindings, add the three bullets. Bump doc version note / `updated:` to `2026-07-21`. Add checklist item: every `x-show` has `x-cloak`.

- [ ] **Step 4: Harden** `07-Style-Guide.md` **Interactivity**

Replace soft “Cloak unready UI with `x-cloak`” with: **Every element with** `x-show` **must also have** `x-cloak`**.** (`[x-cloak] { display: none !important; }` is already global.) Date `2026-07-21`.

- [ ] **Step 5: Note in** `05-Astro-Components.md`

Brief note that game display components may accept Alpine expression strings as props (`SinglePlayerDisplay` `score`/`target` + `isTarget`), rendered via direct pass per `03-Alpine-Patterns.md`. Date `2026-07-21`.

- [ ] **Step 6: Folder structure**

If `02-Folder-Structure.md` enumerates layout files, add `GameLayout.astro` (play-only; no bottom nav). If it only shows `layouts/` as a directory, leave unchanged.

- [ ] **Step 7: Run context gates + graph refresh**

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/refresh-graph.sh
```

All three checkers must pass. Stage `graphify-out/graph.json` if it changed. If graphify CLI is absent, record the warning in the completion report (do not silently skip).

- [ ] **Step 8: Commit** (only if user asked)

```bash
git add DECISIONS.md docs/architecture/07-Frontend/ graphify-out/graph.json
git commit -m "$(cat <<'EOF'
docs: harden Alpine x-cloak/expression-prop rules; record GameLayout (D121)

EOF
)"
```

---

## Self-Review

**Spec coverage**

| Spec item                                              | Task                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `GameLayout` + exit chrome                             | 3                                                           |
| `ExitModal` + `confirm-exit`                           | 3, 6                                                        |
| `ScoreInput` no `x-data`, `visitInput`, `click`        | 4, 1                                                        |
| `SinglePlayerDisplay` Alpine props, `isTarget={false}` | 5, 6                                                        |
| Keep `submitVisit` / `visitInput`                      | 1, 4, 6                                                     |
| Keypad helpers on factory                              | 1                                                           |
| `abandonAndExit` batch + ABANDONED + reset             | 2                                                           |
| Browser close ≠ abandon                                | documented in Global Constraints + D121; no code path added |
| Play page wire-up + remove Input/form/total            | 6                                                           |
| `x-show` + `x-cloak`                                   | 6, 7                                                        |
| Factory unit tests                                     | 1, 2                                                        |
| Docs / DECISIONS / gates                               | 7                                                           |

**Placeholder scan:** none intentional.

**Type consistency:** `visitInput`, `submitVisit`, `appendDigit`, `deleteLast`, `clearVisitInput`, `abandonLoading`, `abandonAndExit` — same names across tasks. Spec diagram leftovers saying `submitScore()` are ignored; plan uses `submitVisit()` only.

**Note on** `@click={`**'${click}'**`}` **in the spec sheet:** that quoting form is wrong for click handlers (and for `x-text` — see Global Constraints). This plan uses `@click={click}` so Alpine executes `submitVisit()`.
