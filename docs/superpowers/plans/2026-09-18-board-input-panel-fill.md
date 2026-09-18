# Board Input Panel Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the visual dartboard input panel grow to fill the real leftover space in the play screen's flex layout (instead of a hardcoded `max-h-[60vh]` cap) and land its undo/bounce-out buttons flush at the bottom, on every screen size, with zero change to dart-landing hit-test behavior.

**Architecture:** Two one-line class edits to the two shared board-panel components (`BoardInputPanel.astro`, `ExerciseBoardInputPanel.astro`): make the panel's root wrapper a genuine `flex-1` participant in its parent's flex column (so it receives real leftover vertical space), and drop the `max-h-[60vh]` cap on the inner board element now that it has real space to size against. No other files change; no logic changes; no new tests are required (see Testing Note below).

**Tech Stack:** Astro `.astro` component markup, Tailwind CSS v4 utility classes.

## Global Constraints

- Minimal diffs — this plan touches exactly 2 files, 2 lines of class-list edits each (spec: "Fix").
- Semantic tokens / primitives only — not applicable here (no new colors, no new primitive markup; pure layout utility edit).
- Dart-landing hit-test math (`board-input.module.ts`'s `screenToBoard`, `board-geometry.module.ts`'s `classify`) must not change — spec's "Scope / non-goals" explicitly excludes it; these files are not touched by this plan.
- `bash scripts/check-astro-conventions.sh` must pass on any touched `.astro` file (`app/CLAUDE.md`, Frontend Agent Guide pre-completion checklist).
- `npm run format:check` must be clean (`app/CLAUDE.md`, "Before every PR create or update").
- `npm run validate:app` must exit zero before claiming the task done (`app/CLAUDE.md` Validation Standard Procedure).
- Context Maintenance (root `CLAUDE.md`) must run before claiming the task done.

## Testing Note (read before Task 1)

Per `app/CLAUDE.md` §Test-Driven Development and the Frontend Agent Guide's
TDD table (rule 11): `.astro` component markup with variant/branching
logic is *not* unit-tested — "there is no Astro-component test runner in
this project" (D101) — and `scripts/check-test-coverage.sh` (the gate that
enforces "a source edit needs a test edit") only fires on runtime `.ts`
files under `app/src/` or `app/scripts/`, not `.astro` files. This plan's
edits are pure Tailwind class-list changes on two `.astro` files with no
`.ts` logic change, so there is no failing-test step to write — the
red→green→refactor cycle does not apply here. Verification instead comes
from `scripts/check-astro-conventions.sh`, `npm run format:check`, `astro
check` (part of `validate:app`), and the visual harness technique already
used to validate the design (Task 3).

---

### Task 1: Fix `BoardInputPanel.astro`

**Files:**
- Modify: `app/src/components/layout/games/BoardInputPanel.astro:44` and `:47`

**Interfaces:**
- Consumes: nothing new — same Alpine scope contract (`boardInputData()`) as before, unchanged.
- Produces: nothing new — no exported symbol changes. Later tasks rely only on the class-list edit being identical in shape to Task 2's edit on the mirror file.

- [ ] **Step 1: Edit the outer wrapper's class list**

Current (line 41-45):
```astro
<div
  x-show="!finished && !$store.game.timerPaused && hasActiveSession && $store.game.inputModeKey === 'VISUAL_BOARD'"
  x-cloak
  class="mt-3 flex min-h-0 flex-col items-center gap-3"
>
```

Change the `class` attribute to add `flex-1` (so this wrapper is a real flex-grow item in `FiveOhOne.astro`'s — and every other game interface's — `flex flex-col flex-1 min-h-0 gap-3` column, and actually receives leftover vertical space instead of sizing to content):

```astro
<div
  x-show="!finished && !$store.game.timerPaused && hasActiveSession && $store.game.inputModeKey === 'VISUAL_BOARD'"
  x-cloak
  class="mt-3 flex min-h-0 flex-1 flex-col items-center gap-3"
>
```

- [ ] **Step 2: Edit the board element's class list**

Current (line 46-52):
```astro
  <div
    class="relative min-h-0 max-h-[60vh] max-w-full flex-1 aspect-square touch-none"
    @pointerdown="onPointerDown($event)"
    @pointermove="onPointerMove($event)"
    @pointerup="onPointerUp()"
    @pointercancel="onPointerCancel()"
  >
```

Remove `max-h-[60vh]` — with Step 1's wrapper now supplying real, definite
leftover height, `flex-1 min-h-0 aspect-square max-w-full` alone resolves
to `min(available height, available width)`, which is what the spec
requires (no magic viewport-relative number):

```astro
  <div
    class="relative min-h-0 max-w-full flex-1 aspect-square touch-none"
    @pointerdown="onPointerDown($event)"
    @pointermove="onPointerMove($event)"
    @pointerup="onPointerUp()"
    @pointercancel="onPointerCancel()"
  >
```

- [ ] **Step 3: Update the component's own docstring**

The file's header comment (lines 26-29) currently says:

```
 * The board's own square (`aspect-square`) is a `flex-1 min-h-0` item of
 * this panel's column, capped at `max-h-[60vh]` — it sizes off whatever
 * height the play screen's flex layout actually leaves it, rather than
 * a viewport-relative width, so it shrinks first (never the score/target
 * section above it) on a screen too short to fit both (#131).
```

This was inaccurate even before this change (the wrapper wasn't actually a
flex participant, so there was no real "leftover height" to size off —
see the spec's root-cause section) and is now literally wrong (no more
cap). Replace it with:

```
 * The board's own square (`aspect-square`) is a `flex-1 min-h-0` item of
 * this panel's own `flex-1 min-h-0` column, which is itself a flex-grow
 * item of the play screen's column — so the board sizes off the real
 * leftover height the play screen has available, clamped to the
 * container's width by `max-w-full`, with no viewport-relative magic
 * number. On a screen too short to fit both, it shrinks before the
 * score/target section above it, because that section's own min-content
 * size (the big score number) floors its height while the board — pure
 * SVG, no text — has none (#131).
```

- [ ] **Step 4: Run the Astro conventions check**

Run: `cd app && bash ../scripts/check-astro-conventions.sh`
Expected: exits 0, no output naming `BoardInputPanel.astro`.

- [ ] **Step 5: Run format check**

Run: `cd app && npm run format:check`
Expected: exits 0 (Prettier reports no files needing formatting). If it
reports `BoardInputPanel.astro` needs formatting, run `npm run format`,
re-check the diff only touched whitespace, and re-run `format:check`.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/components/layout/games/BoardInputPanel.astro
git commit -m "fix: let visual board input panel fill available space

BoardInputPanel's wrapper wasn't a flex-grow participant in its
parent's column, so the board fell back to a fixed max-h-[60vh] cap
instead of the screen's real leftover height — undersized on tall
screens, and (on short screens) let the board claim more room than
the score card instead of shrinking first as intended (#131)."
```

---

### Task 2: Fix `ExerciseBoardInputPanel.astro`

**Files:**
- Modify: `app/src/components/layout/training/exercises/ExerciseBoardInputPanel.astro:25` and `:27`

**Interfaces:**
- Consumes: nothing new — same Alpine scope contract (`board`, pointer handlers, `recordUnseen`, `visitMarkers`, `undoVisit()`) as before, unchanged.
- Produces: nothing new.

- [ ] **Step 1: Edit the outer wrapper's class list**

Current (line 25):
```astro
<div class="mt-3 flex min-h-0 flex-col items-center gap-3">
```

Change to:
```astro
<div class="mt-3 flex min-h-0 flex-1 flex-col items-center gap-3">
```

- [ ] **Step 2: Edit the board element's class list**

Current (line 26-32):
```astro
  <div
    class="relative min-h-0 max-h-[60vh] max-w-full flex-1 aspect-square touch-none"
    @pointerdown="onPointerDown($event)"
    @pointermove="onPointerMove($event)"
    @pointerup="onPointerUp()"
    @pointercancel="onPointerCancel()"
  >
```

Change to:
```astro
  <div
    class="relative min-h-0 max-w-full flex-1 aspect-square touch-none"
    @pointerdown="onPointerDown($event)"
    @pointermove="onPointerMove($event)"
    @pointerup="onPointerUp()"
    @pointercancel="onPointerCancel()"
  >
```

- [ ] **Step 3: Update the component's own docstring**

The file's header comment (lines 2-14) documents this component as
mirroring `BoardInputPanel.astro`. Add one clause tying the sizing claim
to the same rationale, so it doesn't silently drift from Task 1's Step 3
wording. Current second paragraph ends with:

```
 * Declares no x-data of its own: mounts inside the exercise step's own
 * scope and reads what boardInputData() contributes there (board, the
 * pointer handlers, recordUnseen, visitMarkers) plus `undoVisit()`.
 */
```

Append a third paragraph:

```
 *
 * Sizing mirrors BoardInputPanel.astro exactly: this wrapper is `flex-1
 * min-h-0` in its parent's column, so the board (`flex-1 min-h-0
 * aspect-square max-w-full`) sizes off the real leftover height rather
 * than a viewport-relative cap.
 */
```

- [ ] **Step 4: Run the Astro conventions check**

Run: `cd app && bash ../scripts/check-astro-conventions.sh`
Expected: exits 0, no output naming `ExerciseBoardInputPanel.astro`.

- [ ] **Step 5: Run format check**

Run: `cd app && npm run format:check`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/components/layout/training/exercises/ExerciseBoardInputPanel.astro
git commit -m "fix: let exercise board input panel fill available space

Mirrors the BoardInputPanel.astro fix: the wrapper becomes a real
flex-1 participant in its parent column and the max-h-[60vh] cap on
the board is removed, so Switching/Double Pattern's board also fills
real leftover space instead of an arbitrary viewport fraction."
```

---

### Task 3: Visual regression check + full validation

**Files:** none modified — verification only.

**Interfaces:** none.

- [ ] **Step 1: Rebuild the static verification harness against the real post-fix files**

The design spec (`docs/superpowers/specs/2026-09-18-board-input-panel-fill-design.md`)
was validated with a static Tailwind-compiled harness reproducing
`BoardInputPanel.astro`'s exact class list plus a real `viewBox`-based SVG
placeholder, screenshotted via Playwright at three viewports. Re-run the
same technique against the actual post-fix class lists to confirm the
committed files behave as designed:

```bash
mkdir -p /tmp/board-panel-verify
cat > /tmp/board-panel-verify/panel.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="out.css">
<style>
  html, body { margin:0; padding:0; background:#0a0e14; height:100dvh; }
  .measure { position:absolute; font: 11px monospace; color:#0f0; background:rgba(0,0,0,.6); padding:1px 4px; z-index:50; }
</style>
</head>
<body class="text-white">
  <div class="mx-auto flex h-full max-w-lg flex-col">
    <header class="relative flex items-center pt-3 shrink-0">
      <div class="w-1/8"></div>
      <div class="w-6/8"><h1 class="text-center text-lg font-semibold">501</h1></div>
      <div class="w-1/8"></div>
    </header>
    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
      <div class="flex flex-col flex-1 min-h-0 gap-3">
        <div class="flex-1 min-h-0 glass rounded-lg max-h-2/5 h-full" id="score">
          <div class="rounded-lg border border-white/20 bg-white/5 h-full mx-auto flex flex-col items-center justify-center p-3">
            <h1 class="font-mono font-bold text-7xl">301</h1>
            <span class="text-sm uppercase text-white/60">Target</span>
          </div>
        </div>
        <div class="mt-3 flex min-h-0 flex-1 flex-col items-center gap-3">
          <div id="board" class="relative min-h-0 max-w-full flex-1 aspect-square touch-none">
            <svg viewBox="-220,-220,440,440" class="block h-auto w-full" style="border-radius:9999px;background:radial-gradient(circle,#d8c9a3 0%,#d8c9a3 20%,#1a1a1a 21%,#1a1a1a 40%,#2f6b3a 41%,#2f6b3a 100%)"></svg>
          </div>
          <div id="btns" class="flex w-full shrink-0 gap-3">
            <button class="flex-1 h-12 rounded-md bg-white/10">Undo</button>
            <button class="flex-1 h-12 rounded-md bg-white/10">Bounce out</button>
          </div>
        </div>
      </div>
    </main>
  </div>
  <script>
    function label(el, text) {
      const box = document.createElement('div');
      box.className = 'measure';
      const r = el.getBoundingClientRect();
      box.style.top = (r.top + 2) + 'px';
      box.style.left = (r.left + 2) + 'px';
      box.textContent = text;
      document.body.appendChild(box);
    }
    window.addEventListener('load', () => requestAnimationFrame(() => {
      const board = document.getElementById('board');
      const btns = document.getElementById('btns');
      const br = board.getBoundingClientRect();
      const bt = btns.getBoundingClientRect();
      label(board, `board ${Math.round(br.width)}x${Math.round(br.height)}`);
      label(btns, `btns bottom=${Math.round(bt.bottom)} viewportH=${window.innerHeight}`);
    }));
  </script>
</body>
</html>
EOF
cd /home/user/dart-analytics/app
cat > src/styles/__verify_input.css <<'EOF'
@import "./global.css";
@source "/tmp/board-panel-verify/*.html";
EOF
npx --yes @tailwindcss/cli -i src/styles/__verify_input.css -o /tmp/board-panel-verify/out.css
rm src/styles/__verify_input.css
node -e "
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  for (const [name, w, h] of [['12pro',390,844], ['large',460,1000], ['short',390,480]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto('file:///tmp/board-panel-verify/panel.html');
    await page.waitForTimeout(200);
    const btnsBottom = await page.locator('#btns').evaluate(el => Math.round(el.getBoundingClientRect().bottom));
    console.log(name, 'viewportH=' + h, 'btnsBottom=' + btnsBottom, btnsBottom >= h - 2 ? 'FLUSH' : 'GAP=' + (h - btnsBottom));
    await page.screenshot({ path: '/tmp/board-panel-verify/' + name + '.png' });
    await page.close();
  }
  await browser.close();
})();
"
```

Expected output: all three viewports print `FLUSH` (buttons bottom
within 2px of the viewport height, matching the design spec's "Verified
effect" table — no dead space below the buttons at any tested height).

- [ ] **Step 2: Visually confirm no distortion**

Read the three screenshots (`/tmp/board-panel-verify/12pro.png`,
`large.png`, `short.png`). Confirm: the board renders as a circle (not an
oval — i.e. `aspect-square` held even though width and flex-computed
height are resolved somewhat independently), the score card is fully
visible (not clipped) at `short`, and there is no visible gap between the
board and the button row or between the button row and the screen edge.

- [ ] **Step 3: Clean up the verification harness**

```bash
rm -rf /tmp/board-panel-verify
```

- [ ] **Step 4: Run full app validation**

Follow the `validate-app` skill's procedure in full (`npm run
validate:app` from `app/`, plus its `astro check` zero-hint requirement).

Run: `cd app && npm run validate:app`
Expected: every step in the chain exits 0; the type-check step reports 0
errors, 0 warnings, 0 hints.

- [ ] **Step 5: Run the full gate sweep**

Follow the `run-all-gates` skill (dispatches `check-*.sh` scripts by
changed area — this change is under `app/`).

Expected: every dispatched script reports pass.

- [ ] **Step 6: Context Maintenance**

Follow the `context-maintenance` skill. This change:
- touches no `docs/architecture/**` file whose content it contradicts
  (the fix corrects a stale in-code comment, not an architecture doc);
- does not add/move/rename any doc, so `00-File-Inventory.md` needs no
  edit;
- is not itself a new architectural decision (it's a bugfix matching
  existing documented intent — flex-fill layout, #131's "board shrinks
  first" rule) — no new `decisions/**` entry required unless the
  context-maintenance skill's own checklist says otherwise once run.

Run whatever the skill's checklist specifies and confirm each item.

- [ ] **Step 7: Push the branch**

```bash
cd /home/user/dart-analytics
git push -u origin claude/gamemode-ui-scaling-c1jt0t
```

Expected: push succeeds (retry with exponential backoff per the Git
Operations rules only on network failure).

---

## Self-Review Notes

- **Spec coverage:** "Fix" (2 files × 2 edits) → Task 1 + Task 2. "Verified
  effect" table → Task 3 Step 1 re-runs the same harness technique against
  the real post-fix files. "Scope / non-goals" (hit-test math untouched,
  magnifier untouched, multiplayer not separately re-harnessed) → no task
  touches `board-input.module.ts`, `board-geometry.module.ts`, or
  `BoardMagnifier.astro`; multiplayer is explicitly out of scope per the
  spec and not re-tested here, consistent with the spec's stated risk
  acceptance.
- **Placeholder scan:** no TBD/TODO; every step shows the literal before/
  after class strings and full verification script.
- **Type consistency:** n/a — no functions/types introduced; both tasks
  use identical wrapper/board class-list shapes (`flex-1` added to
  wrapper, `max-h-[60vh]` removed from board) so Task 2 cannot drift from
  Task 1's shape.
