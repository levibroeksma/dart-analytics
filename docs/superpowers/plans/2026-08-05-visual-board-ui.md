# Visual Board UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player record darts by pressing the dartboard where each one landed, with a magnifier that makes a 10 mm treble ring hittable on a phone, wired into the 501 and Score Training play pages.

**Architecture:** A presentational `DartBoard.astro` inlines the existing SVG and owns no logic. A portable `board-input.module.ts` converts pointer events into board millimetres via the SVG's inverse screen CTM, holds magnifier state, and commits on release. The play pages' Alpine factories feed the resulting `DartObservation` straight to the engine from plan 1. The keypad stays reachable as the accessible alternative.

**Tech Stack:** Astro, Alpine.js, TypeScript, Vitest, Tailwind v4.

## Prerequisites

Both must be merged first:

- **Plan 1** (`2026-08-05-visual-board-capture-core.md`) — `classify`, the widened `DartObservation`, and both engines' visual paths.
- **Plan 2** (`2026-08-05-visual-board-capability-and-settings.md`) — the settings store the play pages read to know which input mode a session runs in.

## Global Constraints

- Board coordinates are regulation millimetres, origin bull centre, y increasing downward — the same space `classify` consumes.
- Commit on pointer **release**, never on press. A press that never moves still commits at its own position.
- The magnifier flips to the opposite side of the touch point when it would overflow the viewport, and respects a handedness preference so it never sits under the throwing thumb.
- A dart with no observed landing point stores `hitZoneKey: "MISS"`, `hitTargetNumber: null`, `locationX: null`, `locationY: null`.
- The keypad input remains available in visual sessions as the accessible alternative — pointer-only input excludes keyboard and switch users.
- No `.ts` files under `components/` or `pages/` (except `pages/api/**`) — enforced by `scripts/check-file-locations.sh`.
- Modules never import `@client/api`.
- Alpine v3 shorthand only (`:attr`, `@event`); no `x-init`; `x-data="factory()"`; every `x-show` paired with `x-cloak`.
- Semantic tokens only; `cn()` for class composition; never `font-medium`; Tailwind v4 suffix important (`utility!`), arbitrary negatives as `prop-[-…]`.
- No `//` or `/* */` comments inside function bodies in `app/src/**/*.ts`.
- Run `cd app && npm run format` before any commit touching `app/`.

---

### Task 1: Screen-to-board coordinate transform

**Files:**
- Create: `app/src/modules/game/board-input.module.ts`
- Create: `app/tests/modules/game/board-input.module.test.ts`

**Interfaces:**
- Consumes: `classify` from `@lib/game/board/board-geometry.module` (plan 1).
- Produces:
  - `type BoardPointer = { clientX: number; clientY: number }`
  - `type ScreenToBoard = (pointer: BoardPointer) => { x: number; y: number } | null`
  - `screenToBoard(svg: SVGSVGElement): ScreenToBoard`

The transform is the piece most likely to be silently wrong, so it is built and tested before any interaction is layered on it.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/game/board-input.module.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { screenToBoard } from "@modules/game/board-input.module";

/**
 * A stand-in for an SVG whose viewBox maps 1 board millimetre to 2 screen
 * pixels, with the board centre at screen (400, 400).
 */
function fakeSvg(): SVGSVGElement {
  const matrix = {
    inverse: () => matrix,
    a: 0.5,
    b: 0,
    c: 0,
    d: 0.5,
    e: -200,
    f: -200,
  };

  const point = { x: 0, y: 0, matrixTransform: (m: typeof matrix) => ({
    x: point.x * m.a + point.y * m.c + m.e,
    y: point.x * m.b + point.y * m.d + m.f,
  }) };

  return {
    createSVGPoint: () => point,
    getScreenCTM: () => matrix,
  } as unknown as SVGSVGElement;
}

describe("screenToBoard", () => {
  it("maps the screen centre to the board origin", () => {
    const toBoard = screenToBoard(fakeSvg());
    expect(toBoard({ clientX: 400, clientY: 400 })).toEqual({ x: 0, y: 0 });
  });

  it("maps a point right of centre to positive x", () => {
    const toBoard = screenToBoard(fakeSvg());
    expect(toBoard({ clientX: 600, clientY: 400 })).toEqual({ x: 100, y: 0 });
  });

  it("maps a point above centre to negative y", () => {
    const toBoard = screenToBoard(fakeSvg());
    expect(toBoard({ clientX: 400, clientY: 200 })).toEqual({ x: 0, y: -100 });
  });

  it("returns null when the element has no screen CTM", () => {
    const detached = {
      createSVGPoint: () => ({ x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) }),
      getScreenCTM: () => null,
    } as unknown as SVGSVGElement;

    expect(screenToBoard(detached)({ clientX: 0, clientY: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/board-input.module.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Confirm the DOM environment**

Run: `cd app && grep -n "environment" vitest.config.ts`
Expected: `jsdom` or `happy-dom`. If neither, this test needs no DOM at all — the fake above supplies everything — but later tasks touching real elements will. Note which you found.

- [ ] **Step 4: Write the module**

Create `app/src/modules/game/board-input.module.ts`:

```typescript
/** A pointer position in client (viewport) pixels. */
export type BoardPointer = {
  clientX: number;
  clientY: number;
};

/** A point on the board in millimetres, or null when the transform is unavailable. */
export type BoardCoordinate = {
  x: number;
  y: number;
};

export type ScreenToBoard = (pointer: BoardPointer) => BoardCoordinate | null;

/**
 * Builds a converter from viewport pixels to board millimetres for one SVG
 * element. The SVG's viewBox is authored in millimetres, so its inverse screen
 * CTM is the whole transform — no scale factor is tracked by hand, and the
 * conversion stays correct when the board is resized, scrolled or zoomed.
 *
 * Returns null for a pointer when the element is detached and has no screen
 * CTM, which happens if a page teardown races a pointer event.
 */
export function screenToBoard(svg: SVGSVGElement): ScreenToBoard {
  return (pointer) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;

    const point = svg.createSVGPoint();
    point.x = pointer.clientX;
    point.y = pointer.clientY;

    const board = point.matrixTransform(matrix.inverse());
    return { x: board.x, y: board.y };
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/board-input.module.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/modules/game/board-input.module.ts app/tests/modules/game/board-input.module.test.ts
git commit -m "Convert pointer positions to board millimetres"
```

---

### Task 2: Magnifier placement

**Files:**
- Modify: `app/src/modules/game/board-input.module.ts`
- Modify: `app/tests/modules/game/board-input.module.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `type Handedness = "LEFT" | "RIGHT"`
  - `type MagnifierPlacement = { offsetX: number; offsetY: number }`
  - `magnifierPlacement(pointer: BoardPointer, viewport: { width: number; height: number }, handedness: Handedness, size: number): MagnifierPlacement`

Pure arithmetic, so it is tested without a DOM.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/modules/game/board-input.module.test.ts`:

```typescript
import { magnifierPlacement } from "@modules/game/board-input.module";

describe("magnifierPlacement", () => {
  const viewport = { width: 400, height: 800 };
  const size = 120;

  it("sits left of the pointer for a right-handed player", () => {
    const placement = magnifierPlacement(
      { clientX: 200, clientY: 400 },
      viewport,
      "RIGHT",
      size,
    );
    expect(placement.offsetX).toBeLessThan(0);
  });

  it("sits right of the pointer for a left-handed player", () => {
    const placement = magnifierPlacement(
      { clientX: 200, clientY: 400 },
      viewport,
      "LEFT",
      size,
    );
    expect(placement.offsetX).toBeGreaterThan(0);
  });

  it("flips inward when it would overflow the left edge", () => {
    const placement = magnifierPlacement(
      { clientX: 10, clientY: 400 },
      viewport,
      "RIGHT",
      size,
    );
    expect(placement.offsetX).toBeGreaterThan(0);
  });

  it("flips inward when it would overflow the right edge", () => {
    const placement = magnifierPlacement(
      { clientX: 390, clientY: 400 },
      viewport,
      "LEFT",
      size,
    );
    expect(placement.offsetX).toBeLessThan(0);
  });

  it("sits above the pointer so the finger never covers it", () => {
    const placement = magnifierPlacement(
      { clientX: 200, clientY: 400 },
      viewport,
      "RIGHT",
      size,
    );
    expect(placement.offsetY).toBeLessThan(0);
  });

  it("drops below the pointer near the top edge", () => {
    const placement = magnifierPlacement(
      { clientX: 200, clientY: 10 },
      viewport,
      "RIGHT",
      size,
    );
    expect(placement.offsetY).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/board-input.module.test.ts`
Expected: FAIL — `magnifierPlacement` is not exported.

- [ ] **Step 3: Write the placement function**

Append to `app/src/modules/game/board-input.module.ts`:

```typescript
/** Which hand throws, so the magnifier is never placed under the throwing thumb. */
export type Handedness = "LEFT" | "RIGHT";

/** Where to draw the magnifier, relative to the pointer, in viewport pixels. */
export type MagnifierPlacement = {
  offsetX: number;
  offsetY: number;
};

const MAGNIFIER_GAP = 16;

/**
 * Places the magnifier away from the throwing hand and clear of the viewport
 * edges. It sits above the pointer by default, because a fingertip covers what
 * is directly beneath it, and drops below only when there is no room above.
 */
export function magnifierPlacement(
  pointer: BoardPointer,
  viewport: { width: number; height: number },
  handedness: Handedness,
  size: number,
): MagnifierPlacement {
  const reach = size / 2 + MAGNIFIER_GAP;
  const preferLeft = handedness === "RIGHT";

  let offsetX = preferLeft ? -reach : reach;
  if (pointer.clientX + offsetX - size / 2 < 0) {
    offsetX = reach;
  } else if (pointer.clientX + offsetX + size / 2 > viewport.width) {
    offsetX = -reach;
  }

  let offsetY = -reach;
  if (pointer.clientY + offsetY - size / 2 < 0) {
    offsetY = reach;
  }

  return { offsetX, offsetY };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/board-input.module.test.ts`
Expected: PASS, 10 tests total.

- [ ] **Step 5: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/modules/game/board-input.module.ts app/tests/modules/game/board-input.module.test.ts
git commit -m "Place the magnifier clear of the throwing hand and viewport edges"
```

---

### Task 3: Board input state machine

**Files:**
- Modify: `app/src/modules/game/board-input.module.ts`
- Modify: `app/tests/modules/game/board-input.module.test.ts`

**Interfaces:**
- Consumes: `screenToBoard`, `magnifierPlacement`, `classify`.
- Produces: `boardInput(options: BoardInputOptions): BoardInputController` where

```typescript
type BoardInputOptions = {
  toBoard: ScreenToBoard;
  onCommit: (observation: DartObservation) => void;
  handedness?: Handedness;
  viewport?: { width: number; height: number };
  magnifierSize?: number;
};

type BoardInputController = {
  readonly active: boolean;
  readonly preview: BoardHit | null;
  readonly point: BoardCoordinate | null;
  readonly placement: MagnifierPlacement | null;
  press(pointer: BoardPointer): void;
  move(pointer: BoardPointer): void;
  release(): void;
  cancel(): void;
  commitUnseen(): void;
};
```

The press/move/release cycle is the interaction's core and belongs in a pure module, testable without a browser.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/modules/game/board-input.module.test.ts`:

```typescript
import { boardInput } from "@modules/game/board-input.module";
import type { DartObservation } from "@modules/game/types";

function controller(onCommit: (observation: DartObservation) => void) {
  return boardInput({
    toBoard: (pointer) => ({ x: pointer.clientX, y: pointer.clientY }),
    onCommit,
    handedness: "RIGHT",
    viewport: { width: 400, height: 800 },
    magnifierSize: 120,
  });
}

describe("boardInput", () => {
  it("activates on press and previews what is under the pointer", () => {
    const input = controller(() => {});
    input.press({ clientX: 0, clientY: -102 });

    expect(input.active).toBe(true);
    expect(input.preview).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
      score: 60,
    });
  });

  it("commits nothing until release", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.press({ clientX: 0, clientY: -102 });
    expect(commits).toHaveLength(0);

    input.release();
    expect(commits).toHaveLength(1);
  });

  it("commits the position the pointer was dragged to, not where it started", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.press({ clientX: 0, clientY: -102 });
    input.move({ clientX: 0, clientY: -166 });
    input.release();

    expect(commits[0]).toEqual({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });
  });

  it("commits a press that never moved", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.press({ clientX: 0, clientY: -102 });
    input.release();

    expect(commits[0]!.hitZoneKey).toBe("TREBLE");
  });

  it("goes inactive after release", () => {
    const input = controller(() => {});
    input.press({ clientX: 0, clientY: -102 });
    input.release();

    expect(input.active).toBe(false);
    expect(input.preview).toBeNull();
  });

  it("commits nothing when cancelled", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.press({ clientX: 0, clientY: -102 });
    input.cancel();
    input.release();

    expect(commits).toHaveLength(0);
    expect(input.active).toBe(false);
  });

  it("commits a surround tap as a miss with real coordinates", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.press({ clientX: 0, clientY: -190 });
    input.release();

    expect(commits[0]).toEqual({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: 0,
      locationY: -190,
    });
  });

  it("commits an unseen dart with no coordinates", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.commitUnseen();

    expect(commits[0]).toEqual({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
  });

  it("exposes a magnifier placement while active", () => {
    const input = controller(() => {});
    input.press({ clientX: 200, clientY: 400 });

    expect(input.placement).not.toBeNull();
    expect(input.placement!.offsetX).toBeLessThan(0);
  });

  it("ignores a release that follows no press", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.release();

    expect(commits).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/board-input.module.test.ts`
Expected: FAIL — `boardInput` is not exported.

- [ ] **Step 3: Write the controller**

Append to `app/src/modules/game/board-input.module.ts`, adding the imports `import { classify } from "@lib/game/board/board-geometry.module";`, `import type { BoardHit } from "@lib/game/board/types";` and `import type { DartObservation } from "./types";`:

```typescript
export type BoardInputOptions = {
  toBoard: ScreenToBoard;
  onCommit: (observation: DartObservation) => void;
  handedness?: Handedness;
  viewport?: { width: number; height: number };
  magnifierSize?: number;
};

export type BoardInputController = {
  readonly active: boolean;
  readonly preview: BoardHit | null;
  readonly point: BoardCoordinate | null;
  readonly placement: MagnifierPlacement | null;
  press(pointer: BoardPointer): void;
  move(pointer: BoardPointer): void;
  release(): void;
  cancel(): void;
  commitUnseen(): void;
};

const DEFAULT_MAGNIFIER_SIZE = 120;

/**
 * The press-drag-release cycle over the board.
 *
 * Nothing commits until release, because the treble ring is 10 mm tall and a
 * fingertip covers far more than that: the player needs to see what is under
 * the crosshair, adjust, and only then let go. A press that never moves still
 * commits at its own position, so a confident tap costs one gesture.
 */
export function boardInput(
  options: BoardInputOptions,
): BoardInputController {
  const magnifierSize = options.magnifierSize ?? DEFAULT_MAGNIFIER_SIZE;
  const handedness = options.handedness ?? "RIGHT";

  let point: BoardCoordinate | null = null;
  let placement: MagnifierPlacement | null = null;
  let active = false;

  function track(pointer: BoardPointer): void {
    const board = options.toBoard(pointer);
    if (!board) return;

    point = board;
    placement = magnifierPlacement(
      pointer,
      options.viewport ?? { width: 0, height: 0 },
      handedness,
      magnifierSize,
    );
  }

  function reset(): void {
    active = false;
    point = null;
    placement = null;
  }

  return {
    get active() {
      return active;
    },
    get preview() {
      return point ? classify(point.x, point.y) : null;
    },
    get point() {
      return point;
    },
    get placement() {
      return placement;
    },

    press(pointer) {
      active = true;
      track(pointer);
    },

    move(pointer) {
      if (!active) return;
      track(pointer);
    },

    release() {
      if (!active || !point) {
        reset();
        return;
      }

      const hit = classify(point.x, point.y);
      const committed = point;
      reset();

      options.onCommit({
        hitTargetNumber: hit.targetNumber,
        hitZoneKey: hit.zoneKey,
        locationX: committed.x,
        locationY: committed.y,
      });
    },

    cancel() {
      reset();
    },

    commitUnseen() {
      reset();
      options.onCommit({
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/board-input.module.test.ts`
Expected: PASS, 20 tests total.

- [ ] **Step 5: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/modules/game/board-input.module.ts app/tests/modules/game/board-input.module.test.ts
git commit -m "Add the board press-drag-release input controller"
```

---

### Task 4: `DartBoard.astro` component

**Files:**
- Create: `app/src/components/ui/DartBoard.astro`

**Interfaces:**
- Consumes: `app/src/assets/dartboard.svg`.
- Produces: a board that renders, exposes a stable ref for the input module, and carries no logic.

- [ ] **Step 1: Read the conventions**

Read an existing component in `app/src/components/ui/` plus `docs/architecture/07-Frontend/05-Astro-Components.md`. Note the frontmatter order, prop typing and `cn()` usage — the component below must match them.

- [ ] **Step 2: Check how the SVG is currently consumed**

Run: `cd app && grep -rn "dartboard.svg\|bg-dartboard" src --include=*.astro --include=*.ts | head`
Expected: shows whether SVGs are imported as components (`astro-icon`, `?raw`, or a direct import). Use the same mechanism — do not introduce a second one.

- [ ] **Step 3: Write the component**

Create `app/src/components/ui/DartBoard.astro`. Inline the SVG so its elements are addressable, give the root `<svg>` a stable hook for the Alpine wiring, and keep every behaviour out of it:

```astro
---
import { cn } from "@utils/cn";

type Props = {
  class?: string;
};

const { class: className, ...props } = Astro.props;
---

<div
  class={cn("relative touch-none select-none", className)}
  {...props}
>
  <svg
    viewBox="-220,-220,440,440"
    class="block h-auto w-full"
    x-ref="board"
    role="img"
    aria-label="Dartboard"
  >
    <!-- board contents copied verbatim from src/assets/dartboard.svg -->
  </svg>
</div>
```

Replace the placeholder comment with the full contents of `dartboard.svg`'s `<g class="dartboard-group">` element, unchanged. Do not use an HTML comment in the final file — `scripts/check-astro-conventions.sh` rejects them in template regions; use an Astro `{/* */}` comment in frontmatter if a note is needed.

`touch-none` is essential: without it the browser treats a drag on the board as a scroll and the magnifier never tracks.

- [ ] **Step 4: Verify it renders**

Add the component temporarily to `app/src/pages/profile/index.astro`, run `cd app && npx astro dev --background`, and open the profile page.
Expected: a full dartboard, scaling with the container width. Remove the temporary usage afterwards and stop the server.

- [ ] **Step 5: Run the Astro gates**

Run: `cd .. && bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh && bash scripts/check-file-locations.sh`
Expected: all OK.

- [ ] **Step 6: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/components/ui/DartBoard.astro
git commit -m "Add the DartBoard presentational component"
```

---

### Task 5: Magnifier overlay component

**Files:**
- Create: `app/src/components/ui/BoardMagnifier.astro`

**Interfaces:**
- Consumes: the controller's `point`, `preview` and `placement` (Task 3).
- Produces: a zoomed inset following the pointer, showing a crosshair and the resolved read.

- [ ] **Step 1: Write the component**

Create `app/src/components/ui/BoardMagnifier.astro`. It renders a second copy of the board SVG inside a clipped circle, translated so the pressed point sits at its centre and scaled 4×:

```astro
---
import { cn } from "@utils/cn";

type Props = {
  class?: string;
  zoom?: number;
  size?: number;
};

const { class: className, zoom = 4, size = 120, ...props } = Astro.props;
---

<div
  class={cn(
    "pointer-events-none absolute z-10 overflow-hidden rounded-full border-2 border-accent bg-surface",
    className,
  )}
  x-cloak
  x-show="input.active"
  :style="`width: ${size}px; height: ${size}px; left: ${pointerX + (input.placement?.offsetX ?? 0) - size / 2}px; top: ${pointerY + (input.placement?.offsetY ?? 0) - size / 2}px`"
  {...props}
>
  <svg
    viewBox="-220,-220,440,440"
    class="block h-full w-full"
    :style="`transform: scale(${zoom}) translate(${-(input.point?.x ?? 0)}px, ${-(input.point?.y ?? 0)}px)`"
  >
    {/* board contents copied verbatim from src/assets/dartboard.svg */}
  </svg>

  <div class="absolute inset-0 flex items-center justify-center">
    <div class="h-4 w-px bg-accent"></div>
    <div class="absolute h-px w-4 bg-accent"></div>
  </div>
</div>

<p
  class="text-center text-sm font-semibold text-foreground"
  x-cloak
  x-show="input.active"
  x-text="input.preview ? `${input.preview.zoneKey} ${input.preview.targetNumber ?? ''} · ${input.preview.score}` : ''"
>
</p>
```

Two things to fix against the real codebase before committing:

- The `size` and `zoom` props are read inside Alpine expression strings, where Astro's server-side values are not in scope. Pass them into the Alpine component's data instead — via `x-data` arguments on the parent, or as `data-` attributes the factory reads — rather than interpolating them into the `:style` string.
- Replace `border-accent`, `bg-surface`, `bg-accent` and `text-foreground` with the tokens the style guide actually defines.

The transform above scales about the SVG's own origin. Verify visually in Task 7 that the pressed point lands under the crosshair, and adjust the translate order if it does not — `transform` applies right to left, so `scale` then `translate` moves by scaled units.

- [ ] **Step 2: Run the Astro gates**

Run: `cd .. && bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh`
Expected: all OK.

- [ ] **Step 3: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/components/ui/BoardMagnifier.astro
git commit -m "Add the board magnifier overlay"
```

---

### Task 6: Board input Alpine factory

**Files:**
- Create: `app/src/lib/game/board-input.data.ts`
- Test: `app/tests/lib/game/board-input.data.test.ts`

**Interfaces:**
- Consumes: `boardInput`, `screenToBoard` (Tasks 1–3).
- Produces: `boardInputData(onCommit: (observation: DartObservation) => void)` — an Alpine factory exposing `input`, `pointerX`, `pointerY`, `onPointerDown(event)`, `onPointerMove(event)`, `onPointerUp()`, `onPointerCancel()`, `recordUnseen()`.

This bridges DOM events to the pure controller. It lives in `lib/` because no `.ts` may sit under `components/` or `pages/`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/board-input.data.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { boardInputData } from "@lib/game/board-input.data";
import type { DartObservation } from "@modules/game/types";

function withFakeBoard(data: ReturnType<typeof boardInputData>) {
  const matrix = {
    inverse: () => matrix,
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  };
  const point = {
    x: 0,
    y: 0,
    matrixTransform: () => ({ x: point.x, y: point.y }),
  };

  data.$refs = {
    board: {
      createSVGPoint: () => point,
      getScreenCTM: () => matrix,
    },
  } as never;

  return data;
}

describe("boardInputData", () => {
  it("commits an observation on pointer up", () => {
    const commits: DartObservation[] = [];
    const data = withFakeBoard(
      boardInputData((observation) => commits.push(observation)),
    );

    data.onPointerDown({
      clientX: 0,
      clientY: -102,
      preventDefault: vi.fn(),
    } as never);
    data.onPointerUp();

    expect(commits).toHaveLength(1);
    expect(commits[0]!.hitZoneKey).toBe("TREBLE");
  });

  it("tracks the pointer position for the magnifier", () => {
    const data = withFakeBoard(boardInputData(() => {}));

    data.onPointerDown({
      clientX: 12,
      clientY: -34,
      preventDefault: vi.fn(),
    } as never);

    expect(data.pointerX).toBe(12);
    expect(data.pointerY).toBe(-34);
  });

  it("commits nothing on pointer cancel", () => {
    const commits: DartObservation[] = [];
    const data = withFakeBoard(
      boardInputData((observation) => commits.push(observation)),
    );

    data.onPointerDown({
      clientX: 0,
      clientY: -102,
      preventDefault: vi.fn(),
    } as never);
    data.onPointerCancel();
    data.onPointerUp();

    expect(commits).toHaveLength(0);
  });

  it("records an unseen dart with no coordinates", () => {
    const commits: DartObservation[] = [];
    const data = withFakeBoard(
      boardInputData((observation) => commits.push(observation)),
    );

    data.recordUnseen();

    expect(commits[0]).toEqual({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/board-input.data.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the factory**

Create `app/src/lib/game/board-input.data.ts`:

```typescript
import {
  boardInput,
  screenToBoard,
  type BoardInputController,
} from "@modules/game/board-input.module";
import type { DartObservation } from "@modules/game/types";

/**
 * Bridges pointer events on the board SVG to the pure input controller. The
 * controller is built lazily on first press, because `$refs.board` is not
 * populated until Alpine has mounted the component.
 */
export function boardInputData(
  onCommit: (observation: DartObservation) => void,
) {
  return {
    input: null as BoardInputController | null,
    pointerX: 0,
    pointerY: 0,

    controller(): BoardInputController {
      if (!this.input) {
        this.input = boardInput({
          toBoard: screenToBoard(this.$refs.board as SVGSVGElement),
          onCommit,
          viewport: {
            width: globalThis.innerWidth ?? 0,
            height: globalThis.innerHeight ?? 0,
          },
        });
      }
      return this.input;
    },

    onPointerDown(event: PointerEvent) {
      event.preventDefault();
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.controller().press(event);
    },

    onPointerMove(event: PointerEvent) {
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.controller().move(event);
    },

    onPointerUp() {
      this.controller().release();
    },

    onPointerCancel() {
      this.controller().cancel();
    },

    recordUnseen() {
      this.controller().commitUnseen();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/board-input.data.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/lib/game/board-input.data.ts app/tests/lib/game/board-input.data.test.ts
git commit -m "Bridge pointer events to the board input controller"
```

---

### Task 7: Wire the 501 play page

**Files:**
- Modify: `app/src/pages/games/501/play/index.astro`
- Modify: the 501 play page's Alpine data file — locate in Step 1

**Interfaces:**
- Consumes: `DartBoard.astro`, `BoardMagnifier.astro`, `boardInputData`, the engine's visual path (plan 1), the settings store (plan 2).
- Produces: a playable visual 501 session.

- [ ] **Step 1: Read the current play page**

Run: `cd app && cat src/pages/games/501/play/index.astro && ls src/lib/game/`
Expected: the page's structure and the data file backing it. Note how the engine is constructed and how the keypad feeds `record()`.

- [ ] **Step 2: Add the visual branch to the page data**

In the 501 play data file, construct the engine with the session's input mode as the third argument — `fiveOhOneEngineFactory.create(config, prior, inputMode)` — and spread `boardInputData((observation) => this.recordDart(observation))` into the returned object. `recordDart` calls the engine's `record()` with the observation and refreshes the displayed state exactly as the keypad path does.

Keep the keypad path intact and reachable. It is the accessible alternative for keyboard and switch users, and removing it would make visual sessions pointer-only.

- [ ] **Step 3: Render the board when the session is visual**

In the page, add the board beside the existing keypad, shown only for a visual session:

```astro
<div
  x-cloak
  x-show="inputMode === 'VISUAL_BOARD'"
  class="space-y-3"
>
  <div
    class="relative"
    @pointerdown="onPointerDown($event)"
    @pointermove="onPointerMove($event)"
    @pointerup="onPointerUp()"
    @pointercancel="onPointerCancel()"
  >
    <DartBoard />
    <BoardMagnifier />
  </div>

  <button
    type="button"
    class="w-full rounded-lg border border-border px-4 py-3 text-foreground"
    @click="recordUnseen()"
  >
    Dart not seen
  </button>
</div>
```

Replace the token names with the real ones, and import both components in the frontmatter.

- [ ] **Step 4: Play a session end to end**

Run: `cd app && npx astro dev --background`, set analytics mode in the profile, start a 501 session, and throw a leg.
Expected, checked one by one:
- Pressing the board opens the magnifier clear of your thumb.
- Dragging moves the crosshair; the read updates live.
- Releasing records the dart and the remaining score drops by its value.
- Three darts close the visit.
- A checkout on a double ends the leg; the same score on a treble does not.
- A bust leaves the remaining score unchanged.
- Undo removes one dart at a time.
Stop the server when done.

- [ ] **Step 5: Confirm the persisted facts**

After completing a session, run:

```bash
cd app && npx dbmate --url "$DATABASE_URL" query "
  SELECT dart_number, hit_target_number, score, location_x, location_y
  FROM v_dart_locations ORDER BY turn_sequence, dart_number LIMIT 10;
"
```

Expected: one row per dart with real millimetre coordinates. Zero rows means the batch never uploaded or the coordinates were dropped — fix before continuing.

- [ ] **Step 6: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/pages/games/501 app/src/lib/game
git commit -m "Wire the visual board into the 501 play page"
```

---

### Task 8: Wire the Score Training play page

**Files:**
- Modify: `app/src/pages/games/score-training/play/index.astro`
- Modify: the Score Training play page's Alpine data file

**Interfaces:**
- Consumes: the same components and factory as Task 7.
- Produces: a playable visual Score Training session.

- [ ] **Step 1: Apply the same wiring**

Repeat Task 7 Steps 2 and 3 against the Score Training play page and its data file, constructing the engine with `scoreTrainingEngineFactory.create(config, prior, inputMode)`.

The board markup is identical to Task 7 Step 3 — if the two pages end up with the same block verbatim, extract it into a shared `app/src/components/layout/games/BoardInputPanel.astro` and use it in both. Do not extract before the second use; the first use does not prove the shape.

- [ ] **Step 2: Play a session end to end**

Run: `cd app && npx astro dev --background`, start a Score Training session in analytics mode, throw several visits.
Expected: three darts close each visit; the visit total is the sum of the three darts; the round counter advances only on the third dart; undo removes one dart at a time. Stop the server.

- [ ] **Step 3: Confirm the persisted facts**

Run the `v_dart_locations` query from Task 7 Step 5 against the new session.
Expected: three rows per visit, with coordinates, and `turn_total_score` equal to the sum of the visit's dart scores.

- [ ] **Step 4: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/pages/games/score-training app/src/lib/game app/src/components
git commit -m "Wire the visual board into the Score Training play page"
```

---

### Task 9: Accessibility and documentation

**Files:**
- Modify: `docs/architecture/07-Frontend/00-Overview.md`
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `decisions/frontend/astro.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documentation matching the shipped UI.

- [ ] **Step 1: Verify the keyboard path**

With a visual session running, put the mouse aside and use only the keyboard.
Expected: the keypad is reachable by Tab, every control has a visible focus ring, and a full visit can be entered without a pointer. If any of that fails, fix it before documenting — an accessible alternative that cannot actually be reached is not one.

- [ ] **Step 2: Check the board's screen-reader story**

Confirm the board SVG carries `role="img"` and a meaningful `aria-label`, and that the magnifier is `aria-hidden` or otherwise not announced — it is a visual aid duplicating information the live read already gives.

- [ ] **Step 3: Document the interaction**

In `07-Frontend/00-Overview.md`, add a short section describing visual board input: press-drag-release, the magnifier, the "dart not seen" action, and the keypad as the accessible alternative. In `07-Style-Guide.md`, note the `touch-none` requirement on pointer-tracked surfaces and the magnifier's placement rules.

- [ ] **Step 4: Append the decision**

To `decisions/frontend/astro.md`, append a decision recording press-drag-release with a magnifier over raw tapping, citing the 10 mm treble ring against a ~45 px fingertip and the fact that a misclassified tap corrupts the fact log rather than only the UI. Use the next free id and copy the existing block format.

- [ ] **Step 5: Update the context map**

Register `DartBoard.astro`, `BoardMagnifier.astro`, `board-input.module.ts` and `board-input.data.ts` in the File Inventory, and bump the version line with a dated note.

- [ ] **Step 6: Run every gate**

Run:

```bash
cd .. && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-decision-ids.sh && bash scripts/check-agent-mirrors.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-type-barrels.sh && bash scripts/check-file-locations.sh && bash scripts/check-alias-sync.sh && bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh && bash scripts/check-game-engines.sh
```

Expected: every script OK.

- [ ] **Step 7: Run the full validation**

Run: `cd app && npm run validate:app && npm run format:check`
Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add docs decisions
git commit -m "Document visual board input and its accessible alternative"
```

---

## Self-Review

**Spec coverage.** Screen-to-millimetre transform (Task 1); magnifier placement including edge flip and handedness (Task 2); press-drag-release with commit-on-release, cancel, surround misses and the unseen-dart path (Task 3); `DartBoard.astro` as pure presentation (Task 4); the magnifier overlay with crosshair and live read (Task 5); the DOM bridge (Task 6); both play pages (Tasks 7–8); accessibility verification and documentation (Task 9).

**Type consistency.** `BoardPointer`, `BoardCoordinate`, `ScreenToBoard`, `Handedness` and `MagnifierPlacement` are each defined once in Task 1 or 2 and reused unchanged in Tasks 3 and 6. `BoardInputController`'s members are named identically in its definition (Task 3), its test, and the factory that wraps it (Task 6). `DartObservation` matches plan 1's widened shape in every commit path.

**Known softness, stated rather than papered over.** Task 4 and Task 5 both require copying the SVG's contents into a component, which this plan cannot inline without reproducing 19 KB of paths — each says to copy verbatim from `dartboard.svg`. Task 5 carries two flagged defects in its own code sample: Astro props interpolated into Alpine expression strings, which will not resolve at runtime, and a `transform` order that may translate in unscaled units; both are called out with what to check rather than left to be discovered. Task 7 Step 2 describes the engine wiring in prose because the play page's data file structure could not be read within this plan's context budget — it begins with a read step. Task 8 deliberately defers the shared-component extraction to the second use rather than speculating a shape from the first.
