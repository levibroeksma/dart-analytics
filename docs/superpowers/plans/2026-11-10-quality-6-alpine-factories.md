# Quality 6 — Compose Alpine factories and stores from method groups

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 46 `x-data` factories and stores that are one long function (61–1 118 lines) each become a factory of ≤ 60 lines; `large_functions_src` drops from ≤ 87 to ≤ 41 and the health score reaches ≥ 93.

**Architecture:** A factory today returns one object literal holding state and every method, so fallow counts the whole literal as one function. Methods move, unchanged, into module-level `const` objects in the same file ("method groups"); the factory spreads them next to its state, the way `...playScreenActions()` already works. Measured: a module-level object of methods is not a large function; each method is scored alone.

```ts
const acePlayLabels = {
  subtitle(this: AcePlayContext): string { … },
  targetLabel(this: AcePlayContext): string { … },
};

export function acePlay() {
  return {
    ...playScreenState<AceEngine, AceResultsSnapshot>(),
    ...playScreenActions(),
    ring: "SINGLE" as MarksRing,
    ...acePlayLabels,
  };
}
```

**Tech Stack:** TypeScript, Alpine.js, Vitest (jsdom), fallow 3.42.0.

**Spec:** `docs/superpowers/specs/2026-11-10-codebase-quality-audit-design.md` § 2, § 4. Needs plans 1, 2 and 5 merged.

## Global Constraints

- No behaviour change: same keys on the returned object, same `x-data` names, same method bodies. Only where a method is declared moves.
- State stays in the factory: every field that is an array, object, `Map`, timer handle or anything mutable is created per call. A method group holds functions only.
- Getters and setters stay in the factory literal: object spread would evaluate a getter once.
- Key order of the returned object is kept (state first, then groups in the old method order) so a later key still overrides an earlier one exactly as before.
- Groups stay in the same file and are not exported. A file that passes 500 lines after the move is split by group into `<name>.<group>.ts` siblings only then, with the folder's barrel rules respected (`check-type-barrels.sh`).
- A group has ≤ 60 lines only if it is itself a function; as a `const` it has no limit, but keep one concern per group (labels, navigation, input, persistence, timers).
- Every task: `cd app && npm test` → at least `11295 passed`; `npm run check` clean; `bash scripts/fallow-gate.sh` exit 0; `bash scripts/check-quality-benchmarks.sh --update`.
- `check-test-coverage.sh`: add to each factory's test one case asserting `Object.keys(factory()).sort()` equals the key list captured before the edit (Task 1 adds the helper).
- Finish with `context-maintenance`, `run-all-gates`, `finishing-a-dart-branch`.

## Review Focus

- A method that is an arrow function capturing a factory-local variable cannot move as is: keep it in the factory or pass the value through `this`.
- Two factory instances on one page (two seats, two cards) must not share state: assert a mutation on instance A is not visible on instance B.
- `this` typing: each group method declares `this: <Context>`; no `any`, no cast added.
- Alpine `init()` and `destroy()` must still be own keys of the returned object.
- A store registered with `Alpine.store(name, value)` is one shared object: its state is module-level already; only its methods move.

---

### Task 1: Key-parity helper and pilot (`acePlay`)

**Files:**
- Create: `app/tests/support/factory-shape.ts` — `export function shapeOf(value: object): string[]` (sorted own keys, each suffixed `()` for functions, `get` for accessors)
- Modify: `app/src/lib/game/ace-play.data.ts`; Test: `app/tests/lib/game/ace-play.data.test.ts`
- Modify: `docs/architecture/07-Frontend/03-Alpine-Patterns.md` (new section "Method groups", ≤ 25 lines, with the example above and the three rules: state per call, getters stay, key order kept)

- [ ] **Step 1: Write the failing test.** `expect(shapeOf(acePlay())).toMatchInlineSnapshot()` plus the two-instance isolation case. Run on the unchanged file to fill the snapshot; it passes.
- [ ] **Step 2:** Move `acePlay`'s methods into groups. Run the test: the snapshot is unchanged.
- [ ] **Step 3: Verify.** `npx --no-install fallow health --format json -q 2>/dev/null | jq '[.large_functions[]|select(.path|endswith("ace-play.data.ts"))]|length'` → `0`. Global checks pass.
- [ ] **Step 4:** Add the doc section and a decision (next id): "factories compose module-level method groups". Commit.

### Tasks 2–7: Roll out by family

Each task repeats Task 1 steps 1–3 per file (shape snapshot first, move, verify), then updates the benchmark and commits once per task.

| Task | Files (lines of the factory today) | `large_functions_src` after |
| ---- | ---------------------------------- | --------------------------- |
| 2 | `lib/training/routines/routine-play.data.ts` (1118), `routine-builder.data.ts` (262), `routine-detail.data.ts` (114) | ≤ 83 |
| 3 | `stores/game-stats.store.ts` (1050 + 65), `routine-stats.store.ts` (362), `replay.store.ts` (260), `game.store.ts` (143), `profile.store.ts` (68), `stats.store.ts` (65) | ≤ 76 |
| 4 | `lib/game/` x01 family: `tuod-play` (446), `five-oh-one-play` (424), `one-twenty-one-play` (404), `score-training-play` (357), `five-oh-one-setup` (124), `one-twenty-one-setup` (102) | ≤ 70 |
| 5 | `lib/game/` board family: `follow-the-leader-play` (252), `around-the-clock-play` (218), `singles-training-play` (197), `prisoner-play` (197), `killer-play` (138), `shanghai-play` (125), `doubles-training-play` (120), `fives-play` (117), `baseball-play` (112), `bobs27-play` (101), `tactics-play` (70), `mickey-mouse-play` (69), `cricket-play` (63) | ≤ 57 |
| 6 | `lib/game/` shared: `starter-step` (218), `resume-deck` (119), `board-input` (94), `games-index` (75), `duration-setup` (75) | ≤ 52 |
| 7 | `lib/training/schedules/` (`my-schedule` 133, `schedule-editor` 130, `training-week` 79, `schedules-index` 64), `lib/training/trivia/quick-subtract-play` (127), `lib/stats/sections/` (`game-session-list` 132, `score-trend` 107, `game-heatmap` 75), `lib/ui/` (`seat-morph` 71, `slide-to-start` 68, `paused-tips` 61) | ≤ 41 |

Per-task extra checks:
- Task 2: `routinePlay` has ≈ 150 methods. Expect 8–12 groups; if the file passes 500 lines it already does (1 359) — split groups into `routine-play.<group>.ts` siblings in this task.
- Task 3: stores keep one module-level state object; assert `Alpine.store` receives the same key set (`shapeOf`).
- Tasks 4–5: `bash scripts/check-game-engines.sh && bash scripts/check-game-wiring.sh` → `OK`.

### Task 8: Close out

- [ ] **Step 1: Verify.** `bash scripts/check-quality-benchmarks.sh` → `ok`; `jq '.rows|[.large_functions_src.now,.health_score.now,.mi_lowest_file.now]' scripts/quality-benchmarks.json` → `[≤41, ≥93.0, ≥80.0]`. If `mi_lowest_file` is under 80, name the file in the PR body; do not restructure for it here.
- [ ] **Step 2:** `PUBLIC_NEON_AUTH_BASE_URL=https://example.invalid npm run build` → `Complete!`. Start `npm run dev`, play one visit in 501, Ace and one routine step; state what you saw in the PR body.
