# iOS Standalone Top Safe-Area Inset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop iOS standalone-launch content from colliding with the status bar (clock/battery/signal icons) by padding `body` for `env(safe-area-inset-top)`.

**Architecture:** One CSS line on the existing `body` rule in `app/src/styles/global.css`. Tailwind's `border-box` preflight means the padding shrinks body's content box inside the already-present `h-dvh`/`overflow-hidden` bound; the `position: fixed; inset: 0` ambient backdrop (`body::before`/`::after`) is unaffected and keeps bleeding edge-to-edge under the translucent status bar.

**Tech Stack:** Astro, Tailwind CSS v4 (`@apply`, `@layer base`), no JS/Alpine involved.

## Global Constraints

- Top inset only — no bottom safe-area change (spec scope, not reported broken).
- Single edit point: `body` rule in `global.css` — no per-layout duplication (`AppLayout.astro`/`GameLayout.astro` stay untouched).
- CSS-only change: no automated test exists or is added for it (matches D101 precedent — `.astro` variant logic is likewise untested; no visual-regression harness in this repo).
- Manual iOS-device verification is required before merge and is explicitly out of reach in this environment (per spec's Verification Plan #3).
- Context Maintenance (root `CLAUDE.md`) is mandatory before claiming done: Style-Guide note, `DECISIONS.md` D174, Context-Map registration, gate scripts, graph refresh, branch/PR check.

---

### Task 1: Add top safe-area padding to `body`

**Files:**
- Modify: `app/src/styles/global.css:107-109`

**Interfaces:**
- Consumes: none (pure CSS edit).
- Produces: none (leaf change — no later task depends on new symbols).

- [ ] **Step 1: Read the current `body` rule to confirm line numbers haven't drifted**

Run: `sed -n '105,110p' app/src/styles/global.css`
Expected output:
```css
  body {
    @apply relative h-dvh max-h-dvh overflow-hidden bg-surface font-sans text-foreground antialiased;
  }
```

- [ ] **Step 2: Edit the rule**

Change:
```css
  body {
    @apply relative h-dvh max-h-dvh overflow-hidden bg-surface font-sans text-foreground antialiased;
  }
```
To:
```css
  body {
    @apply relative h-dvh max-h-dvh overflow-hidden bg-surface font-sans text-foreground antialiased;
    padding-top: env(safe-area-inset-top);
  }
```

- [ ] **Step 3: Run the app validation sequence**

Run: `cd app && npm run validate:app`
Expected: sequence completes (`db:status` → `db:migrate` → `db:introspect` → `fallow` → `npm test` → `npm run check` → graph refresh) with no new failures. `npm test` and `astro check` catch CSS syntax errors; neither can confirm the visual fix — that's the deferred manual iOS check (Task 2 creates the handoff record for it).

- [ ] **Step 4: Start the dev server and sanity-check no layout regression on desktop**

Run: `cd app && astro dev --background`

Load `http://localhost:4321/` and `http://localhost:4321/games/score-training/play` in a normal desktop browser tab. Expected: identical rendering to before the change — `env(safe-area-inset-top)` resolves to `0` on a device/browser with no notch, so this is a no-op there. Then stop the server: `astro dev stop`.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/styles/global.css
git commit -m "fix: pad body for iOS safe-area-inset-top to stop status-bar overlap"
```

---

### Task 2: Context Maintenance — docs, decision ledger, handoff record, gates

**Files:**
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md:5,10,32`
- Modify: `DECISIONS.md` (append after the D173 row)
- Modify: `docs/architecture/00-Context-Map.md:9,117,178-180,210`
- Create: `docs/superpowers/handoffs/2026-07-29-ios-safe-area-verification-checklist.md`

**Interfaces:**
- Consumes: Task 1's committed `global.css` change (referenced by decision text and Style-Guide note).
- Produces: none (terminal task).

- [ ] **Step 1: Update the Style-Guide front-matter date and version**

In `docs/architecture/07-Frontend/07-Style-Guide.md`, change line 5:
```
read-when: any UI/component work — tokens, primitives, typography, motion, accessibility
updated: 2026-07-22
```
to:
```
read-when: any UI/component work — tokens, primitives, typography, motion, accessibility
updated: 2026-07-29
```

Change line 10:
```
> **Version:** 0.2.0
```
to:
```
> **Version:** 0.2.1 (2026-07-29 — top safe-area inset on `body` noted alongside `h-dvh`/`overflow-hidden`, D174)
```

- [ ] **Step 2: Note the safe-area inset in the mobile-first-shell bullet**

Change line 32:
```
- **Mobile-first shell.** Content column capped at `max-w-lg` (`AppLayout`, `GameLayout`, bottom nav). Full viewport height via `h-dvh max-h-dvh overflow-hidden` on `html`/`body`.
```
to:
```
- **Mobile-first shell.** Content column capped at `max-w-lg` (`AppLayout`, `GameLayout`, bottom nav). Full viewport height via `h-dvh max-h-dvh overflow-hidden` on `html`/`body`; `body` also pads `env(safe-area-inset-top)` so content clears the iOS status bar in a standalone-launched web app (D174, 2026-07-29).
```

- [ ] **Step 3: Append the decision ledger entry**

In `DECISIONS.md`, add a new row immediately after the existing D173 row (before the `## Deferred (open, not rejected)` heading):
```
| D174 | 2026-07-29 | `body` in `global.css` pads `padding-top: env(safe-area-inset-top)` alongside its existing `h-dvh max-h-dvh overflow-hidden` | `black-translucent` status bar style + `viewport-fit=cover` (D173) already draw content edge-to-edge; with no safe-area inset anywhere in the codebase, header/title content collided with the iOS status bar's clock/battery/signal icons in a standalone-launched web app |
```

- [ ] **Step 4: Create the manual-verification handoff record**

Create `docs/superpowers/handoffs/2026-07-29-ios-safe-area-verification-checklist.md`:
```markdown
# iOS Safe-Area Top Inset — Pre-Merge Verification Checklist

> **Date:** 2026-07-29
> **Related:** D174, `docs/superpowers/specs/2026-07-29-ios-safe-area-top-inset-design.md`
> **Why this exists:** no iOS device is available in this environment; the fix cannot be visually confirmed by the automated suite (`npm run validate:app` only proves the CSS doesn't break the build).

## Manual checks required before closing the issue

1. Install the app to an iOS Home Screen ("Add to Home Screen") on a real device with a notch/Dynamic Island.
2. Launch the installed (standalone) app and open any screen with a header (e.g. a game's play screen via `GameLayout.astro`).
3. Confirm the header/title no longer renders under the clock/battery/signal icons.
4. Open the same app in a normal Safari tab (not installed) and confirm no regression — `black-translucent` only applies in standalone display mode, so this should be visually identical to before.
```

- [ ] **Step 5: Register the new docs and bump the Context-Map version**

In `docs/architecture/00-Context-Map.md`, change line 9:
```
> **Version:** 1.7.3 (2026-07-29 — D172/D173: same-origin `/api/auth/*` proxy and `api-auth-proxy` route class fix iOS standalone web app auth; PWA manifest/meta tags; prior 1.7.2 D156)
```
to:
```
> **Version:** 1.7.4 (2026-07-29 — D174: `body` pads `env(safe-area-inset-top)` to stop iOS standalone-launch content overlapping the status bar; prior 1.7.3 D172/D173)
```

Change the Style-Guide file-inventory row (line 117):
```
| `07-Frontend/07-Style-Guide.md` | Sky/glass/surface visual contract: tokens, primitives, typography, motion, a11y | canonical | ~2.9k |
```
to:
```
| `07-Frontend/07-Style-Guide.md` | Sky/glass/surface visual contract: tokens, primitives, typography, motion, a11y; top safe-area inset noted alongside `h-dvh` (D174, 2026-07-29) | canonical | ~2.9k |
```

Add two new rows to the "Context & history" table, immediately after the existing `docs/superpowers/handoffs/2026-07-29-ios-auth-pre-merge-checklist.md` row (around line 180):
```
| `docs/superpowers/specs/2026-07-29-ios-safe-area-top-inset-design.md` | iOS standalone web app top safe-area inset fix: `body` pads `env(safe-area-inset-top)` alongside existing `h-dvh`/`overflow-hidden` (D174) (2026-07-29) | historical |
| `docs/superpowers/plans/2026-07-29-ios-safe-area-top-inset.md` | The 2-task plan implementing that spec, incl. the manual iOS verification handoff (2026-07-29) | historical |
| `docs/superpowers/handoffs/2026-07-29-ios-safe-area-verification-checklist.md` | Operator checklist: manual iOS-device verification of the safe-area fix, not doable in-session (2026-07-29) | historical |
```

In the "Current Implementation State" table, "Frontend docs" row (around line 210), append to the existing cell text (do not remove anything already there):
```
; `07`→0.2.1 — top safe-area inset noted alongside `h-dvh` (D174, 2026-07-29)
```

- [ ] **Step 6: Run the gate scripts**

Run:
```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
```
Expected for each, in order:
```
OK: context map, references, migration ranges, and front-matter are consistent.
OK: doc links and path-like references resolve (N files scanned).
OK: context-map per-file and per-pack token budgets within tolerance.
```
(`check-agent-mirrors.sh` and `check-file-locations.sh` print nothing on success and exit `0` — confirm with `echo $?` after each if no output appears.)

If `check-context-budget.sh` fails on the Style-Guide `~2.9k` estimate, recompute and update that one number in the row from Step 5 to match — the gate diffs the stated estimate against an actual chars/4 count, and the two added sentences may push it over tolerance.

- [ ] **Step 7: Run the app validate sequence again (already-modified `global.css` is part of this branch)**

Run: `cd app && npm run validate:app`
Expected: same pass criteria as Task 1 Step 3 — no new failures.

- [ ] **Step 8: Refresh the knowledge graph**

Run: `bash scripts/refresh-graph.sh`
Expected: either an updated `graphify-out/graph.json` or a warning that the `graphify` CLI is absent (record whichever happens in the completion report — do not fail the task on the warning).

- [ ] **Step 9: Stage and commit**

```bash
cd /home/user/dart-analytics
git add docs/architecture/07-Frontend/07-Style-Guide.md DECISIONS.md docs/architecture/00-Context-Map.md docs/superpowers/handoffs/2026-07-29-ios-safe-area-verification-checklist.md
git add graphify-out/graph.json 2>/dev/null || true
git commit -m "docs: register D174 top safe-area inset fix and manual verification handoff"
```

- [ ] **Step 10: Confirm branch state**

Run: `git status && git log --oneline -5`
Expected: working tree clean, branch `claude/ios-webapp-height-overlap-k5ioxp` ahead of `origin` by the commits made in this plan, no open PR yet against `main` — note this in the completion report per Context Maintenance step 7 (branch/PR check).
