# Paused Screen Glass Play Button and Tips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the paused-timer resume circle with a full-viewport rest screen: a glass play symbol at the viewport centre and a rotating tip card above it (#1210).

**Architecture:** A pure tips module (`src/lib/training/tips/`) holds the copy, the key-to-family matching, the 2-in-3 pick with no repeat, and the display-time formula. A small Alpine factory (`pausedTips`) drives the rotation timer. `CountdownResumePrompt.astro` becomes a `fixed inset-0` overlay that paints the screen background over the title bar and the scoreboard, with the button pinned to the centre and the card centred in the space above it.

**Tech Stack:** Astro, Alpine.js, Tailwind 4 tokens in `src/styles/global.css`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-paused-resume-tips-design.md`

## Global Constraints

- Visual choices come from the Design System artifact `https://claude.ai/artifact/A7QFuSqRwpqyoXUEm7XHsW` (D524, `syncing-design-system` §11). If the code and the artifact disagree, keep the code value and note the id in the ledger.
- Any new colour, gradient or shadow value enters `global.css` as a token first; update `tests/lib/ui/brand-tokens.test.ts`; run `bash scripts/check-style-tokens.sh`.
- Play path: `M7.5 5.147c0-.909 1.008-1.457 1.771-.964l10.157 6.553c.792.511.755 1.677-.066 2.137L9.34 19.4c-.797.446-1.777-.13-1.777-1.043z`, view box `0 0 24 24`, size `size-28` (7rem).
- Fill: radial white 30% at the top to white 12%. Stroke: 0.5 units, vertical white 70% / 10% / 35%. A dark drop shadow below. No circle, no blue.
- Tip card: `--glass-bg` with the glass edges, `rounded-2xl`, mono uppercase sky eyebrow `TIP`, body `text-muted`.
- Each tip ≤ 120 characters, second person, terse, 1–2 sentences, ends with a full stop, no emoji.
- Display time = 2500 ms + 60 ms × characters, clamped to 5000–12000 ms. Fade 300 ms opacity with `--ease-out`; no fade under reduced motion.
- Button keeps `aria-label="Resume timer"` and the `disabledExpr` / `pausedExpr` / `toggleExpr` props.
- No `--no-verify`. Pre-commit hooks are slow; run commits in the background.

## Review Focus

1. A key with a version suffix the list does not know (`AROUND_THE_CLOCK_V9`) still gets the family tips. Pinned in Task 1 (`tipFamily` test).
2. A routine game step's key arrives as `GAME:<rulesetVersionKey>`; it must map to the game family. Pinned in Task 1.
3. A pause, resume and fast re-pause leaves no second timer running. Pinned in Task 2 (`stop clears the timer` and `start twice keeps one timer`).
4. A general list of 1 tip, or a key list equal to the previous tip, still returns a tip and never loops forever. Pinned in Task 1 (`single-tip pool`).
5. The overlay sits above the sticky title bar and the board panel on every surface. Checked by hand in Task 4 on all 3 surfaces at 390×844 and 375×667.

---

### Task 1: Tips content and pick rules

**Files:**
- Create: `app/src/lib/training/tips/tips.ts` (copy)
- Create: `app/src/lib/training/tips/tip-pick.ts` (rules)
- Test: `app/tests/lib/training/tips/tip-pick.test.ts`

**Interfaces:**
- Produces:
  - `GENERAL_TIPS: readonly string[]` and `KEY_TIPS: Readonly<Record<string, readonly string[]>>` in `tips.ts`.
  - `tipFamily(key: string | null | undefined): string` — strips a leading `GAME:` and a trailing `_V<digits>`; `null`/`undefined` → `""`.
  - `tipsFor(key: string | null | undefined): readonly string[]` — `KEY_TIPS[tipFamily(key)] ?? []`.
  - `pickTip(key: string | null | undefined, previous: string | null, random?: () => number): string` — first `random()` < 2/3 and key tips exist → key pool, else general pool; drop `previous` from the pool unless that empties it; index with a second `random()`.
  - `tipDisplayMs(tip: string): number` and constants `TIP_BASE_MS = 2500`, `TIP_PER_CHAR_MS = 60`, `TIP_MIN_MS = 5000`, `TIP_MAX_MS = 12000`, `TIP_MAX_CHARS = 120`.

- [ ] **Step 1: Write the failing tests**

```ts
describe("tipFamily", () => {
  it.each([
    ["AROUND_THE_CLOCK_V2", "AROUND_THE_CLOCK"],
    ["AROUND_THE_CLOCK_V9", "AROUND_THE_CLOCK"],
    ["121_V2", "121"],
    ["GAME:TUOD_V1", "TUOD"],
    ["WARM_UP", "WARM_UP"],
    [null, ""],
  ])("%s → %s", (key, family) => expect(tipFamily(key)).toBe(family));
});

describe("tip copy", () => {
  const all = [...GENERAL_TIPS, ...Object.values(KEY_TIPS).flat()];
  it("has at least 8 general tips", () => expect(GENERAL_TIPS.length).toBeGreaterThanOrEqual(8));
  it("covers every family", () => {
    for (const k of ["AROUND_THE_CLOCK", "121", "SCORE_TRAINING", "TUOD", "QUICK_SUBTRACT",
      "WARM_UP", "SWITCHING", "SWITCHING_CHAIN", "DOUBLE_PATTERN", "TARGET_SCORING",
      "SCORE_THRESHOLD", "BULLSEYE_CHECKOUT", "BULL_UP", "CHECKOUT_SEQUENCE",
      "RANDOM_CHECKOUT", "HIT_COUNT", "SWITCHBLADE", "DOUBLES_LOCK", "HALVE_IT",
      "DOUBLES_SNAKES_LADDERS"])
      expect(KEY_TIPS[k]?.length ?? 0, k).toBeGreaterThanOrEqual(3);
  });
  it.each(all)("%s fits the copy rules", (tip) => {
    expect(tip.length).toBeLessThanOrEqual(TIP_MAX_CHARS);
    expect(tip).toMatch(/\.$/);
    expect(tip).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("has no duplicates", () => expect(new Set(all).size).toBe(all.length));
});

describe("pickTip", () => {
  it("takes a key tip when the first draw is below 2/3", () =>
    expect(KEY_TIPS.TUOD).toContain(pickTip("TUOD_V1", null, seq(0.66, 0))));
  it("takes a general tip when the first draw is 2/3 or more", () =>
    expect(GENERAL_TIPS).toContain(pickTip("TUOD_V1", null, seq(0.67, 0))));
  it("falls back to general tips for an unknown key", () =>
    expect(GENERAL_TIPS).toContain(pickTip("NOPE_V1", null, seq(0, 0))));
  it("never repeats the previous tip", () => {
    let prev: string | null = null;
    for (let i = 0; i < 500; i++) { const t = pickTip("121_V2", prev); expect(t).not.toBe(prev); prev = t; }
  });
  it("returns the only tip of a single-tip pool", () =>
    expect(pickTip(null, "x", seq(0.9, 0), ["x"])).toBe("x"));
});

describe("tipDisplayMs", () => {
  it.each([[0, 5000], [50, 5500], [120, 9700], [400, 12000]])(
    "%i chars → %i ms", (n, ms) => expect(tipDisplayMs("a".repeat(n))).toBe(ms));
});
```

`seq(...values)` is a local helper returning a `() => number` that yields the values in order. The single-tip test needs a 4th optional `general` parameter on `pickTip`; add it as `general: readonly string[] = GENERAL_TIPS`.

- [ ] **Step 2: Run, expect FAIL** — `cd app && npx vitest run tests/lib/training/tips` → module not found.

- [ ] **Step 3: Write `tips.ts`.** About 8 general tips and 3 per family above. The keys are the families, not version keys. Copy rules: Global Constraints. The owner reviews wording in the PR.

- [ ] **Step 4: Implement `tip-pick.ts`** per the Interfaces block.

- [ ] **Step 5: Run, expect PASS** — same command; all green.

- [ ] **Step 6: Commit** — `feat(tips): paused-screen tips and pick rules (#1210)`.

### Task 2: Rotation timer (Alpine factory)

**Files:**
- Create: `app/src/lib/ui/paused-tips.data.ts`
- Modify: `app/src/lib/client/alpine/register-ui-data.ts` (register `pausedTips`)
- Test: `app/tests/lib/ui/paused-tips.data.test.ts`

**Interfaces:**
- Consumes: `pickTip`, `tipDisplayMs` (Task 1); `prefersReducedMotion` from `@lib/ui/motion`.
- Produces: `pausedTipsData(keyExpr: () => string | null)` returning `{ tip: string; visible: boolean; start(): void; stop(): void; destroy(): void }`. Registered as `Alpine.data("pausedTips", pausedTipsData)`.
  - `start()` clears any running timer, picks a tip (no repeat of the last), sets `visible = true`, and schedules the next change after `tipDisplayMs(tip)`.
  - On a change: without reduced motion, `visible = false`, wait 300 ms (`TIP_FADE_MS`), pick, `visible = true`; with reduced motion, swap at once. Then reschedule.
  - `stop()` clears every pending timeout. `destroy()` calls `stop()`.

- [ ] **Step 1: Write the failing tests** with `vi.useFakeTimers()` and a stubbed `Math.random`:
  - `start shows a tip` — after `start()`, `tip` is in `tipsFor(key)` or `GENERAL_TIPS`; `visible` is true.
  - `rotates after the display time` — advance `tipDisplayMs(first) + 300`; `tip` differs from `first`.
  - `does not rotate early` — advance `tipDisplayMs(first) - 1`; `tip` unchanged.
  - `stop clears the timer` — `start()`, `stop()`, advance 60 000; `tip` unchanged.
  - `start twice keeps one timer` — `start(); start();` then `vi.getTimerCount()` is 1.
  - `reduced motion swaps without fading` — stub `matchMedia` true; at the change `visible` never goes false.

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/lib/ui/paused-tips.data.test.ts`.

- [ ] **Step 3: Implement and register.**

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** — `feat(ui): pausedTips rotation timer (#1210)`.

### Task 3: Tokens for the glass play symbol

**Files:**
- Modify: `app/src/styles/global.css` (`:root` tokens next to `--raised-*`)
- Test: `app/tests/lib/ui/brand-tokens.test.ts`

**Interfaces:**
- Produces: CSS custom properties `--play-glass-fill-top` (`oklch(100% 0 0 / 0.30)`), `--play-glass-fill-bottom` (`oklch(100% 0 0 / 0.12)`), `--play-glass-edge-top` (`/ 0.70`), `--play-glass-edge-mid` (`/ 0.10`), `--play-glass-edge-bottom` (`/ 0.35`), `--play-glass-shadow` (`drop-shadow(0 0.375rem 0.625rem oklch(0% 0 0 / 0.6))`).

Before Step 1, read the artifact's tokens file (`Artifact read`, D524 §11). If an existing raised token already holds one of these values, reuse it and drop the new name; ledger the mapping.

- [ ] **Step 1: Add failing assertions** to `brand-tokens.test.ts` that each token exists in `global.css` with the value above, following that file's existing pattern.
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/lib/ui/brand-tokens.test.ts`.
- [ ] **Step 3: Add the tokens.**
- [ ] **Step 4: Run, expect PASS**, then `bash ../scripts/check-style-tokens.sh` → OK.
- [ ] **Step 5: Commit** — `feat(style): glass play symbol tokens (#1210)`.

### Task 4: Paused overlay component and call sites

**Files:**
- Modify: `app/src/components/layout/games/CountdownResumePrompt.astro`
- Modify: `app/src/components/layout/games/SeatedPlayScreen.astro:194`
- Modify: `app/src/pages/training/routines/play/index.astro:268-272`
- Modify: `app/src/components/layout/training/trivia/QuickSubtract.astro:122-126`
- Modify: `app/src/lib/training/routines/routine-play.data.ts` (add `tipKey()`)
- Test: `app/tests/lib/training/routines/routine-play.data.test.ts` (existing file; add cases), `app/tests/components/layout/games/countdown-resume-prompt.test.ts` (new, source-level)

**Interfaces:**
- Consumes: `pausedTips` (Task 2), tokens (Task 3).
- New prop on `CountdownResumePrompt`: `tipKeyExpr?: string`, default `"$store.game.rulesetVersionKey"`.
- Call sites: SeatedPlayScreen uses the default. Routine page passes `tipKeyExpr="tipKey()"`. Quick Subtract passes `tipKeyExpr="'QUICK_SUBTRACT'"`.
- `tipKey(this: RoutinePlayContext): string | null` returns `stepAdapterKey(step)` for the current step, or `null` with no step.

Layout (spec "Layout"): the root is `fixed inset-0 z-50 bg-surface` (the body colour; if the ambient glow behind the page disappears, check the artifact and match it) with `x-show={pausedExpr}` and `x-cloak`. The button is `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`. The tip zone is `absolute inset-x-4 top-0 flex items-center` with `height: calc(50% - 3.5rem)` (half of `size-28`), so the card is centred between the page top and the button top. Use the existing safe-area padding utility for the top inset if the page has one. The root carries `x-data="pausedTips(() => (<tipKeyExpr>))"` and `x-effect="(<pausedExpr>) ? start() : stop()"`. The card text uses `x-text="tip"` and `:class` toggling `opacity-0` with `transition-opacity duration-300 ease-out` and `motion-reduce:transition-none`. The button is a plain `<button type="button" aria-label="Resume timer">` with an inline SVG of the play path; the gradients reference Task 3's tokens through `stop-color`/`stop-opacity` or `style`. Check the artifact's surfaces section for the tip card's glass classes (`glass` utility or `--glass-bg` + `--glass-edge`), per D524 §11.

- [ ] **Step 1: Write failing tests.**
  - `routine-play.data.test.ts`: `tipKey` returns `"WARM_UP"` for a warm-up step, `"GAME:TUOD_V1"` for a TUOD game step, and `null` before steps load. Build the context the same way the file's existing tests do.
  - `countdown-resume-prompt.test.ts` (reads the `.astro` source, like `board-input-panel-containing-block.test.ts`): has `fixed inset-0`; has `aria-label="Resume timer"`; contains the play path string; does not import `play-solid.svg`; does not contain `text-accent` or `rounded-full`; contains `pausedTips(`.
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/lib/training/routines/routine-play.data.test.ts tests/components/layout/games/countdown-resume-prompt.test.ts`.
- [ ] **Step 3: Add `tipKey()`** and rewrite the component; update the 3 call sites.
- [ ] **Step 4: Run, expect PASS**, plus `npx vitest run tests/lib/timed-surfaces-pause.test.ts` (still green).
- [ ] **Step 5: Check by hand** with the `run` skill or `npm run dev`. On 1 game, 1 routine exercise step and Quick Subtract, at 390×844 and 375×667: pause shows only the card and the button; the button centre equals the viewport centre for a short and a long tip; the tip changes after its time; tap resumes and the title bar and score return. Record the result in the ledger.
- [ ] **Step 6: Commit** — `feat(play): glass paused screen with rotating tips (#1210)`.

### Task 5: Docs and decision

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (CountdownResumePrompt row)
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md` (paused screen and glass play symbol)
- Modify: `decisions/frontend/style.md` (new `D<next>` block from `bash scripts/next-decision-id.sh`: paused screen hides chrome; glass play symbol; tips rotate by length)
- Modify: `docs/architecture/00-File-Inventory.md` (new files from Tasks 1, 2, 4)

- [ ] **Step 1: Write the docs.**
- [ ] **Step 2: Run** `bash scripts/check-decision-ids.sh`, `bash scripts/check-doc-links.sh`, `bash scripts/check-context-map.sh` → all OK.
- [ ] **Step 3: Commit** — `docs(play): paused screen and tips (#1210, D<next>)`.

### Finish

1. Run `run-all-gates` and `validate-app`.
2. Before the PR, ask the owner "Run the design sync before the PR?" (`syncing-design-system` §12). Yes → run §4–8 on this branch. No → list the noted artifact ids in the PR body.
3. File the follow-up issue for statistics-based tips.
4. Push and open the PR with base `docs/plan-design-reference` (PR #1225). The owner merges.
