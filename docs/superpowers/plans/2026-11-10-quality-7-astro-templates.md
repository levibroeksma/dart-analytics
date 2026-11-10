# Quality 7 — Split long Astro templates, byte-identical HTML

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At most 20 Astro templates over 60 lines remain (41 today), the 14 near-identical game play pages share one shell, and the health score gate reads ≥ 95.0.

**Architecture:** All 49 pages prerender and no component has a scoped `<style>`, so `astro build` writes every page's full HTML to `dist/`. A parity script builds before and after and diffs the HTML byte for byte. A template is split by moving a contiguous block of markup into a child `.astro` component that receives what the block read as props; Astro inlines children at build time, so the output is the same bytes.

**Tech Stack:** Astro 7, Tailwind 4, Alpine.js, bash.

**Spec:** `docs/superpowers/specs/2026-11-10-codebase-quality-audit-design.md` § 2, § 4. Needs plans 1, 2, 5 and 6 merged.

## Global Constraints

- `bash scripts/check-html-parity.sh` → `html parity: 49 files identical` after every task. A one-byte difference is a failed task, including whitespace.
- Load the `building-a-component` skill and the "Frontend page / component work" context pack before the first edit. New components follow `05-Astro-Components.md` (Props interface, doc comment, `cn()` for classes) and get a row in `08-Component-Inventory.md`.
- No new prop on an existing component's public interface; no class, attribute or Alpine directive changes.
- A child component is created only for a block ≥ 15 lines; a block used once is still fine (the goal is unit size, and D513's rule of three governs sharing, not splitting).
- Every task: `npm run check` clean; `bash scripts/check-astro-conventions.sh`, `check-astro-class-composition.sh`, `check-style-tokens.sh` → `OK`; `npm test` → at least `11295 passed`; `bash scripts/check-quality-benchmarks.sh --update`.
- `superpowers:writing-plans` pairing (D524): this plan makes no visual choice; before the PR, `finishing-a-dart-branch` asks the design-sync question.
- Finish with `context-maintenance`, `run-all-gates`, `finishing-a-dart-branch`.

## Review Focus

- Whitespace between inline elements: moving a block can add or drop a newline that becomes a text node. The parity diff catches it; fix the source, never normalise the diff.
- A block that uses a frontmatter variable, a slot or `Astro.slots.has()` needs that value passed down; a named `<slot>` cannot move into a child without forwarding.
- `x-data` scope: a child component must not add a wrapper element, or Alpine scope and `x-show` siblings change.
- Hashed asset names in `dist/_astro/` change when a client script changes: this plan touches no `<script>`; if a hash differs, a script was edited by mistake.
- A component rendered zero times by any page is not covered by parity: list such components in the PR body and cover each with one throwaway page under `src/pages/` during the task only, removed before commit.

---

### Task 1: Parity script

**Files:**
- Create: `scripts/check-html-parity.sh`, `scripts/test-check-html-parity.sh`
- Modify: `.gitignore` (`app/.parity/`), `docs/architecture/00-File-Inventory.md`

**Interfaces:**
- `bash scripts/check-html-parity.sh --save` → builds, copies `app/dist/**/*.html` to `app/.parity/base/`, prints `html parity: base saved (49 files)`.
- `bash scripts/check-html-parity.sh` → builds, compares with `cmp`; `html parity: 49 files identical` or one `DIFF <path>` line per file plus the first differing line, exit 1. A file present on one side only is a `DIFF`.
- Build env: `PUBLIC_NEON_AUTH_BASE_URL=https://example.invalid`. `PARITY_DIST=<dir>` and `PARITY_BASE=<dir>` skip the build for fixtures.

- [ ] **Step 1:** Write the fixture test: identical dirs → exit 0; one changed byte → exit 1 with `DIFF`; extra file → exit 1; missing base → exit 1 `no base: run --save`.
- [ ] **Step 2:** Run it; it fails. Write the script; `4 passed, 0 failed`.
- [ ] **Step 3: Verify it detects.** `--save`, add one space inside `<div>` text in `src/components/ui/Tag.astro`, run → exit 1 with `DIFF` lines; `git checkout` the file, run → `49 files identical`.
- [ ] **Step 4:** Commit. Not added to CI: it compares against a base built from another commit.

### Task 2: One shell for the game play pages

**Files:**
- Create: `app/src/components/layout/games/PlayPageShell.astro`
- Modify: the 14 `app/src/pages/games/*/play/index.astro` that share the 24-line body (`501` and `121` share a longer 52-line variant: leave those two for a second shell only if both are identical after the first)

**Interfaces:** `PlayPageShell` props: `setupHref: string`; default slot = the game interface and results modal. It renders the `div.flex.flex-col.flex-1.min-h-0`, `<ReconciliationBlocked />`, `<NoSessionPanel href={setupHref} />`, then the slot.

- [ ] **Step 1:** `bash scripts/check-html-parity.sh --save` on the untouched tree.
- [ ] **Step 2:** Create the shell; convert `ace` only. Parity → identical. Then the other 13.
- [ ] **Step 3: Verify.** Parity identical. `npx --no-install fallow dupes --mode semantic --format json --no-fragments -q 2>/dev/null | jq '[.clone_groups[]|select(.instances|length>=13)]|length'` → `0`.
- [ ] **Step 4:** Benchmark `--update` (`dup_pct_semantic` drops); commit.

### Task 3: `DartBoard.astro` (679 lines, one 272-line block twice)

**Files:**
- Modify: `app/src/components/ui/DartBoard.astro`; Create: child components beside it under `app/src/components/ui/dart-board/`

- [ ] **Step 1:** `diff <(sed -n 61,332p DartBoard.astro) <(sed -n 351,622p DartBoard.astro)`: list what differs between the two copies. Those differences are the child's props.
- [ ] **Step 2:** Extract the block as one child used twice; split the rest until no template in the folder is over 60 lines.
- [ ] **Step 3: Verify.** Parity identical (every board page). `wc -l` on the folder: total is at least 250 lines under the old 679. Commit.

### Tasks 4–6: The remaining templates, largest first

Same steps per file: read, pick block boundaries, extract, parity, gates. One commit per file. Stop each task at its count.

| Task | Templates (lines) | Templates > 60 after |
| ---- | ----------------- | -------------------- |
| 4 | `StarterStep` (298), `SeatedPlayScreen` (197), `ScheduleFormModal` (170), `SplitScoreboardHalf` (149), `OpponentChooserModal` (146), `RoutineBuilder` (145), `pages/training/index` (138) | ≤ 33 |
| 5 | `ExercisePicker` (135), `Chart` (132), `ScoreInput` (131), `ComparisonSummary` (127), `GameLayout` (122), `CheckoutConfirm` (120), `AppModeForm` (119) | ≤ 26 |
| 6 | `pages/games/index` (111), `SinglePlayerSummary` (111), `ScoreAverageCard` (102), `ShanghaiSetupForm` (90), `ExercisePanelShell` (84), `FiveOhOneResults` (70) | ≤ 20 |

Left alone on purpose (primitives whose length is variant tables, not markup): `Button`, `Pagination`, `ExpandingModal`, `RangeSlider`, `Toggle`, `Modal`, `CardWrapper`, `Link`, `Tag` and the other `ui/` entries under 100 lines. They are the reserve if the score lands under 95.

### Task 7: Close out at 95

- [ ] **Step 1: Verify.** `bash scripts/check-quality-benchmarks.sh` → `ok`; `jq '.rows.health_score.now' scripts/quality-benchmarks.json` → `≥ 95.0`. If it is under 95.0, split reserve templates (largest first) until it is; do not touch the config.
- [ ] **Step 2:** In `scripts/quality-benchmarks.json` set `health_score.now` to the measured value and keep `target: 95.0`: from here the ratchet holds the score at or above what was reached.
- [ ] **Step 3:** `npm run dev`; open `/games`, one setup page, one play page and `/training` at phone width; state what you saw in the PR body. Decision (next id): templates split, parity script is the proof for markup-only refactors.
