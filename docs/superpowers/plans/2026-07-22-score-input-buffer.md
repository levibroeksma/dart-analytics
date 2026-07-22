# ScoreInput Buffer + Activation Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a reusable `ScoreInputBuffer` module (digit buffer + multi-click guard), prop-wire `ScoreInput.astro`, and migrate Score Training play onto it so intentional same-digit doubles work and ghost third activations do not.

**Architecture:** Alpine-free `ScoreInputBuffer` class under `modules/game/` owns `value`, append/delete/clear/setValue, and the activation guard. Each play factory constructs `new ScoreInputBuffer({ maxLength: 3 })`. `ScoreInput.astro` stays presentational game chrome with explicit Alpine expression props. Score range (0–180) remains in `submitVisit`.

**Tech Stack:** TypeScript, Vitest (fake timers), Astro, Alpine.js v3, existing `InputButton` / `Button` / `cn()`

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-22-score-input-buffer-design.md`
- TDD mandatory for `app/` behavior (`app/CLAUDE.md`): red → green → refactor; full suite must stay green (D104)
- Classes only under `src/modules/`; no Alpine / `@client/api` / stores inside modules (`04-Modules-And-OOP.md`)
- No `export type` / `export interface` inline in `.module.ts` — put them in `modules/game/types.ts` (D115 / OOP anti-patterns)
- No Vitest for `.astro` markup (D101)
- Alpine v3 shorthand (`:attr`, `@event`); `x-on:*` only inside Astro `{}` when linter rejects `@` (D100)
- Astro frontmatter order: `interface Props` → `// Props` → `// Components` · `// Icons` · `// Lib` → `// Data` → `// Styles` (`05-Astro-Components.md`)
- Guard: ignore `event.detail > 2` (not `> 1`) **and** coalesce activations within `SCORE_INPUT_GHOST_MS` (40); silent rejects
- Module enforces `maxLength` only — never 0–180
- No Clear keypad button; `clear()` is programmatic only
- No portable UI kit move; no standalone `ActivationGuard` util
- No git worktrees — branch in the main working copy
- Commit when a plan step says commit (this plan authorizes those commits)
- Context Maintenance before claiming done: `DECISIONS.md`, checkers, graph refresh (`CLAUDE.md`)

## File Structure

**Create:**

| File | Responsibility |
| ---- | -------------- |
| `app/src/modules/game/score-input.module.ts` | `ScoreInputBuffer` class + `SCORE_INPUT_GHOST_MS` export |
| `app/tests/modules/game/score-input.module.test.ts` | Buffer + guard unit tests |

**Modify:**

| File | Responsibility |
| ---- | -------------- |
| `app/src/modules/game/types.ts` | `ScoreInputBufferOptions`, `ScoreInputActivationEvent` |
| `app/src/lib/game/types.ts` | Replace `visitInput` / keypad methods with `scoreInput: ScoreInputBuffer` |
| `app/src/lib/game/score-training-play.data.ts` | Compose module; drop local keypad helpers |
| `app/src/components/layout/games/ScoreInput.astro` | Explicit props; pass `$event` into digit/delete |
| `app/src/components/layout/games/interfaces/ScoreTraining.astro` | Wire new props |
| `app/tests/lib/game/score-training-play.data.test.ts` | Retarget keypad / visitInput usages to `scoreInput` |
| `DECISIONS.md` | D124 one-liner |
| `docs/superpowers/specs/2026-07-22-score-input-buffer-design.md` | Fix stray trailing `)` if still present |

**Do not touch:**

| File | Why |
| ---- | --- |
| Portable `components/ui/` | Out of scope |
| Engine / payload / session API | Unchanged |
| Range validation copy / thresholds | Stay in `submitVisit` |

---

### Task 1: `ScoreInputBuffer` module (TDD)

**Files:**
- Create: `app/src/modules/game/score-input.module.ts`
- Create: `app/tests/modules/game/score-input.module.test.ts`
- Modify: `app/src/modules/game/types.ts`

**Interfaces:**
- Consumes: nothing outside `modules/game/types.ts`
- Produces:
  - `SCORE_INPUT_GHOST_MS = 40` (exported const)
  - `ScoreInputBufferOptions = { maxLength?: number }`
  - `ScoreInputActivationEvent = { detail?: number }`
  - `class ScoreInputBuffer` with:
    - `value: string`
    - `constructor(options?: ScoreInputBufferOptions)`
    - `appendDigit(digit: number, event?: ScoreInputActivationEvent): void`
    - `deleteLast(event?: ScoreInputActivationEvent): void`
    - `clear(): void`
    - `setValue(next: string): void`
    - `asNumber(): number | null`

- [ ] **Step 1: Add types to `modules/game/types.ts`**

Append:

```typescript
export type ScoreInputBufferOptions = {
  maxLength?: number;
};

/** Minimal click-like shape for activation guard (`detail` from MouseEvent). */
export type ScoreInputActivationEvent = {
  detail?: number;
};
```

- [ ] **Step 2: Write the failing tests**

Create `app/tests/modules/game/score-input.module.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ScoreInputBuffer,
  SCORE_INPUT_GHOST_MS,
} from "@modules/game/score-input.module";

/** Press a digit and advance past the ghost window so the next press is eligible. */
function press(
  buf: ScoreInputBuffer,
  digit: number,
  detail = 1,
): void {
  buf.appendDigit(digit, { detail });
  vi.advanceTimersByTime(SCORE_INPUT_GHOST_MS + 1);
}

describe("ScoreInputBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("digit buffer", () => {
    it("appends digits and rejects length > maxLength (default 3)", () => {
      const buf = new ScoreInputBuffer();
      press(buf, 1);
      press(buf, 8);
      press(buf, 0);
      expect(buf.value).toBe("180");
      press(buf, 0);
      expect(buf.value).toBe("180");
    });

    it('replaces a lone "0" instead of prefixing', () => {
      const buf = new ScoreInputBuffer();
      press(buf, 0);
      expect(buf.value).toBe("0");
      press(buf, 5);
      expect(buf.value).toBe("5");
    });

    it("deleteLast removes the last character", () => {
      const buf = new ScoreInputBuffer();
      press(buf, 4);
      press(buf, 5);
      buf.deleteLast({ detail: 1 });
      expect(buf.value).toBe("4");
    });

    it("clear empties without requiring an event", () => {
      const buf = new ScoreInputBuffer();
      press(buf, 1);
      press(buf, 2);
      buf.clear();
      expect(buf.value).toBe("");
    });

    it("setValue replaces the buffer and asNumber maps empty to null", () => {
      const buf = new ScoreInputBuffer();
      expect(buf.asNumber()).toBeNull();
      buf.setValue("55");
      expect(buf.value).toBe("55");
      expect(buf.asNumber()).toBe(55);
      buf.clear();
      expect(buf.asNumber()).toBeNull();
    });

    it("respects custom maxLength", () => {
      const buf = new ScoreInputBuffer({ maxLength: 2 });
      press(buf, 9);
      press(buf, 9);
      press(buf, 9);
      expect(buf.value).toBe("99");
    });
  });

  describe("activation guard", () => {
    it("accepts intentional same-digit double when spaced beyond GHOST_MS (detail 1 then 2)", () => {
      const buf = new ScoreInputBuffer();
      buf.appendDigit(2, { detail: 1 });
      vi.advanceTimersByTime(SCORE_INPUT_GHOST_MS + 1);
      buf.appendDigit(2, { detail: 2 });
      expect(buf.value).toBe("22");
    });

    it("rejects a second activation inside the ghost window", () => {
      const buf = new ScoreInputBuffer();
      buf.appendDigit(5, { detail: 1 });
      buf.appendDigit(5, { detail: 1 });
      expect(buf.value).toBe("5");
    });

    it("rejects event.detail > 2 even after the ghost window", () => {
      const buf = new ScoreInputBuffer();
      buf.appendDigit(3, { detail: 1 });
      vi.advanceTimersByTime(SCORE_INPUT_GHOST_MS + 1);
      buf.appendDigit(3, { detail: 3 });
      expect(buf.value).toBe("3");
    });

    it("does not treat detail === 2 as a reject", () => {
      const buf = new ScoreInputBuffer();
      buf.appendDigit(1, { detail: 1 });
      vi.advanceTimersByTime(SCORE_INPUT_GHOST_MS + 1);
      buf.appendDigit(8, { detail: 2 });
      expect(buf.value).toBe("18");
    });

    it("clear/setValue reset the ghost clock so the next press is accepted immediately", () => {
      const buf = new ScoreInputBuffer();
      buf.appendDigit(9, { detail: 1 });
      buf.clear();
      buf.appendDigit(1, { detail: 1 });
      expect(buf.value).toBe("1");
    });
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL (module missing)**

Run:

```bash
cd app && npx vitest run tests/modules/game/score-input.module.test.ts
```

Expected: FAIL — cannot resolve `@modules/game/score-input.module` / `ScoreInputBuffer` not found.

- [ ] **Step 4: Implement `ScoreInputBuffer`**

Create `app/src/modules/game/score-input.module.ts`:

```typescript
import type {
  ScoreInputActivationEvent,
  ScoreInputBufferOptions,
} from "./types";

/** Coalesce window for ghost/multi-click activations (ms). Tunable with test + manual evidence only. */
export const SCORE_INPUT_GHOST_MS = 40;

export class ScoreInputBuffer {
  value = "";
  private readonly maxLength: number;
  /** Negative infinity so the first press is never ghost-rejected when clocks start at 0 (Vitest fake timers). */
  private lastAcceptedAt = Number.NEGATIVE_INFINITY;

  constructor(options: ScoreInputBufferOptions = {}) {
    this.maxLength = options.maxLength ?? 3;
  }

  appendDigit(digit: number, event?: ScoreInputActivationEvent): void {
    if (!this.acceptActivation(event)) return;
    const next = this.value === "0" ? String(digit) : this.value + String(digit);
    if (next.length > this.maxLength) return;
    this.value = next;
  }

  deleteLast(event?: ScoreInputActivationEvent): void {
    if (!this.acceptActivation(event)) return;
    this.value = this.value.slice(0, -1);
  }

  clear(): void {
    this.value = "";
    this.lastAcceptedAt = Number.NEGATIVE_INFINITY;
  }

  setValue(next: string): void {
    this.value = next;
    this.lastAcceptedAt = Number.NEGATIVE_INFINITY;
  }

  asNumber(): number | null {
    return this.value === "" ? null : Number(this.value);
  }

  private acceptActivation(event?: ScoreInputActivationEvent): boolean {
    if (event?.detail != null && event.detail > 2) return false;
    const now = Date.now();
    if (now - this.lastAcceptedAt < SCORE_INPUT_GHOST_MS) return false;
    this.lastAcceptedAt = now;
    return true;
  }
}
```

Note: max-length reject happens **after** `acceptActivation` stamps `lastAcceptedAt`. If a full-buffer press should not burn the ghost window, move the stamp to only when `this.value` mutates — only if manual UX shows a problem. Default is stamp-on-accept as above.

- [ ] **Step 5: Run tests — expect PASS**

Run:

```bash
cd app && npx vitest run tests/modules/game/score-input.module.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game/types.ts \
  app/src/modules/game/score-input.module.ts \
  app/tests/modules/game/score-input.module.test.ts
git commit -m "$(cat <<'EOF'
feat(game): add ScoreInputBuffer with multi-click guard

Reusable digit buffer for game keypads; reject detail>2 and
sub-GHOST_MS duplicate activations without blocking intentional doubles.
EOF
)"
```

---

### Task 2: Migrate Score Training + prop-wire `ScoreInput`

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Modify: `app/src/components/layout/games/ScoreInput.astro`
- Modify: `app/src/components/layout/games/interfaces/ScoreTraining.astro`
- Modify: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: `ScoreInputBuffer` from `@modules/game/score-input.module`
- Produces: play context field `scoreInput: ScoreInputBuffer`; Astro props below

**`ScoreInput.astro` props (final):**

| Prop | Required | Example |
| ---- | -------- | ------- |
| `value` | yes | `scoreInput.value` |
| `digitHandler` | yes | `scoreInput.appendDigit` |
| `onDelete` | yes | `scoreInput.deleteLast($event)` |
| `onSubmit` | yes | `submitVisit()` |
| `submitDisabled` | no | `!scoreInput.value \|\| showFinishConfirm \|\| finished` |
| `padDisabled` | no | `showFinishConfirm \|\| finished` |
| `undoClick` | no | `undoVisit()` |
| `undoDisabled` | no | `!$store.game.turns.length \|\| showFinishConfirm \|\| finished` |
| `class` | no | — |

When `undoClick` is omitted: render a disabled empty `InputButton` (no handler) so the bottom row keeps three cells.

- [ ] **Step 1: Update play context types**

In `app/src/lib/game/types.ts`:

- Import `ScoreInputBuffer` from `@modules/game/score-input.module`
- Replace `visitInput: string` with `scoreInput: ScoreInputBuffer`
- Remove `appendDigit`, `deleteLast`, `clearVisitInput` method entries

- [ ] **Step 2: Update failing play-factory keypad tests first (TDD on migration)**

In `app/tests/lib/game/score-training-play.data.test.ts`:

1. Replace every `visitInput: '…'` object override with a post-create `component.scoreInput.setValue('…')`.
2. Replace every `component.visitInput = '…'` / `expect(component.visitInput)` with `scoreInput.setValue` / `scoreInput.value`.
3. Replace the `keypad helpers + visitInput validation` describe block with:

```typescript
describe("keypad helpers + visitInput validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("scoreInput appends digits and rejects length > 3", () => {
    const component = { ...scoreTrainingPlay(), $store: { game: gameStub() } };
    component.scoreInput.appendDigit(1);
    vi.advanceTimersByTime(41);
    component.scoreInput.appendDigit(8);
    vi.advanceTimersByTime(41);
    component.scoreInput.appendDigit(0);
    expect(component.scoreInput.value).toBe("180");
    component.scoreInput.appendDigit(0);
    expect(component.scoreInput.value).toBe("180");
  });

  it('scoreInput replaces a lone "0" instead of prefixing', () => {
    const component = { ...scoreTrainingPlay(), $store: { game: gameStub() } };
    component.scoreInput.appendDigit(0);
    expect(component.scoreInput.value).toBe("0");
    vi.advanceTimersByTime(41);
    component.scoreInput.appendDigit(5);
    expect(component.scoreInput.value).toBe("5");
  });

  it("scoreInput deleteLast / clear work for play composition", () => {
    const component = { ...scoreTrainingPlay(), $store: { game: gameStub() } };
    component.scoreInput.setValue("45");
    component.scoreInput.deleteLast({ detail: 1 });
    expect(component.scoreInput.value).toBe("4");
    component.scoreInput.clear();
    expect(component.scoreInput.value).toBe("");
  });

  it("submitVisit rejects non-integer / out-of-range and does not clear scoreInput", async () => {
    vi.useRealTimers();
    const store = gameStub();
    const component = { ...scoreTrainingPlay(), $store: { game: store } };
    component.scoreInput.setValue("999");
    await component.init.call(component);
    await component.submitVisit.call(component);
    expect(component.error).toBe("Enter a score between 0 and 180.");
    expect(component.scoreInput.value).toBe("999");
    expect(store.recordTurn).not.toHaveBeenCalled();
  });
});
```

Do **not** wrap the whole play suite in fake timers (async init/submit tests use real time / mocked APIs). The submitVisit test above forces real timers.

Update `undoVisit` / `cancelFinish` / other describes that read `visitInput` the same way (`scoreInput.value` / `setValue` / `clear` expectations). Grep the test file for `visitInput` and clear every hit.

- [ ] **Step 3: Run play tests — expect FAIL**

Run:

```bash
cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts
```

Expected: FAIL — `scoreInput` undefined / `visitInput` still present / methods missing.

- [ ] **Step 4: Migrate `scoreTrainingPlay`**

In `app/src/lib/game/score-training-play.data.ts`:

```typescript
import { ScoreInputBuffer } from "@modules/game/score-input.module";
```

Replace keypad block with:

```typescript
scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
```

Delete `visitInput`, `appendDigit`, `deleteLast`, `clearVisitInput`.

Replace usages:

| Old | New |
| --- | --- |
| `Number(this.visitInput)` | `Number(this.scoreInput.value)` |
| `this.visitInput = ""` | `this.scoreInput.clear()` |
| `this.visitInput = String(this.pendingFinishScore)` | `this.scoreInput.setValue(String(this.pendingFinishScore))` |

Keep `submitVisit` validation:

```typescript
const score = Number(this.scoreInput.value);
if (!Number.isInteger(score) || score < 0 || score > 180) {
  this.error = "Enter a score between 0 and 180.";
  return;
}
```

- [ ] **Step 5: Rewrite `ScoreInput.astro`**

```astro
---
/**
 * Reusable visit-score keypad shell. Parent supplies Alpine expressions and owns
 * ScoreInputBuffer (or equivalent) + submit/undo game rules.
 */
interface Props {
  value: string;
  digitHandler: string;
  onDelete: string;
  onSubmit: string;
  submitDisabled?: string;
  padDisabled?: string;
  undoClick?: string;
  undoDisabled?: string;
  class?: string;
}

// Props
const {
  value,
  digitHandler,
  onDelete,
  onSubmit,
  submitDisabled = `!${value}`,
  padDisabled,
  undoClick,
  undoDisabled = "true",
  class: classNameProp,
}: Props = Astro.props;

// Components
import InputButton from "./InputButton.astro";
import Button from "@components/forms/Button.astro";

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
const rootClass = cn("flex flex-1 flex-col gap-3", classNameProp);
---

<div class={rootClass}>
  <div class="flex items-center gap-3">
    <div
      class="border border-border bg-surface-overlay flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 w-1/2"
    >
      <span
        class="text-4xl font-mono font-bold tabular-nums py-1.5"
        :class={`!${value} && 'text-foreground-muted'`}
        x-text={`${value} || '0'`}
      ></span>
    </div>
    <Button
      type="button"
      variant="primary"
      title="Submit"
      class="w-1/2 h-full"
      {...{ ":disabled": submitDisabled, "x-on:click": onSubmit }}
    />
  </div>

  <div
    class="rounded-lg border border-border bg-surface-raised grid h-full w-full divide-y divide-border"
  >
    {
      numberRows.map((row) => (
        <div class="flex w-full divide-x divide-border">
          {row.map((digit) => (
            <InputButton
              {...{
                "x-on:click": `${digitHandler}(${digit}, $event)`,
                ...(padDisabled ? { ":disabled": padDisabled } : {}),
              }}
            >
              {digit}
            </InputButton>
          ))}
        </div>
      ))
    }
    <div class="flex w-full divide-x divide-border">
      {
        undoClick ? (
          <InputButton
            aria-label="Undo last visit"
            {...{
              "x-on:click": undoClick,
              ":disabled": undoDisabled,
            }}
          >
            <UndoIcon class="size-6 text-fg-subtle" />
          </InputButton>
        ) : (
          <InputButton disabled aria-hidden="true" />
        )
      }
      <InputButton
        {...{
          "x-on:click": `${digitHandler}(0, $event)`,
          ...(padDisabled ? { ":disabled": padDisabled } : {}),
        }}
      >
        0
      </InputButton>
      <InputButton
        aria-label="Delete last digit"
        {...{
          "x-on:click": onDelete,
          ...(padDisabled ? { ":disabled": padDisabled } : {}),
        }}
      >
        <DeleteIcon class="size-6 text-fg-subtle" />
      </InputButton>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Wire `ScoreTraining.astro`**

Replace `<ScoreInput click="submitVisit()" />` with:

```astro
  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showFinishConfirm || finished"
    padDisabled="showFinishConfirm || finished"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showFinishConfirm || finished"
  />
```

- [ ] **Step 7: Run play + module tests — expect PASS**

```bash
cd app && npx vitest run tests/modules/game/score-input.module.test.ts tests/lib/game/score-training-play.data.test.ts
```

Expected: all PASS.

- [ ] **Step 8: Manual smoke (implementer)**

On Score Training play:

1. Enter `22` / `55` quickly — display shows two digits, submit succeeds when in range
2. Confirm no persistent `222` from a single double-press attempt
3. Delete back to `0`; undo still pops last visit and clears typed digits
4. Finish-cancel restores the pending score into the display

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/score-training-play.data.ts \
  app/src/components/layout/games/ScoreInput.astro \
  app/src/components/layout/games/interfaces/ScoreTraining.astro \
  app/tests/lib/game/score-training-play.data.test.ts
git commit -m "$(cat <<'EOF'
refactor(play): wire Score Training through ScoreInputBuffer

Prop-wire ScoreInput and drop factory-local digit helpers so keypad
activation guarding and buffer state are reusable across game types.
EOF
)"
```

---

### Task 3: Decisions + Context Maintenance

**Files:**
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/specs/2026-07-22-score-input-buffer-design.md` (trailing `)` cleanup only, if needed)
- Possibly: `graphify-out/graph.json` via refresh script

**Interfaces:**
- Consumes: implemented Task 1–2 behavior
- Produces: D124 ledger entry; green context checkers

- [ ] **Step 1: Add D124 to `DECISIONS.md` (Frontend table)**

```markdown
| D124 | 2026-07-22 | Visit-score entry uses reusable `ScoreInputBuffer` (`modules/game`) with activation guard (`detail > 2` reject + `SCORE_INPUT_GHOST_MS` coalesce); `ScoreInput.astro` is a prop-wired shell; games own range validation and optional undo. | Root-fix ghost multi-clicks; share keypad buffer across game types |
```

- [ ] **Step 2: Run context + app validation**

```bash
# from repo root
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/refresh-graph.sh

cd app && npm run validate:app
```

Expected: all checkers pass; `validate:app` green. If graphify CLI missing, record warning in the completion report and do not fake `graph.json`.

No new canonical architecture doc is required (spec/plan stay under historical `docs/superpowers/`). No `CLAUDE.md` change unless implementation surfaces a new standing rule — default is DECISIONS-only.

- [ ] **Step 3: Commit**

```bash
git add DECISIONS.md graphify-out/graph.json \
  docs/superpowers/specs/2026-07-22-score-input-buffer-design.md
git commit -m "$(cat <<'EOF'
docs: record D124 ScoreInputBuffer activation guard

Ledger the reusable buffer + multi-click contract and refresh the
knowledge graph after the Score Training migration.
EOF
)"
```

---

## Self-review (author)

| Spec requirement | Task |
| ---------------- | ---- |
| `ScoreInputBuffer` module + ghost + `detail > 2` | Task 1 |
| maxLength only; no 0–180 in module | Task 1 |
| `clear` / `setValue` programmatic | Task 1 |
| Prop-wired `ScoreInput` + optional undo | Task 2 |
| Score Training migration + tests | Task 2 |
| Silent guard / max-length rejects | Task 1–2 |
| D124 + context gates | Task 3 |
| No portable UI / no ActivationGuard util | Honored (not in file list) |

No placeholders left. Types/names consistent: `scoreInput`, `SCORE_INPUT_GHOST_MS`, `digitHandler`, `padDisabled`.
