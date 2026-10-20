# #916 PR C — Engine Refusal Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One owner for the `Cannot record a dart once the <noun>; undo first to correct it.` refusal across 18 engine modules, messages byte-identical.

**Architecture:** `modules/game/turn-log.module.ts` gains `endedRefusal(noun)` (the message) and `refuseWhenEnded(ended, noun)` (the throw). The 12 inline `throw` sites call `refuseWhenEnded`; the 9 module constants that feed `DartGameSpec.refusal` / `TrackRules.doneMessage` are built from `endedRefusal`. Every engine test file tightens one existing refusal assertion to the exact message — that pins byte-identity and satisfies the coverage gate.

**Tech Stack:** TypeScript, Vitest (`app/`).

**Spec:** `docs/superpowers/specs/2026-10-20-916-play-engine-dedupe-design.md` §PR C.

**Branch:** `refactor/916-engine-refusal-guard` (from `origin/main`).

**Spec choice resolved:** the spec names only `refuseWhenEnded(ended, noun): void`, but 9 of the 21 sites are not throws — they are strings returned by `DartGameSpec.refusal(state): string | null` (thrown by `dart-engine-shell.module.ts:66`) and `TrackRules.doneMessage` (thrown by `track-kernel.module.ts:43`). A void throw cannot serve them. So turn-log also exports `endedRefusal(noun): string`, `refuseWhenEnded` is built on it, and those constants stay as named values (each is used twice) but are defined as `endedRefusal("<noun>")`. The template text then lives once. The `visit`/`attempt` refusals (`one-twenty-one`, `five-oh-one`, `score-training:212`, `tuod`) are outside the spec's 21 dart sites and stay untouched.

## Global Constraints

- Message template, verbatim: `Cannot record a dart once the ${noun}; undo first to correct it.`
- Nouns, verbatim: `exercise is complete`, `game has ended`, `match has ended`, `match is complete`, `session has ended`, `session is complete`.
- Every message stays byte-identical; no snapshot (`__snapshots__/*.snap`) may change. `npx vitest run -u` is forbidden.
- No `//` comments inside function bodies in `app/src`. JSDoc states the contract, not history.
- No new exported types (D309 / `check-type-barrels.sh`).
- `check-test-coverage.sh`: each changed `app/src` runtime file needs a changed test file that imports it.
- `astro check --minimumFailingSeverity hint` → 0 errors / 0 warnings / 0 hints.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW
  ```
- `git commit` runs the full pre-commit (>2 min): use a 600000 ms timeout, redirect output to a scratch log, read its tail. Never `--no-verify`.
- Discovered work → GitHub issue (`discovered-work` label); never fixed here.

## Review Focus

1. A noun typo at any site (e.g. `session has ended` vs `session is complete`) — a UI or test matching on text silently diverges. Each task pins one exact message per module and runs a mutation probe.
2. Refusal precedence in two-message modules (`singles-training`, `bobs27`, `shanghai`: match-ended before seat-ended) — swapping constants would pass loose `/ended/` matches. Task 4 pins the match message in each.
3. Facts mutated before the refusal throws — the guard must stay the first statement of `record()` / `recordDart()` / `applyMarksDart`. Existing `facts()`-unchanged assertions (tactics, cricket, shell) cover it; the reviewer checks no guard moved below a `deriveState()` side effect.
4. `marks-close.module.ts` gaining an import of `turn-log.module.ts` must not create an import cycle (fallow gate).
5. Snapshot drift: golden snapshots carry these strings; any byte change fails them — the full suite in Task 5 is the check.

---

### Task 1: `endedRefusal` + `refuseWhenEnded` in turn-log

**Files:**
- Modify: `app/src/modules/game/turn-log.module.ts` (append after `undoLastDart`)
- Test: `app/tests/modules/game/turn-log.module.test.ts`

**Interfaces:**
- Consumes: none.
- Produces:
  - `endedRefusal(noun: string): string`
  - `refuseWhenEnded(ended: boolean, noun: string): void` — throws `new Error(endedRefusal(noun))` when `ended`.

- [ ] **Step 1: Write the failing test**

Add `endedRefusal` and `refuseWhenEnded` to the import list (alphabetical: `endedRefusal` after `doubleTargetIntent`; `refuseWhenEnded` after `openVisit`). Append:

```ts
describe("endedRefusal", () => {
  it("fills the noun into the shared refusal template", () => {
    expect(endedRefusal("game has ended")).toBe(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
  });
});

describe("refuseWhenEnded", () => {
  it("throws the exact refusal once ended", () => {
    expect(() => refuseWhenEnded(true, "session is complete")).toThrow(
      new Error(
        "Cannot record a dart once the session is complete; undo first to correct it.",
      ),
    );
  });

  it("returns quietly while not ended", () => {
    expect(() => refuseWhenEnded(false, "session is complete")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/turn-log.module.test.ts`
Expected: FAIL — `endedRefusal is not a function` / `refuseWhenEnded is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `app/src/modules/game/turn-log.module.ts`:

```ts
/**
 * The refusal every engine raises for a dart recorded after it ended;
 * `noun` names what ended ("game has ended", "exercise is complete", …).
 */
export function endedRefusal(noun: string): string {
  return `Cannot record a dart once the ${noun}; undo first to correct it.`;
}

/**
 * Guard for the top of `record()`: refuses the dart while `ended`.
 * @throws `endedRefusal(noun)` when `ended` is true.
 */
export function refuseWhenEnded(ended: boolean, noun: string): void {
  if (ended) throw new Error(endedRefusal(noun));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/turn-log.module.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/turn-log.module.ts app/tests/modules/game/turn-log.module.test.ts
git commit -m "refactor(engines): add refuseWhenEnded refusal guard (#916)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

---

### Task 2: Exercise engines (7 inline throws + shell constant)

**Files:**
- Modify: `app/src/modules/training/exercises/{switching,checkout-sequence,bull-up,random-checkout,score-threshold,bullseye-checkout,double-pattern}.engine.module.ts`, `app/src/modules/training/exercises/dart-exercise-shell.module.ts`
- Test: matching files under `app/tests/modules/training/exercises/`

**Interfaces:**
- Consumes: `refuseWhenEnded(ended: boolean, noun: string): void` from `@modules/game/turn-log.module`.
- Produces: none.

- [ ] **Step 1: Tighten the existing refusal assertions (characterization)**

`M = "Cannot record a dart once the exercise is complete; undo first to correct it."` — written out literally in each file, no shared constant.

| Test file | Line | From | To |
|---|---|---|---|
| `switching.engine.module.test.ts` | 94 | `expect(() => engine.record(dart(19, "SINGLE"))).toThrow();` | `.toThrow(M)` |
| `checkout-sequence.engine.module.test.ts` | 201 | `expect(() => engine.record(MISS)).toThrow();` | `.toThrow(M)` |
| `bull-up.engine.module.test.ts` | 110 | `expect(() => engine.record(BULL)).toThrow();` | `.toThrow(M)` |
| `random-checkout.engine.module.test.ts` | 239 | `expect(() => engine.record(D20)).toThrow();` | `.toThrow(M)` |
| `score-threshold.engine.module.test.ts` | 156 | `expect(() => engine.record(MISS)).toThrow();` | `.toThrow(M)` |
| `bullseye-checkout.engine.module.test.ts` | 186 | `expect(() => engine.record(MISS)).toThrow();` | `.toThrow(M)` |
| `double-pattern.engine.module.test.ts` | 109 | `expect(() => engine.record(dart(20, "DOUBLE"))).toThrow();` | `.toThrow(M)` |

Example (switching) after the edit, as prettier formats it:

```ts
    expect(() => engine.record(dart(19, "SINGLE"))).toThrow(
      "Cannot record a dart once the exercise is complete; undo first to correct it.",
    );
```

`dart-exercise-shell.module.test.ts` already pins `M` at line 45. Append to the `"undo after expiry un-expires without popping a dart"` test (line 51), after `expect(e.facts().turns[0].darts).toHaveLength(1);`, the re-open check that pins the guard's no-throw path:

```ts
    expect(() => e.record(T20)).not.toThrow();
```

- [ ] **Step 2: Run tests — characterization passes**

Run: `cd app && npx vitest run tests/modules/training/exercises`
Expected: PASS (messages already match).

- [ ] **Step 3: Mutation probe**

Change `exercise is complete` → `exercise is done` in `switching.engine.module.ts:160` and `dart-exercise-shell.module.ts:18`; re-run Step 2.
Expected: FAIL in `switching.engine.module.test.ts` and `dart-exercise-shell.module.test.ts`. Restore: `git checkout -- app/src/modules/training/exercises`.

- [ ] **Step 4: Swap in the guard**

In each of the 7 engines, replace

```ts
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
```

with

```ts
    refuseWhenEnded(this.complete, "exercise is complete");
```

For `checkout-sequence` and `random-checkout` the condition is `before.status === "COMPLETE"`:

```ts
    refuseWhenEnded(before.status === "COMPLETE", "exercise is complete");
```

Add `refuseWhenEnded` to each file's existing `@modules/game/turn-log.module` import (keep alphabetical order).

In `dart-exercise-shell.module.ts`: delete the `EXPIRED_REFUSAL` constant (lines 17–18), replace line 50 with `refuseWhenEnded(this.expired, "exercise is complete");`, add `refuseWhenEnded` to its turn-log import.

- [ ] **Step 5: Run tests + type check**

Run: `cd app && npx vitest run tests/modules/training/exercises && npx tsc --noEmit -p .`
Expected: PASS; tsc 0 errors. `grep -rn "Cannot record a dart" app/src/modules/training` → no output.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/training/exercises app/tests/modules/training/exercises
git commit -m "refactor(exercises): route ended refusals through refuseWhenEnded (#916)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

---

### Task 3: Game inline throws (score-training, tactics, cricket, marks-close)

**Files:**
- Modify: `app/src/modules/game/{score-training,tactics,cricket}.engine.module.ts`, `app/src/modules/game/marks-close.module.ts`
- Test: `app/tests/modules/game/{score-training,tactics,cricket}.engine.module.test.ts`, `app/tests/modules/game/marks-close.module.test.ts`

**Interfaces:**
- Consumes: `refuseWhenEnded` from `./turn-log.module`.
- Produces: none.

- [ ] **Step 1: Tighten assertions (characterization)**

| Test file | Line | From | To |
|---|---|---|---|
| `score-training.engine.module.test.ts` | 867 | `expect(() => engine.record(trebleTwenty)).toThrow();` | `.toThrow("Cannot record a dart once the match is complete; undo first to correct it.")` |
| `tactics.engine.module.test.ts` | 334 | `expect(() => engine.record(MISS)).toThrow();` | `.toThrow("Cannot record a dart once the game has ended; undo first to correct it.")` |
| `cricket.engine.module.test.ts` | 202 | `expect(() => engine.record(MISS)).toThrow();` | `.toThrow("Cannot record a dart once the game has ended; undo first to correct it.")` |
| `marks-close.module.test.ts` | 85 | `.toThrow(/undo first/)` | `.toThrow("Cannot record a dart once the game has ended; undo first to correct it.")` |

- [ ] **Step 2: Run tests — characterization passes**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts tests/modules/game/tactics.engine.module.test.ts tests/modules/game/cricket.engine.module.test.ts tests/modules/game/marks-close.module.test.ts`
Expected: PASS.

- [ ] **Step 3: Mutation probe**

Change the noun at `score-training.engine.module.ts:245` (`match is complete` → `match is done`) and `cricket.engine.module.ts:162` (`game has ended` → `game is over`); re-run Step 2.
Expected: FAIL in score-training and cricket tests. Restore: `git checkout -- app/src/modules/game`.

- [ ] **Step 4: Swap in the guard**

- `score-training.engine.module.ts` `recordDart`: `refuseWhenEnded(this.isMatchDecided(), "match is complete");` (leave the `visit` refusal at line 212 alone).
- `tactics.engine.module.ts` / `cricket.engine.module.ts` `record`: `refuseWhenEnded(activeSeatState(before).status !== "IN_PROGRESS", "game has ended");`
- `marks-close.module.ts` `applyMarksDart`: `refuseWhenEnded(state.status !== "IN_PROGRESS", "game has ended");` and add `import { refuseWhenEnded } from "./turn-log.module";` beside its existing imports.
- Add `refuseWhenEnded` to the existing `./turn-log.module` import in the three engines (alphabetical).

- [ ] **Step 5: Run tests + type check**

Run: same as Step 2, then `cd app && npx tsc --noEmit -p .`
Expected: PASS; tsc 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor(engines): route marks and score-training refusals through refuseWhenEnded (#916)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

---

### Task 4: Track/shell constants (doubles, singles, baseball, bobs27, around-the-clock, shanghai)

**Files:**
- Modify: `app/src/modules/game/{doubles-training,singles-training,baseball,bobs27,around-the-clock,shanghai}.engine.module.ts`
- Test: matching `app/tests/modules/game/*.engine.module.test.ts`

**Interfaces:**
- Consumes: `endedRefusal(noun: string): string` from `./turn-log.module`.
- Produces: none.

- [ ] **Step 1: Tighten assertions (characterization)**

| Test file | Line | Change to exact message |
|---|---|---|
| `doubles-training.engine.module.test.ts` | 781 | `.toThrow()` → `session is complete` |
| `singles-training.engine.module.test.ts` | 1212 (TIE) | `.toThrow()` → `match has ended` |
| `singles-training.engine.module.test.ts` | 365 (direct apply on a `COMPLETE` seat) | `.toThrow()` → `session is complete` |
| `baseball.engine.module.test.ts` | 120 | `/ended/` → `game has ended` |
| `bobs27.engine.module.test.ts` | 895 (match `COMPLETE`) | `/ended/` → `match has ended` |
| `around-the-clock.engine.module.test.ts` | 616 | `/ended/` → `session has ended` |
| `shanghai.engine.module.test.ts` | 467 (`applyShanghaiDart` on terminal seat) | `.toThrow()` → `session has ended` |

Each target is the full string `"Cannot record a dart once the <noun>; undo first to correct it."`, e.g.:

```ts
    expect(() => engine.record(T(9))).toThrow(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
```

- [ ] **Step 2: Run tests — characterization passes**

Run: `cd app && npx vitest run tests/modules/game/{doubles-training,singles-training,baseball,bobs27,around-the-clock,shanghai}.engine.module.test.ts`
Expected: PASS. If a row fails because the context reaches the module's other message, the line was misread: pin the message it actually throws only if that matches the engine's documented precedence (match before seat), and ledger a ruling.

- [ ] **Step 3: Mutation probe**

Swap the two constant values in `bobs27.engine.module.ts` (MATCH_ENDED ↔ GAME_ENDED text); re-run Step 2.
Expected: FAIL in `bobs27.engine.module.test.ts`. Restore: `git checkout -- app/src/modules/game`.

- [ ] **Step 4: Build the constants from `endedRefusal`**

Replace each two-line string constant with a one-line call; names and use sites unchanged:

| File | Constant | New definition |
|---|---|---|
| `doubles-training` | `COMPLETE_REFUSAL` | `endedRefusal("session is complete")` |
| `singles-training` | `MATCH_ENDED` | `endedRefusal("match has ended")` |
| `singles-training` | `SESSION_DONE` | `endedRefusal("session is complete")` |
| `baseball` | `GAME_ENDED` | `endedRefusal("game has ended")` |
| `bobs27` | `MATCH_ENDED` | `endedRefusal("match has ended")` |
| `bobs27` | `GAME_ENDED` | `endedRefusal("game has ended")` |
| `around-the-clock` | `SESSION_ENDED` | `endedRefusal("session has ended")` |
| `shanghai` | `SESSION_ENDED` | `endedRefusal("session has ended")` |
| `shanghai` | `MATCH_ENDED` | `endedRefusal("match has ended")` |

e.g. `const GAME_ENDED = endedRefusal("game has ended");`

Imports: add `endedRefusal` to the existing `./turn-log.module` import in `doubles-training`, `bobs27`, `around-the-clock` (alphabetical); add `import { endedRefusal } from "./turn-log.module";` to `singles-training`, `baseball`, `shanghai`.

- [ ] **Step 5: Run tests + type check**

Run: same as Step 2, then `cd app && npx tsc --noEmit -p .`
Expected: PASS; tsc 0 errors. `grep -rn "Cannot record a dart" app/src` → only `turn-log.module.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor(engines): build ended-refusal constants from endedRefusal (#916)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

---

### Task 5: Gates, discovered work, docs, push + PR

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md` (turn-log row)

- [ ] **Step 1: Full suite + gates**

Run: `cd app && npx vitest run > $SCRATCH/suite.log 2>&1; tail -5 $SCRATCH/suite.log`
Expected: all pass; no snapshot written or obsolete.

Run: `cd app && npx astro check --minimumFailingSeverity hint`, `cd .. && bash scripts/fallow-gate.sh`, `cd app && npm run format:check`
Expected: 0/0/0; pass; clean.

Run the `run-all-gates` skill; every script passes.

- [ ] **Step 2: Dupes check**

Run: `cd app && npx fallow dupes --mode mild --format json > $SCRATCH/dupes.json` and inspect with python for any `clone_groups[].instances[].file` group whose lines span a `refuseWhenEnded`/refusal block.
Expected: no group made only of refusal `throw` blocks remains.

- [ ] **Step 3: Discovered-work issue**

Per `capturing-discovered-work`, `search_issues` first, then file: "cricket/tactics `record()` blocks duplicate 34 lines (cricket.engine.module.ts:159-192 / tactics.engine.module.ts:187-220) — belongs with the marks-close kernel", label `discovered-work`, body citing spec §PR C "Not extracted" and #916.

- [ ] **Step 4: File Inventory**

In the `app/src/modules/game/turn-log.module.ts` row, inside the **description cell** (before `| canonical |`, not after it), after `` `undoStagedTurn`) `` insert: `, and the ended-dart refusal (`endedRefusal`/`refuseWhenEnded`, 2026-10-20)`. Then run `context-maintenance`; no decision block (spec). Commit:

```bash
git add docs/architecture/00-File-Inventory.md
git commit -m "docs(inventory): register refuseWhenEnded on turn-log (#916)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

- [ ] **Step 5: Push + PR**

`git push -u origin refactor/916-engine-refusal-guard`; open the PR via GitHub MCP using `.github/pull_request_template.md` sections (Summary, Changes, Architectural decisions, Verification, Architecture checklist, Notes), linking the spec and #916; subscribe to PR activity and arm a 50-minute `send_later` check-in.
