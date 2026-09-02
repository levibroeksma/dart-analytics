# Doc-Only Corrections Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close FINDINGS.md F9, F28, F30, F46, F51, F53 with six small, independent, targeted doc/comment edits — no behavior change anywhere.

**Architecture:** Each task edits exactly the file(s) its finding names, per `docs/CLAUDE.md`'s minimal-diff rule. No shared code path between tasks; they can land and be reviewed independently, though this plan sequences them as one branch's task list. Task 5 is the only task touching `app/src/**`, and it is a docstring-only change that still requires touching its covering test file to satisfy `scripts/check-test-coverage.sh` (D224), which has no comment-only exemption.

**Tech Stack:** Markdown docs, one TypeScript JSDoc comment, Vitest (Task 5 only).

## Global Constraints

- Minimal diff: edit only the row/section/line each finding names — no rewrites (`docs/CLAUDE.md`).
- Edit the canonical doc first (`docs/CLAUDE.md` Editing Workflow) — each task's target file below is already the canonical source for its claim.
- Historical docs (`docs/superpowers/**`, `05-Database/07`–`09`) stay historical — none of these six tasks touch a historical file.
- `scripts/check-test-coverage.sh` (D224) requires every changed `app/src/**` runtime file to have a touched covering test file in the same change set, even for comment-only edits — applies to Task 5 only.
- Findings are closed by deleting their block from `FINDINGS.md`, never by marking them "Resolved" (`FINDINGS.md`'s own header rules).
- Context Maintenance (root `CLAUDE.md`) runs once at the end of the branch, not per task — do not run it after each task.

---

## Task 1: F9 — `09-Adding-A-Game.md` doesn't warn about commit atomicity

**Files:**
- Modify: `docs/architecture/07-Frontend/09-Adding-A-Game.md:181-191` (the "## What the gate checks, and what it cannot" section)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

The section today reads:

```markdown
## What the gate checks, and what it cannot

`scripts/check-game-wiring.sh` walks every key in `registry.ts` and checks the
validator file, the capability declaration, and — for a game that renders a
card — both data files, both pages, and both Alpine registrations. For a game
absent from `games-visibility.ts` it checks the opposite: that none of those
exist, so a half-wired game fails whichever half it fell on.

It cannot check that anyone read this page, that a page renders, or that a
setup form binds the right fields. It catches one specific failure that no
test catches, because every game's tests only ever exercise that game: a
shared registry left half-edited.
```

- [ ] **Step 1: Add the commit-atomicity note**

Edit `docs/architecture/07-Frontend/09-Adding-A-Game.md`, replacing the section above with:

```markdown
## What the gate checks, and what it cannot

`scripts/check-game-wiring.sh` walks every key in `registry.ts` and checks the
validator file, the capability declaration, and — for a game that renders a
card — both data files, both pages, and both Alpine registrations. For a game
absent from `games-visibility.ts` it checks the opposite: that none of those
exist, so a half-wired game fails whichever half it fell on.

It cannot check that anyone read this page, that a page renders, or that a
setup form binds the right fields. It catches one specific failure that no
test catches, because every game's tests only ever exercise that game: a
shared registry left half-edited.

**The gate runs pre-commit, on every commit, not just the final one.** The
touch list above cannot be split into sequential per-file commits (setup
controller in one commit, play controller in the next, wiring last) — the
first such commit already fails `check-game-wiring.sh` because the game is
half-wired at that point in history. Land the full touch list in one commit,
or hold every task's changes uncommitted until wiring is complete.
```

- [ ] **Step 2: Verify the doc-link and consistency gates still pass**

Run: `bash scripts/check-doc-links.sh`
Expected: exits 0, no broken references introduced.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/07-Frontend/09-Adding-A-Game.md
git commit -m "docs: warn that a game's touch list can't be split across commits (F9)"
```

---

## Task 2: F28 — File-Inventory row hardcodes `context-maintenance`'s step count

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md:239`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

Current line 239:

```
| `.claude/skills/context-maintenance/SKILL.md` | Context Maintenance 8-step procedure, invoked before claiming any task done (2026-07-28) | canonical |
```

- [ ] **Step 1: Drop the hardcoded step count**

Edit `docs/architecture/00-File-Inventory.md`, replacing line 239 with:

```
| `.claude/skills/context-maintenance/SKILL.md` | Context Maintenance procedure, invoked before claiming any task done (2026-07-28) | canonical |
```

- [ ] **Step 2: Verify the row still parses in the file-inventory checks**

Run: `bash scripts/check-context-map.sh`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/00-File-Inventory.md
git commit -m "docs: drop the stale step count from context-maintenance's inventory row (F28)"
```

---

## Task 3: F30 — File-Inventory row undercounts `decisions/frontend/alpine.md`

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md:210`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

Current line 210:

```
| `decisions/frontend/alpine.md` | 14 decisions — Alpine, stores, state, persist, recovery, x-data, x-show | canonical | ~3.1k |
```

- [ ] **Step 1: Drop the decision count, keep the topic list**

Edit `docs/architecture/00-File-Inventory.md`, replacing line 210 with:

```
| `decisions/frontend/alpine.md` | Alpine, stores, state, persist, recovery, x-data, x-show | canonical | ~3.1k |
```

This matches the topic-list style already used one row below for
`decisions/frontend/style.md` — no count to drift.

- [ ] **Step 2: Verify the row still parses in the file-inventory checks**

Run: `bash scripts/check-context-map.sh`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/00-File-Inventory.md
git commit -m "docs: stop hardcoding alpine.md's decision count in the file inventory (F30)"
```

---

## Task 4: F46 — `.control` documented as having wrapper components that don't exist

**Files:**
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md:74`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

Current line 74 (Primitives table):

```
| `.control` | Checkbox / radio appearance (`Checkbox.astro`, `Radio.astro`) |
```

`Checkbox.astro` and `Radio.astro` do not exist anywhere under
`app/src/components/`. `08-Component-Inventory.md` carries no matching row
today, so only this line needs the edit.

- [ ] **Step 1: Reword the Primitives table row**

Edit `docs/architecture/07-Frontend/07-Style-Guide.md`, replacing line 74 with:

```
| `.control` | Checkbox / radio appearance — apply directly to a raw `<input type="checkbox">`/`<input type="radio">`; no dedicated wrapper component exists yet |
```

- [ ] **Step 2: Confirm no other doc references the nonexistent components**

Run: `grep -rn "Checkbox.astro\|Radio.astro" docs/ app/src/components/`
Expected: no matches (both files and all doc references are gone).

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/07-Frontend/07-Style-Guide.md
git commit -m "docs: stop documenting .control's nonexistent Checkbox/Radio wrappers (F46)"
```

---

## Task 5: F51 — stale cross-reference to a deleted function name

**Files:**
- Modify: `app/src/lib/game/session-mode-resolution.ts:120-121`
- Test: `app/tests/lib/game/session-mode-resolution.test.ts` (annotate the existing `participantsFromSeats` describe block — no new test, no behavior change)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

Current JSDoc on `participantsFromSeats` (`app/src/lib/game/session-mode-resolution.ts:119-122`):

```typescript
/**
 * The `participants` a replay's `createSession` must request, derived from the
 * seats the finished session actually played with — the inverse of
 * `seatsFromParticipants`, and the same shape the setup screen sends when a
 * guest is added at start time.
```

`seatsFromParticipants` was deleted and replaced by a private `toSeatFacts` in
the same file; this cross-reference was left pointing at the old name.

- [ ] **Step 1: Fix the docstring's cross-reference**

Edit `app/src/lib/game/session-mode-resolution.ts`, replacing:

```typescript
 * seats the finished session actually played with — the inverse of
 * `seatsFromParticipants`, and the same shape the setup screen sends when a
 * guest is added at start time.
```

with:

```typescript
 * seats the finished session actually played with — the inverse of
 * `toSeatFacts`, and the same shape the setup screen sends when a
 * guest is added at start time.
```

- [ ] **Step 2: Touch the covering test file to satisfy the D224 gate**

`app/tests/lib/game/session-mode-resolution.test.ts:185` already has a
`describe("participantsFromSeats", ...)` block covering this function's
behavior (solo-seat-list-returns-undefined, 1v1 round-trip, no
`participantRef` leak). No behavior changed, so no new test case is needed —
add a one-line comment directly above the `describe` confirming it still
covers current behavior, which is enough to make this a touched file for
D224's gate:

```typescript
// Covers participantsFromSeats, including its JSDoc's toSeatFacts
// cross-reference (F51) — behavior unchanged.
describe("participantsFromSeats", () => {
```

- [ ] **Step 3: Run the test file to confirm nothing broke**

Run: `cd app && npx vitest run tests/lib/game/session-mode-resolution.test.ts`
Expected: all tests in the file pass (no behavior changed, so this should be a no-op confirmation).

- [ ] **Step 4: Run the test-coverage gate**

Run: `bash scripts/check-test-coverage.sh`
Expected: exits 0 — `session-mode-resolution.ts` and its test file both appear in the same change set.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/session-mode-resolution.ts app/tests/lib/game/session-mode-resolution.test.ts
git commit -m "docs: fix participantsFromSeats' stale seatsFromParticipants cross-reference (F51)"
```

---

## Task 6: F53 — `00-Context-Map-History.md`'s "Current Implementation State" table is stale

**Files:**
- Modify: `docs/architecture/00-Context-Map-History.md:80-82` (directly under the "# Current Implementation State" heading)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

Current heading and table start (`docs/architecture/00-Context-Map-History.md:80-83`):

```markdown
# Current Implementation State

| Area | Status |
| ---- | ------ |
```

The "Game engines" row below it (line 87) still says "All six ... (Score
Training, Bob's 27, Singles Training, Doubles Training, 501, Ten Up One
Down)"; nine engines are registered today and DartBot isn't mentioned at all.
Per the finding's own second option, this task adds a staleness disclaimer
rather than rewriting the table's rows (more engines/DartBot phases are
actively shipping, so any rewrite would itself go stale immediately).

- [ ] **Step 1: Add the staleness note under the heading**

Edit `docs/architecture/00-Context-Map-History.md`, replacing:

```markdown
# Current Implementation State

| Area | Status |
| ---- | ------ |
```

with:

```markdown
# Current Implementation State

> This table is maintained best-effort and can lag; the Version History
> section above is the authoritative current-state source when they
> disagree.

| Area | Status |
| ---- | ------ |
```

No row in the table itself is edited.

- [ ] **Step 2: Verify the doc-link gate still passes**

Run: `bash scripts/check-doc-links.sh`
Expected: exits 0 (this file is `status: historical`, so the path-backtick pass is already skipped for it — confirm the added note introduces no new backtick-path reference that would need it).

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/00-Context-Map-History.md
git commit -m "docs: flag the Current Implementation State table as best-effort/lagging (F53)"
```

---

## Task 7: Close the findings and run context maintenance

**Files:**
- Modify: `FINDINGS.md` (delete the F9, F28, F30, F46, F51, F53 blocks; bump nothing — `highest-issued` only increases when a finding is *added*)

**Interfaces:**
- Consumes: the six commits from Tasks 1–6 (all findings must already be fixed in the working tree).
- Produces: a clean `FINDINGS.md` with no open blocks for these six ids, ready for the `context-maintenance` skill's Findings gate.

- [ ] **Step 1: Delete the six closed finding blocks**

Edit `FINDINGS.md`, removing the full `### F9 — ...` through next `---`/next
`### F` boundary block for each of F9, F28, F30, F46, F51, F53 — the same
delete-on-close mechanic the file's own header describes ("a closed finding
is deleted — the record of the fix is the commit that fixed it").

- [ ] **Step 2: Run the findings-log gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0 — no dangling references to the six deleted ids, evidence paths for all remaining findings still resolve.

- [ ] **Step 3: Commit**

```bash
git add FINDINGS.md
git commit -m "docs: close F9, F28, F30, F46, F51, F53 — doc-only corrections landed"
```

- [ ] **Step 4: Run the `context-maintenance` skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`'s mandatory
per-task requirement before this batch can be claimed done. It handles
version-history/date bookkeeping and the remaining structural gates
(`check-context-map.sh`, `check-doc-links.sh`, `check-context-budget.sh`,
`check-agent-mirrors.sh`, `check-file-locations.sh`, `check-decision-ids.sh`)
across all six tasks' changes at once — do not run it per-task.

---

## Testing

- Tasks 1–4, 6: doc-only edits. Each is verified by the specific gate script
  named in its own Step 2/3, not by a test runner — `scripts/check-test-coverage.sh`
  only gates `app/src/**`/`app/scripts/**` runtime files, which none of these
  five tasks touch.
- Task 5: the only task touching `app/src/**`. Verified by running the
  existing `session-mode-resolution.test.ts` file (confirms no behavior
  regressed) and by `scripts/check-test-coverage.sh` (confirms the D224 gate
  sees a touched covering test alongside the touched source file).
- Task 7: verified by `scripts/check-findings-log.sh`, then by the full gate
  set the `context-maintenance` skill runs.

## Non-goals

- No rewrite of any doc beyond the single row/section each task names.
- No change to `08-DartBot.md` — covered by a separate spec's task.
- No change to `check-game-wiring.sh`, `check-test-coverage.sh`, or any other
  gate script — these tasks satisfy the gates as written, they don't modify
  them.
- No rewrite of `00-Context-Map-History.md`'s table rows (Task 6) — a
  disclaimer only, per the finding's own chosen option.
