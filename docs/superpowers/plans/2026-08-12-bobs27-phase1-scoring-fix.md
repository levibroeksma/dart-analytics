# Bob's 27 Phase 1 — Scoring Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Bob's 27's running-score formula so a double hit adds its **board value** (2× the number, e.g. D16 → +32) instead of its **face value** (D16 → +16), and bring every downstream artifact — tests, the non-canonical ruleset doc, the decision ledger — into agreement with the corrected rule.

**Architecture:** One-line fix in `pointValueOf` (`bobs27.engine.module.ts`), reusing the already-imported `boardScore()` helper instead of hand-rolling a `× 2`. `darts.score` (the persisted per-dart fact) already used `boardScore()` and was already correct per D142 — only the derived, never-persisted running total (`Bobs27State.score`) was wrong. No config schema change, no persistence change, no validator change.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- TDD: red → green, every step in this plan follows write-failing-test → verify fail → implement → verify pass.
- Minimal diffs — do not restructure `bobs27.engine.module.ts` beyond the one function.
- `app/src/**/*.ts` function/method bodies carry no `//`/`/* */` comments (JSDoc above the declaration only) — `pointValueOf` already has none; don't add any.
- Decisions are append-only: never edit an existing block in `decisions/**`; this phase appends one new block, citing no `Supersedes:` (see Task 4 — no prior ledger decision stated the wrong formula, so there is nothing to supersede).
- Work on a dedicated branch off the latest `main` (e.g. `bobs27-phase-1-scoring-fix`), not on whatever branch planning happened on. Never commit directly to `main`.
- Before considering this phase done: run the `run-all-gates` skill and the `context-maintenance` skill (root `CLAUDE.md`'s mandatory protocol) — not part of this plan's own tasks, run them after Task 5.

---

### Task 1: Fix `pointValueOf` and re-derive every affected test assertion

**Files:**
- Modify: `app/src/modules/game/bobs27.engine.module.ts:43-45`
- Modify: `app/tests/modules/game/bobs27.engine.module.test.ts` (score-delta assertions listed below)

**Interfaces:**
- Consumes: `boardScore(targetNumber, zone)` from `app/src/modules/game/board-progression.module.ts` (already imported in `bobs27.engine.module.ts`) — `boardScore(n, "DOUBLE")` returns `n * 2`.
- Produces: no signature change. `pointValueOf(target: BoardTarget, config: Bobs27Snapshot): number` keeps its exact name, parameters and return type — every caller (`applyBobs27Dart`) is unaffected.

- [ ] **Step 1: Update the failing (currently-passing-on-the-wrong-value) test assertions first**

Open `app/tests/modules/game/bobs27.engine.module.test.ts` and make these exact replacements (context included so each is unambiguous):

In `describe("Bobs27Engine — fact log and derived score (Task 6 acceptance)")`:

```ts
  it("derives the running score from the fact log", () => {
    const engine = bobs27EngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    expect(engine.state().score).toBe(29);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].darts).toHaveLength(3);
    expect(engine.facts().turns[0].totalScore).toBe(2);
  });
```

(only the `29` changed, from `28`; `totalScore` stays `2` — that field was always the real board score.)

```ts
  it("never writes a negative turn total for a full-miss visit", () => {
    const engine = bobs27EngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    expect(engine.state().score).toBe(25);
    expect(engine.facts().turns[0].totalScore).toBe(0);
  });
```

(`25`, was `26`.)

```ts
  it("rehydrates the derived score and target from persisted facts", () => {
    const first = bobs27EngineFactory.create(config);
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    const resumed = bobs27EngineFactory.create(config, first.facts());
    expect(resumed.state().score).toBe(33);
    expect(resumed.state().targetIndex).toBe(1);
  });
```

(`33`, was `30`.)

In `describe("applyBobs27Dart — hit scoring")`:

```ts
  it("adds the target's value immediately on a single hit and keeps the same target", () => {
    const state = initialBobs27State(config);
    const next = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(next.score).toBe(29);
    expect(next.targetIndex).toBe(0);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("adds each hit as it happens across a 3-hit visit, then advances the target", () => {
    let state = initialBobs27State(config);
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(state.score).toBe(29);
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(state.score).toBe(31);
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(state.score).toBe(33);
    expect(state.targetIndex).toBe(1);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("does not penalize a visit with at least one hit", () => {
    let state = initialBobs27State(config);
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(state.score).toBe(31);
    expect(state.targetIndex).toBe(1);
  });
```

In `describe("applyBobs27Dart — full-miss penalty")`:

```ts
  it("does not change the score until the 3rd dart resolves a full-miss visit", () => {
    let state = initialBobs27State(config);
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(27);
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(27);
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(25);
    expect(state.targetIndex).toBe(1);
  });

  it("drives the score to exactly 0 and ends the game as LOST", () => {
    let state = initialBobs27State({ ...config, startScore: 2 });
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(0);
    expect(state.status).toBe("LOST");
  });
```

(`startScore: 2` — was `1`. D1's board value is 2, so a full-miss penalty of 2 needs a starting score of 2 to land exactly on 0; the old face-value penalty of 1 needed a starting score of 1. This is the one test whose *setup*, not just its expected value, must change.)

In `describe("applyBobs27Dart — path completion and win/loss")`:

```ts
  it("wins after a full-hit run through the entire path", () => {
    let state = initialBobs27State(config);
    for (let visit = 0; visit < 21; visit++) {
      state = applyBobs27Dart(config, state, hitObservationFor(state));
      state = applyBobs27Dart(config, state, hitObservationFor(state));
      state = applyBobs27Dart(config, state, hitObservationFor(state));
    }
    expect(state.status).toBe("WON");
    expect(state.score).toBe(1437);
  });
```

(`1437`, was `807`. Derivation: `27 + 3 × 2 × (1+2+…+20) + 3 × 50 = 27 + 1260 + 150 = 1437`.)

The other two tests in this block (`loses when a full-miss on the bull visit drops the score to 0 or below…` and `wins when a full-miss on the bull visit leaves the score positive…`) are **unchanged** — they start from a hardcoded `bullState` and the bull's value (`config.bullHitValue = 50`) was already board-value, so their arithmetic doesn't move.

In `describe("Bobs27Engine")`:

```ts
  it("delegates record to the reducer and exposes updated state via state()", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    expect(engine.state().score).toBe(29);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    expect(engine.state().score).toBe(33);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 2,
    });
  });
```

```ts
  it("wins after a full-hit run through the entire path", () => {
    const engine = new Bobs27Engine(config);
    for (let visit = 0; visit < 21; visit++) {
      engine.record(hitObservationFor(engine.state()));
      engine.record(hitObservationFor(engine.state()));
      engine.record(hitObservationFor(engine.state()));
    }
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("WON");
    expect(engine.state().score).toBe(1437);
  });
```

In `describe("Bobs27Engine.undo")`:

```ts
  it("does not push a phantom dart when record is rejected on a finished game", () => {
    const engine = new Bobs27Engine(config);
    for (let visit = 0; visit < 21; visit++) {
      engine.record(hitObservationFor(engine.state()));
      engine.record(hitObservationFor(engine.state()));
      engine.record(hitObservationFor(engine.state()));
    }
    expect(engine.state().status).toBe("WON");
    expect(engine.state().score).toBe(1437);

    expect(() => engine.record(hitObservationFor(engine.state()))).toThrow();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().score).toBe(1387);
    expect(engine.undo()).toBe(true);
    expect(engine.state().score).toBe(1337);
  });
```

(`1437`/`1387`/`1337` — each step undoes one bull hit worth 50, same as before, just off the new base.)

```ts
  it("reverts the 3rd dart of a full-miss visit, restoring the penalty and the target", () => {
    const engine = new Bobs27Engine(config);
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    expect(engine.state().score).toBe(25);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 2,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.state().score).toBe(27);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    expect(engine.isComplete()).toBe(false);

    const afterRestoredDart = engine.record(missObservationFor(engine.state()));
    expect(afterRestoredDart.dartsThisVisit).toEqual([]);
    expect(engine.state().score).toBe(25);
  });
```

```ts
  it("reverts a game-ending dart, allowing play to continue afterward", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 1 });
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    expect(engine.isComplete()).toBe(true);

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().score).toBe(1);

    engine.record(hitObservationFor(engine.state()));
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().score).toBe(3);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 2,
    });
  });
```

(`3`, was `2` — the restored D1 hit now adds 2, off a base of 1.)

```ts
  it("walks back across multiple visits with repeated undos", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    expect(engine.state().score).toBe(37);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 2,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state().score).toBe(27);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    expect(engine.undo()).toBe(false);
  });
```

(`37` = `27 + 2+2+2` (three D1 hits) `+ 4` (one D2 hit, board value `2*2`). Was `32`.)

```ts
  it("rehydrates from persisted facts and continues to undo across the boundary", () => {
    const first = bobs27EngineFactory.create(config);
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    const resumed = bobs27EngineFactory.create(config, first.facts());
    resumed.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    expect(resumed.state().score).toBe(33);

    expect(resumed.undo()).toBe(true);
    expect(resumed.facts().turns[0].darts).toHaveLength(2);
    expect(resumed.state().score).toBe(31);
  });
```

(`33`/`31`, was `30`/`29`.)

Every other assertion in the file (facts-shape tests, `wouldComplete` boolean checks, `undo` exact-inverse `toEqual(before)` snapshots) has no hardcoded score number and needs no edit — leave them exactly as they are.

- [ ] **Step 2: Run the suite and confirm it now fails only on the score numbers**

```bash
cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts
```

Expected: FAIL — every test edited in Step 1 fails with the new expected value vs. the old (still face-value) actual, e.g. `expected 29, received 28`. No test should fail for any other reason (a different failure means Step 1 mis-transcribed something — stop and fix before continuing).

- [ ] **Step 3: Fix `pointValueOf`**

In `app/src/modules/game/bobs27.engine.module.ts`, replace:

```ts
function pointValueOf(target: BoardTarget, config: Bobs27Snapshot): number {
  return target.kind === "BULL" ? config.bullHitValue : target.number;
}
```

with:

```ts
function pointValueOf(target: BoardTarget, config: Bobs27Snapshot): number {
  return target.kind === "BULL"
    ? config.bullHitValue
    : boardScore(target.number, "DOUBLE");
}
```

- [ ] **Step 4: Run the suite and confirm it's green**

```bash
cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts
```

Expected: PASS — all tests green.

- [ ] **Step 5: Run the full suite to catch any other consumer**

```bash
cd app && npm test
```

Expected: PASS. (`bobs27.validator.test.ts` and `capability-validator-parity.test.ts`/`capabilities.test.ts` don't assert on the point-value formula — only on `dart.score >= 0` and mode-pair acceptance — so nothing outside the two files touched above should move. If something else fails, it's an undiscovered consumer of the old formula; investigate before proceeding rather than editing it to match blindly.)

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game/bobs27.engine.module.ts app/tests/modules/game/bobs27.engine.module.test.ts
git commit -m "fix(bobs27): running score uses the double's board value, not its face value"
```

---

### Task 2: Correct the non-canonical ruleset doc

**Files:**
- Modify: `docs/game-rules/rulesets/bobs-27.md`

**Interfaces:** none (prose only).

- [ ] **Step 1: Rewrite the Scoring section's two prose sentences**

Find:

```markdown
- Each **hit** on the double adds **that double’s face value** to the running score (e.g. D1 = +1 per hit, D20 = +20 per hit). Multiple hits in one visit each add that same face value — two hits at D20 add 40, three add 60. There is no bonus and no doubling for a multi-hit visit.
- If **all three darts miss**, subtract **one times** the double’s value once (e.g. three misses at D1 → −1).
```

Replace with:

```markdown
- Each **hit** on the double adds **that double’s board value** (2× its number) to the running score (e.g. D1 = +2 per hit, D20 = +40 per hit). Multiple hits in one visit each add that same board value — two hits at D20 add 80, three add 120. There is no further bonus for a multi-hit visit.
- If **all three darts miss**, subtract **one times** the double’s board value once (e.g. three misses at D1 → −2).
```

- [ ] **Step 2: Rewrite the two worked examples**

Find:

```markdown
Examples from the original notes:

```
Start 27, target D1
MISS, D1, MISS  →  27 + 1 = 28  (one hit)

Start 27, target D1
MISS, MISS, MISS  →  27 − 1 = 26
```

_(Original write-up used 29/25 with a slightly different example arithmetic; the rule is: sum hit values, or subtract 1× face value on a full-miss visit.)_
```

Replace with:

```markdown
Examples:

```
Start 27, target D1
MISS, D1, MISS  →  27 + 2 = 29  (one hit)

Start 27, target D1
MISS, MISS, MISS  →  27 − 2 = 25
```

_(Rule: sum hit board values, or subtract 1× board value on a full-miss visit.)_
```

- [ ] **Step 3: Update the "Open questions" section**

Find:

```markdown
## Open questions

- None. Multi-hit math and bull scoring resolved 2026-07-26 (see Scoring and Progress).
```

Replace with:

```markdown
## Open questions

- None. Multi-hit math and bull scoring resolved 2026-07-26 (see Scoring and Progress); the
  per-hit value formula corrected from face value to board value 2026-08-12 (D207,
  `decisions/game-engine.md`).
```

- [ ] **Step 4: Commit**

```bash
git add docs/game-rules/rulesets/bobs-27.md
git commit -m "docs(bobs27): correct ruleset doc's scoring examples to board value"
```

---

### Task 3: Append the decision-ledger entry

**Files:**
- Modify: `decisions/game-engine.md` (append only, after the existing last block)

**Interfaces:** none.

- [ ] **Step 1: Derive the next id**

```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Expected output: `206`. This plan was written assuming that answer — if your run returns something else, use `D<that + 1>` everywhere below instead of `D207`.

- [ ] **Step 2: Append the new block**

Add to the end of `decisions/game-engine.md` (after D203's block, preserving the blank line before it):

```markdown

### D207 — Bob's 27's per-hit value is the double's board value, not its face value
Status: Accepted · Date: 2026-08-12
Decision: `pointValueOf` in `bobs27.engine.module.ts` returns the target's **board value** — `boardScore(target.number, "DOUBLE")` (2× its number) for D1–D20, unchanged `config.bullHitValue` (50, already board-value) for the bull. A hit on D16 adds 32 to the running score, not 16; a full-miss visit at D18 subtracts `missPenaltyMultiplier × 36`, not 18.
Reason: The engine shipped adding face value (`target.number`), matching only the non-canonical `docs/game-rules/rulesets/bobs-27.md`'s own worked examples — no `decisions/**` block ever recorded that formula as a considered decision. The owner clarified during the Phase 1 planning session (`docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md`) that standard Bob's 27 scores the double's actual board value, matching how `darts.score` (D142) already recorded each dart.
Consequences: `bobs27.engine.module.test.ts`'s score-delta assertions and the ruleset doc's worked examples were rewritten to match (same PR). `darts.score`/`turns.total_score` were already correct under D142 and are unaffected — this decision only changes `Bobs27State.score`, a derived, never-persisted value. No config schema change.
```

- [ ] **Step 3: Verify the ledger guard passes**

```bash
bash scripts/check-decision-ids.sh
```

Expected: PASS (exit 0).

- [ ] **Step 4: Commit**

```bash
git add decisions/game-engine.md
git commit -m "docs(decisions): D207 — Bob's 27 per-hit value is board value, not face value"
```

---

### Task 4: Context maintenance

**Files:** whatever `docs/architecture/00-Context-Map.md` and its `AGENT.md` mirror require — determined by running the skill, not hardcoded here.

- [ ] **Step 1: Run the mandatory context-maintenance skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`'s mandatory-every-task rule. It will register `decisions/game-engine.md`'s new D207 entry's decision count and bump `00-Context-Map.md`'s version note; follow its own procedure rather than a fixed step list here.

- [ ] **Step 2: Run the gates**

```bash
bash scripts/check-decision-ids.sh
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
```

Expected: all PASS.

- [ ] **Step 3: Commit any context-maintenance edits**

```bash
git add -A
git commit -m "chore: context maintenance for Bob's 27 Phase 1"
```

(Skip this commit if the skill made no file changes.)

---

### Task 5: Final verification and branch state

- [ ] **Step 1: Full validation**

```bash
cd app && npm run validate:app
```

Expected: PASS (per `validate-app` skill's full procedure).

- [ ] **Step 2: Format check**

```bash
cd app && npm run format && npm run format:check
```

Expected: `format:check` clean. If `format` produced a diff, commit it:

```bash
git add -A
git commit -m "style: format"
```

- [ ] **Step 3: Confirm the branch is ready to open a PR against `main`**

```bash
git log --oneline main..HEAD
git status --short
```

Expected: a clean tree, and a commit log containing (at minimum) Task 1–4's commits. Do not open the PR unless the user asks — per root `CLAUDE.md`, PR creation is explicit-request-only.

Phase 1 is complete once this task's steps all pass. Phase 2 (server-side ANALYTICS + VISUAL_BOARD capability) gets its own plan and its own branch cut from `main` **after** this branch is merged — do not start Phase 2 work on top of this one.
