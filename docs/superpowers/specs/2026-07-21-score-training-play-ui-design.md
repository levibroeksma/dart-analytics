# Score Training Play UI — Design

> **Date:** 2026-07-21
> **Status:** approved (brainstorming consensus)
> **Scope:** `GameLayout`, `ExitModal`, Alpine-wired `ScoreInput` / `SinglePlayerDisplay`, play-page integration, in-game abandon flow.
> **Prerequisite:** `2026-07-17-score-training-flow-redesign.md` (session lifecycle, results modal, D88 reconciliation).
> **Out of scope:** `SinglePlayerDisplay` `progress` slot content, keyboard roving tabindex on exit modal.

---

## Context

Score Training play (`app/src/pages/games/score-training/play/index.astro`) still uses `AppLayout` (with bottom nav), a plain `Input` + submit button, and inline running-total text. New game components exist under `components/layout/games/` but are not wired:

| Component                   | Today                                    | Problem                                      |
| --------------------------- | ---------------------------------------- | -------------------------------------------- |
| `ScoreInput.astro`          | Isolated inline `x-data` + local `score` | Does not connect to `scoreTrainingPlay()`    |
| `SinglePlayerDisplay.astro` | Static Astro props                       | Running total is Alpine runtime state        |
| `AppLayout.astro`           | Always renders `BottomNav`               | Bottom nav must never appear during gameplay |

Brainstorming decisions:

| Topic                               | Choice                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Layout                              | New `GameLayout.astro` — no `BottomNav`, exit chrome + confirm modal                                           |
| Exit modal                          | Extracted `ExitModal.astro` component                                                                          |
| Post-exit destination               | `/games`                                                                                                       |
| `SinglePlayerDisplay` primary value | Running total (`sum of turns`), label `"Score"`                                                                |
| `SinglePlayerDisplay` API           | Alpine expression string via `score` prop → `x-text={score}`; `isTarget={false}` for scoring games             |
| `ScoreInput` integration            | No own `x-data`; lives inside parent factory scope; binds `visitInput`; accepts `click` prop for submit action |
| Abandon on confirm                  | Batch partial turns (if any) + `PATCH ABANDONED` + `store.reset()` — explicit user choice only                 |
| Browser close / refresh             | No API call — `$persist` retains state; D88 resume on return                                                   |

Authority: `07-Frontend/05-Astro-Components.md`, `07-Frontend/07-Style-Guide.md`, `03-Alpine-Patterns.md`, `2026-07-17-score-training-flow-redesign.md`.

---

## Scope

In scope:

- `app/src/layouts/GameLayout.astro` (new)
- `app/src/components/layout/games/ExitModal.astro` (new)
- Refactor `ScoreInput.astro` — remove inline `x-data`; bind `visitInput` from parent scope; accept `click` prop for submit action
- Refactor `SinglePlayerDisplay.astro` — `score` as Alpine expression string prop; `isTarget={false}` for scoring games
- Wire `app/src/pages/games/score-training/play/index.astro` to `GameLayout`, `ScoreInput`, `SinglePlayerDisplay`
- Add `abandonAndExit()` (or `abandonSession()`) to `scoreTrainingPlay()` factory + types
- Unit tests for abandon method in `score-training-play.data.test.ts`
- `DECISIONS.md` one-liner for `GameLayout` / in-game abandon pattern

Out of scope:

- `progress` slot population on `SinglePlayerDisplay`
- Replacing the existing results modal on play (unchanged)
- Setup page layout changes (stays on `AppLayout`)
- Shared abandon helper extraction from setup factory (optional follow-up; duplicate minimal logic is acceptable for now)
- Vitest for `.astro` markup (D101)

---

## Architecture

```mermaid
flowchart TB
  subgraph layout [GameLayout]
    ExitBtn[Exit ghost button]
    ExitModal[ExitModal]
    MainSlot[main slot]
  end

  subgraph play [play/index.astro x-data scoreTrainingPlay]
    Display[SinglePlayerDisplay x-text score expr]
    Input[ScoreInput no own x-data]
    Factory[scoreTrainingPlay factory]
  end

  ExitBtn -->|showExitModal true| ExitModal
  ExitModal -->|confirm-exit event| Factory
  Input -->|"@click=submitScore()"| Factory
  Factory -->|submitVisit| Engine[ScoreTrainingEngine]
  Factory -->|abandonAndExit batch + PATCH ABANDONED| API[appendBatch + completeSession]
  Factory -->|navigate| GamesHub["/games"]
```

Event wiring:

| Interaction  | Mechanism                                                                        | Action                     |
| ------------ | -------------------------------------------------------------------------------- | -------------------------- |
| Exit confirm | `$dispatch('confirm-exit')` → `@confirm-exit.window` on play root                | `abandonAndExit()`         |
| Score submit | `ScoreInput` submit button calls factory method directly (lives in parent scope) | `submitScore()` on factory |

---

## Design

### `ExitModal.astro`

`app/src/components/layout/games/ExitModal.astro`

Presentational dialog fragment. Expects parent scope to provide `showExitModal` (boolean).

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="exit-modal-title"`
- Backdrop click → `showExitModal = false`
- Cancel → `showExitModal = false`
- Leave → `$dispatch('confirm-exit')` (does not close modal itself — factory navigates away on success)
- Copy: title **"Leave game?"**, body **"This session will be recorded as abandoned."**
- Actions: `btn-ghost` Cancel (left in row), `btn-primary` Leave (right); row `justify-end`

### `GameLayout.astro`

`app/src/layouts/GameLayout.astro`

```astro
<BaseLayout title={title}>
  <div class="app-shell" x-data="{ showExitModal: false }">
    <header class="flex items-center p-3">
      <button type="button" class="btn btn-ghost p-2" aria-label="Exit game" @click="showExitModal = true">
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

- No `BottomNav`.
- Uses `@icons/exit.svg`.
- All future game **play** routes use `GameLayout`; hub/setup routes keep `AppLayout`.

### `ScoreInput.astro`

**No inline** `x-data`**.** The component lives inside the parent factory's `x-data` scope. All state (`visitInput`, `appendDigit`, `deleteLast`, `clearVisitInput`) is defined on the `scoreTrainingPlay()` factory.

Props:

```ts
interface Props {
  click?: string; // Alpine expression for submit action, e.g. "submitScore()"
  class?: string;
}
```

Submit button uses the `click` prop:

```astro
<button
  type="button"
  class="btn btn-primary ..."
  :disabled="!visitInput"
  @click={`'${click}'`}
>
  Submit
</button>
```

Display field and keypad bind to `visitInput` (not `score`). Play page usage:

```astro
<ScoreInput click="submitVisit()" />
```

The factory's `submitVisit()` method reads `this.visitInput`, validates, records the visit, and clears `this.visitInput` as a synchronous step within the method. No `;`-separated inline expressions, no `$dispatch`.

- Fix inconsistent `x-on:click` on keypad digits → `@click` per Alpine v3 shorthand rules.
- Fix icon imports to use `@icons/` alias (not relative `../../icons/`).
- Bind display field to `visitInput` (the existing factory field name), not `score`.

**Rule hardened (to be added to** `03-Alpine-Patterns.md` **and** `10-Frontend-Agent-Guide.md`**):** Components that need to call parent-scope methods accept an Alpine expression string as an Astro prop (e.g. `click`). Never use `;`-separated inline statements or `$dispatch` to combine multiple operations on a single `@click`.

**Rule hardened (to be added to** `03-Alpine-Patterns.md`**,** `10-Frontend-Agent-Guide.md`**,** `07-Style-Guide.md`**):** Every element with `x-show` must also have `x-cloak` to prevent flash of unstyled content before Alpine hydration.

### `SinglePlayerDisplay.astro`

Props:

```ts
interface Props {
  score?: string; // Alpine expression — primary value for scoring games, rendered as x-text value
  target?: string; // Alpine expression — primary value for target games
  isTarget?: boolean; // default true → Most games will be 'target games', for this scoring game (shows score, label "Score"); the value is false → target game (shows target, label "Target")
}
```

Markup — uses the **Alpine-expression-as-Astro-prop** pattern (`x-text={prop}` / `x-text={isTarget ? target : score}`):

```astro
<h1
  class="text-7xl font-mono font-bold tabular-nums"
  x-text={isTarget ? target : score}
></h1>
<span class="text-sm text-fg-subtle uppercase">
  {isTarget ? "Target" : "Score"}
</span>
<slot name="progress" />
```

**Rule hardened (to be added to** `03-Alpine-Patterns.md` **and** `10-Frontend-Agent-Guide.md`**):** When passing an Alpine expression string as an Astro prop and rendering it as an `x-text`/`x-bind` attribute value, pass the prop directly: `x-text={prop}` or `x-text={isTarget ? target : score}`. Do **not** wrap with `` `'${prop}'` `` — that emits a quoted string literal Alpine will not evaluate.

Score Training play usage (scoring game — not a target game):

```astro
<SinglePlayerDisplay
  isTarget={false}
  score="$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0)"
/>
```

`target` omitted. `progress` slot left empty.

### Session persistence vs manual abandon

Two distinct behaviors — do not conflate:

| Trigger                                                              | API                                                          | Persisted state                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Browser close, refresh, or navigate away **without** confirming exit | None                                                         | Retained via `$persist` on `$store.game` — player resumes on return (D88 `"match"` → silent resume) |
| Exit button → confirm in `ExitModal`                                 | `appendBatch` (if `turns.length > 0`) then `PATCH ABANDONED` | `store.reset()` removes all persisted session state                                                 |

Closing the browser is **not** an abandon. Only the explicit Leave confirmation closes the session server-side.

Setup-page `abandonSession()` (Continue/Abandon modal, typically zero turns) remains `PATCH ABANDONED` only — no batch. Play-page `abandonAndExit()` uploads partial turns first when present so statistics capture in-progress gameplay.

### `scoreTrainingPlay()` — `submitVisit` + `abandonAndExit`

Keep existing `submitVisit()` — add keypad helpers moved from former inline `ScoreInput` `x-data`:

```ts
async submitVisit(this: ScoreTrainingPlayContext) {
  if (!this.engine || this.finished) return;
  const value = Number(this.visitInput);
  if (!Number.isInteger(value) || value < 0 || value > 180) {
    this.error = "Enter a score between 0 and 180.";
    return;
  }
  this.error = "";
  this.visitInput = "";  // clear input synchronously before async work
  // ... existing engine / completion logic unchanged
}
```

Factory state changes:

- Keep `visitInput: ""` (shared with `ScoreInput` markup via parent scope — do **not** rename to `score`).
- Add `appendDigit(digit: number)`, `deleteLast()`, `clearVisitInput()` methods (moved from former inline `x-data`).

Add `appendDigit`, `deleteLast`, `clearVisitInput` to `ScoreTrainingPlayContext` type. `visitInput` and `submitVisit` already exist — do not rename them.

`**abandonAndExit()**` (new):

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
}
```

- `abandonLoading` guards double-submit (mirror setup factory).
- On failure: stay on play page, show inline error; modal can remain open or user dismisses manually.

Update `ScoreTrainingPlayContext` in `app/src/lib/game/types.ts` accordingly.

### Play page layout

Replace `AppLayout` → `GameLayout`.

Root gameplay container:

```astro
<GameLayout title="Score Training — Play">
  <div
    class="flex flex-col flex-1 min-h-0"
    x-data="scoreTrainingPlay()"
    @confirm-exit.window="abandonAndExit()"
  >
    <!-- reconciliation / no-session / gameplay / results modal — existing x-show branches (each x-show element also has x-cloak) -->
  </div>
</GameLayout>
```

Gameplay branch (`!finished && hasActiveSession`):

```astro
<div class="flex flex-col flex-1 min-h-0">
  <!-- duration meta (unchanged) -->
  <p class="text-sm text-fg-muted px-3" x-show="..." x-text="..." x-cloak></p>

  <SinglePlayerDisplay
    isTarget={false}
    score="$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0)"
  />

  <p class="px-3 mt-2 text-sm text-red-500" x-show="error" x-text="error" x-cloak></p>

  <ScoreInput click="submitVisit()" />
</div>
```

Remove: `Input`, submit `Button`, inline total `<p>`, `<form>` wrapper.

Results modal, reconciliation, and no-session views unchanged.

---

## Error handling

| Case                                   | Behavior                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Invalid score (not 0–180 integer)      | Inline `error` on play page; `visitInput` not cleared so user can fix                                                          |
| Browser close / refresh mid-game       | No API call; `$persist` retains state; resume on return via D88 `"match"`                                                      |
| Abandon PATCH fails                    | Inline `error`; remain on play; `abandonLoading` cleared                                                                       |
| Abandon with no `sessionId`            | `store.reset()` + navigate `/games` (edge case / stale local)                                                                  |
| Exit during results modal (`finished`) | Exit still available; abandon PATCH if session still ACTIVE server-side — acceptable; results modal does not block header exit |

---

## Testing

TDD per `app/CLAUDE.md` — factory tests only:

| Test                                                                               | File                               |
| ---------------------------------------------------------------------------------- | ---------------------------------- |
| `submitVisit` reads `this.visitInput`, validates 0–180, clears `visitInput`        | `score-training-play.data.test.ts` |
| `abandonAndExit` with turns: `appendBatch` then `completeSession(id, 'ABANDONED')` | same                               |
| `abandonAndExit` with zero turns: skips batch, PATCHes `ABANDONED`                 | same                               |
| `abandonAndExit` ignores second call while loading                                 | same                               |
| `abandonAndExit` sets error on PATCH failure, does not navigate                    | same                               |

No new `.astro` tests (D101).

---

## Docs / context maintenance

| File                                 | Change                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `DECISIONS.md`                       | Game play routes use `GameLayout` (no bottom nav); in-game exit → confirm → batch (if turns) + `ABANDONED` + `store.reset()` |
| `07-Frontend/02-Folder-Structure.md` | Register `layouts/GameLayout.astro` if layouts are inventoried                                                               |
| `03-Alpine-Patterns.md`              | Add rules: Alpine-expression-as-Astro-prop pattern; `x-show` must pair with `x-cloak`; no `;`-separated inline expressions   |
| `10-Frontend-Agent-Guide.md`         | Mirror both new Alpine rules                                                                                                 |
| `07-Style-Guide.md`                  | Harden `x-show` + `x-cloak` pairing in Interactivity section                                                                 |
| `05-Astro-Components.md`             | Note `SinglePlayerDisplay` Alpine-expression prop pattern; `isTarget` semantics                                              |

Run `scripts/check-context-map.sh`, `scripts/check-file-locations.sh`, `scripts/check-agent-mirrors.sh`, and `scripts/refresh-graph.sh` at implementation completion.

---

## Open questions

None — brainstorming choices approved 2026-07-21.
