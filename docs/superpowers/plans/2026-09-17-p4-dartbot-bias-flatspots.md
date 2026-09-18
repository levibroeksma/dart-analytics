# P4 — DartBot Bias Flat Spots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give levels 7/8, 9/10 and 12/13 their own `biasXMm`/`biasYMm` values instead of three shared pairs carried forward through two refits, and add the assertion that stops them coming back.

**Architecture:** Each duplicated pair is replaced by geometric interpolation between the pair's nearest *distinct* neighbours — the ratio-preserving idea D-N used, applied locally so no level outside the three flat spots moves. Levels 1, 6 and 15 are anchors and do not move. The change is verified by simulation, not by argument.

**Tech Stack:** TypeScript, Vitest (seeded simulation harness).

**Spec:** `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` §6

**Issues closed:** #286

## Global Constraints

- Branch off `main`, named `fix/p4-dartbot-bias-flatspots`. Never commit to `main`. Do not commit unless the user asks.
- **Levels 1, 6 and 15 do not move.** Level 6 is the D-E measured anchor; levels 1 and 15 are D-N's guardrail anchors. `skill-profile.module.test.ts` pins all three, and those assertions must pass unchanged.
- Only `biasXMm` and `biasYMm` change. `sigmaAlongMm`, `sigmaAcrossMm`, `outlierRate`, `decisionQuality` and every other field stay exactly as they are.
- `08-DartBot-Anchor-Log.md` is append-only, same discipline as `decisions/**`. A new row, never an edit.
- Report measured simulation numbers. Never assert a band held without printing it.
- If a band fails, re-derive the values on the curve. **Never widen a band to fit a value.**

---

## Current state (read before editing)

`app/src/modules/dartbot/skill-profile.module.ts`, bias columns only:

| Level | `biasXMm` | `biasYMm` | |
| ----- | --------- | --------- | --- |
| 1 | 7.9 | 10.6 | anchor (D-N) |
| 2 | 5.9 | 8.3 | |
| 3 | 5.6 | 6.7 | |
| 4 | 4.3 | 6.5 | |
| 5 | 4.1 | 5.1 | |
| 6 | **-5.0** | 3.1 | anchor (D-E, measured) |
| 7 | 2.5 | 3.3 | **flat spot** |
| 8 | 2.5 | 3.3 | **flat spot** |
| 9 | 1.2 | 1.7 | **flat spot** |
| 10 | 1.2 | 1.7 | **flat spot** |
| 11 | 0.9 | 0.9 | |
| 12 | 0.4 | 0.7 | **flat spot** |
| 13 | 0.4 | 0.7 | **flat spot** |
| 14 | 0.3 | 0.3 | |
| 15 | 0 | 0.2 | anchor (D-N) |

Level 6's `biasXMm` is negative — measured data, not a fitted point. It is a valid bracket for `biasYMm` (3.1 sits correctly between levels 5 and 7) but **not** for `biasXMm`, where the 7/8 pair brackets against level 5 instead.

---

### Task 1: Compute the replacement values

**Files:**
- Create: `app/scripts/dartbot-bias-flatspot-fix.ts`

**Interfaces:**
- Consumes: `LEVEL_SKILL_TABLE` from `@modules/dartbot/skill-profile.module`.
- Produces: eight printed numbers — `biasXMm`/`biasYMm` for levels 7, 8, 9, 10, 12, 13 — that Task 2 pastes into the table.

- [ ] **Step 1: Cut the branch**

```bash
git checkout main
git pull
git checkout -b fix/p4-dartbot-bias-flatspots
```

- [ ] **Step 2: Write the derivation script**

Create `app/scripts/dartbot-bias-flatspot-fix.ts`. It exists so the numbers in Task 2 are reproducible, not hand-picked:

```ts
import { LEVEL_SKILL_TABLE } from "../src/modules/dartbot/skill-profile.module";

/** Geometric interpolation between two bracket values across `steps`
 * segments, returning the interior points. Ratio-preserving, matching D-N's
 * log-space method, applied locally to one flat spot at a time. */
function interiorPoints(low: number, high: number, steps: number): number[] {
  const ratio = Math.pow(low / high, 1 / steps);
  const points: number[] = [];
  let value = high;
  for (let i = 0; i < steps - 1; i++) {
    value *= ratio;
    points.push(Number(value.toFixed(2)));
  }
  return points;
}

/** Each flat spot, with the nearest DISTINCT neighbours that bracket it.
 * biasX skips level 6: its measured -5.0 is a sign anomaly, not a curve
 * point, so the 7/8 pair brackets against level 5. biasY uses level 6,
 * whose 3.1 sits correctly on the curve. */
const SPOTS = [
  { field: "biasXMm", levels: [7, 8], from: 5, to: 9 },
  { field: "biasXMm", levels: [9, 10], from: 8, to: 11 },
  { field: "biasXMm", levels: [12, 13], from: 11, to: 14 },
  { field: "biasYMm", levels: [7, 8], from: 6, to: 9 },
  { field: "biasYMm", levels: [9, 10], from: 8, to: 11 },
  { field: "biasYMm", levels: [12, 13], from: 11, to: 14 },
] as const;

const resolved: Record<string, Record<number, number>> = {
  biasXMm: {},
  biasYMm: {},
};

for (const spot of SPOTS) {
  const field = spot.field;
  const high =
    resolved[field][spot.from] ?? LEVEL_SKILL_TABLE[spot.from][field];
  const low = resolved[field][spot.to] ?? LEVEL_SKILL_TABLE[spot.to][field];
  const steps = spot.to - spot.from;
  const points = interiorPoints(low, high, steps);
  const offset = spot.levels[0] - spot.from - 1;
  spot.levels.forEach((level, i) => {
    resolved[field][level] = points[offset + i];
  });
}

for (const level of [7, 8, 9, 10, 12, 13]) {
  console.log(
    `${level}: biasXMm ${resolved.biasXMm[level]}, biasYMm ${resolved.biasYMm[level]}`,
  );
}
```

- [ ] **Step 3: Run it and record the output**

```bash
cd app && npx tsx scripts/dartbot-bias-flatspot-fix.ts
```

Expected shape (values to 2dp; the script is the authority — use what it prints, not what is written here):

```
7: biasXMm 2.22, biasYMm 2.54
8: biasXMm 1.63, biasYMm 2.08
9: biasXMm 1.34, biasYMm 1.57
10: biasXMm 1.1, biasYMm 1.19
12: biasXMm 0.62, biasYMm 0.62
13: biasXMm 0.43, biasYMm 0.43
```

- [ ] **Step 4: Sanity-check the output before trusting it**

Every one of these must hold; if any fails, the bracketing in `SPOTS` is wrong, not the check:

- all six levels differ from both of their neighbours in at least one bias field
- `biasXMm` decreases from level 7 through 14 (`2.22 > 1.63 > 1.34 > 1.1 > 0.9 > 0.62 > 0.43 > 0.3`)
- `biasYMm` decreases from level 6 through 15 (`3.1 > 2.54 > 2.08 > 1.57 > 1.19 > 0.9 > 0.62 > 0.43 > 0.3 > 0.2`)
- no value is negative

- [ ] **Step 5: Commit the script**

```bash
git add app/scripts/dartbot-bias-flatspot-fix.ts
git commit -m "chore(dartbot): add the bias flat-spot derivation script (#286)"
```

---

### Task 2: Apply the values and assert they cannot regress

**Files:**
- Modify: `app/src/modules/dartbot/skill-profile.module.ts` (levels 7, 8, 9, 10, 12, 13 — bias fields only)
- Modify: `app/tests/modules/dartbot/skill-profile.module.test.ts`
- Regenerate: `app/tests/modules/dartbot/__snapshots__/throw-engine.determinism.test.ts.snap`

**Interfaces:**
- Consumes: Task 1's printed values.
- Produces: a table with no adjacent duplicate bias pair, guarded by a test.

- [ ] **Step 1: Write the failing assertion first**

Append to `app/tests/modules/dartbot/skill-profile.module.test.ts`, inside the existing `describe("skillProfileForLevel", …)`:

```ts
  it("gives every adjacent level pair a distinct bias pair", () => {
    for (let level = 1; level < 15; level++) {
      const lower = skillProfileForLevel(level);
      const upper = skillProfileForLevel(level + 1);
      expect([upper.biasXMm, upper.biasYMm]).not.toEqual([
        lower.biasXMm,
        lower.biasYMm,
      ]);
    }
  });

  it("shrinks bias magnitude from level 7 to level 15", () => {
    for (let level = 7; level < 15; level++) {
      const weaker = skillProfileForLevel(level);
      const stronger = skillProfileForLevel(level + 1);
      expect(Math.abs(stronger.biasXMm)).toBeLessThan(Math.abs(weaker.biasXMm));
      expect(Math.abs(stronger.biasYMm)).toBeLessThan(Math.abs(weaker.biasYMm));
    }
  });
```

The magnitude check starts at level 7 deliberately: level 6's measured `biasXMm` of `-5.0` is larger in magnitude than level 5's `4.1`, so a 1→15 monotonicity assertion would encode the anomaly as a bug. The distinctness check does run across all 15 levels — that is the property issue #286 is about.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd app && npx vitest run tests/modules/dartbot/skill-profile.module.test.ts -t "distinct bias pair"
```

Expected: FAIL, naming levels 7/8 (the first duplicate pair). A pass here means the table was already edited — check `git status`.

- [ ] **Step 3: Apply the six levels' values**

In `app/src/modules/dartbot/skill-profile.module.ts`, change only `biasXMm` and `biasYMm` on levels 7, 8, 9, 10, 12, 13, to the values Task 1's script printed. Every other field on every level, and levels 1–6, 11, 14, 15 entirely, stay byte-identical.

- [ ] **Step 4: Run the skill-profile tests**

```bash
cd app && npx vitest run tests/modules/dartbot/skill-profile.module.test.ts
```

Expected: PASS, including the pre-existing anchor assertions — level 6's `biasXMm` is still `-5.0`, levels 1 and 15 still hold their exact sigmas, spread and `decisionQuality` are still monotonic.

- [ ] **Step 5: Regenerate the determinism snapshot**

The committed snapshot is taken at **level 8**, one of the six levels that just moved, so it necessarily changes:

```bash
cd app && npx vitest run tests/modules/dartbot/throw-engine.determinism.test.ts -u
git diff app/tests/modules/dartbot/__snapshots__/throw-engine.determinism.test.ts.snap
```

Read the diff. Expected: landing coordinates shift by roughly the bias delta (level 8's `biasXMm` moves 2.5 → ~1.63, `biasYMm` 3.3 → ~2.08); `aim` values and the dart *count* do not change. A diff that changes the number of entries, or the `aim` points, means something other than bias moved — investigate before accepting.

- [ ] **Step 6: Run the whole dartbot suite**

```bash
cd app && npx vitest run tests/modules/dartbot/
```

Expected: all green, including `harness/tier-bands.test.ts`. That file simulates 5000 visits per level at a fixed seed and asserts levels 1, 8 and 15 sit in their bands, plus five monotonicity properties across all 15 levels. Level 8's mid band is `threeDartAverage` 50–78, `checkoutRate` 0.12–0.24, `trebleRate` 0.15–0.25, `missRate` ≤ 0.003.

If a band fails: re-derive the values via Task 1's script with corrected brackets. Do not widen the band, and do not hand-tune a level to slip inside it.

- [ ] **Step 7: Record the measured numbers**

```bash
cd app && npx vitest run tests/modules/dartbot/harness/tier-bands.test.ts --reporter=verbose
```

Copy the reported statistics for levels 1, 8 and 15 into a scratch note — Task 3's anchor-log row and the PR body both quote them.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix(dartbot): give levels 7-13 distinct bias values and guard against re-flattening (#286)"
```

---

### Task 3: Log the change and open the PR

**Files:**
- Modify: `docs/architecture/08-DartBot-Anchor-Log.md` (append a row)
- Modify: `docs/architecture/08-DartBot.md` (version header)
- Modify: `decisions/game-engine.md`

**Interfaces:**
- Consumes: Task 2's measured numbers.
- Produces: the provenance a future refit reads before touching the table.

- [ ] **Step 1: Append the anchor-log row**

`docs/architecture/08-DartBot-Anchor-Log.md` is append-only: add a new row **below** the existing ones, never edit a row. Use the existing column order (Date, Anchor level, Data source, Measured values, Spread exponent, Verified band, Task branch):

```markdown
| 2026-09-17 | none — anchors untouched (1, 6 and 15 unchanged) | No new data. Flat-spot removal only: levels 7/8, 9/10 and 12/13 shared an exact `biasXMm`/`biasYMm` pair inherited from the pre-D-L table, and both D-L's power-law rescale and D-N's log-space interpolation are ratio-preserving, so two refits carried the duplication forward unchanged (issue #286). Each pair was re-derived by geometric interpolation between its nearest distinct neighbours (`app/scripts/dartbot-bias-flatspot-fix.ts`); `biasXMm`'s 7/8 pair brackets against level 5 rather than level 6, whose measured -5.0 is a sign anomaly rather than a curve point. No sigma, outlier or decisionQuality value changed. | unchanged | level 1 / 8 / 15 bands re-verified at `tier-bands.test.ts`'s own seed: <measured values> | `fix/p4-dartbot-bias-flatspots` |
```

Replace `<measured values>` with Task 2 Step 7's numbers.

- [ ] **Step 2: Update the DartBot doc header**

In `docs/architecture/08-DartBot.md`, bump the `updated:` front-matter date to `2026-09-17` and add a short §Resolved entry describing the flat-spot removal, matching the format of the existing D-L and D-N entries. (This header has gone stale twice before — issue #285.)

- [ ] **Step 3: Record the decision**

```bash
git fetch origin main
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' -- 'decisions/**.md' | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Append to `decisions/game-engine.md` with that id + 1:

```markdown
### D<next> — Adjacent DartBot levels never share a bias pair, and a test says so
Status: Accepted · Date: 2026-09-17
Decision: levels 7, 8, 9, 10, 12 and 13 get `biasXMm`/`biasYMm` values derived by geometric interpolation between their nearest distinct neighbours (`app/scripts/dartbot-bias-flatspot-fix.ts`). `skill-profile.module.test.ts` now asserts that no adjacent level pair shares an identical `(biasXMm, biasYMm)` pair across all 15 levels, and that bias magnitude shrinks from level 7 to 15. Anchors 1, 6 and 15 are untouched, as is every non-bias field.
Reason: `LEVEL_SKILL_TABLE` is meant to be 15 distinct hand-tuned points. Three pairs shared an exact bias pair from before D-L, and because both D-L's power-law rescale and D-N's log-space interpolation operate on pre-edit per-level ratios, a pair identical before an edit stayed identical after it — two refits carried the artifact forward (issue #286). Nothing asserted anything about bias across levels, which is exactly why it survived unnoticed. The magnitude assertion starts at level 7 because level 6's measured `-5.0` is real data and legitimately breaks any 1→15 ordering.
Consequences: the committed `throw-engine.determinism.test.ts` snapshot is regenerated, because it is taken at level 8 — one of the moved levels. A determinism snapshot pinned to a tunable level will break on every future refit; that is now a known, accepted cost rather than a surprise. The tier bands for levels 1, 8 and 15 were re-verified by simulation at the harness's own seed and still hold.
```

- [ ] **Step 4: Run the gates**

```bash
cd app && npm run check && npm test && npx fallow && npm run format:check
bash scripts/check-decision-ids.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
bash scripts/check-context-budget.sh
bash scripts/check-no-inline-comments.sh
TEST_COVERAGE_BASE_REF=origin/main bash scripts/check-test-coverage.sh
```

Expected: every command exits zero. Report each result individually.

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "docs(dartbot): log the bias flat-spot removal (#286)"
git push -u origin fix/p4-dartbot-bias-flatspots
gh pr create --base main --title "fix(dartbot): remove the three inherited bias flat spots (#286)" --body "$(cat <<'EOF'
Levels 7/8, 9/10 and 12/13 shared an exact `biasXMm`/`biasYMm` pair inherited from the pre-D-L table; both later refits are ratio-preserving, so both carried it forward. Each pair is re-derived by geometric interpolation between its nearest distinct neighbours. Anchors 1, 6 and 15 untouched; no non-bias field changed.

Two intentional test-side changes:
- the determinism snapshot is regenerated — it is taken at level 8, one of the moved levels
- a new assertion: no adjacent level pair shares a bias pair, and magnitude shrinks from level 7 to 15

Tier bands re-verified by simulation at the harness's own seed: <measured values>

Spec: `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` §6

Closes #286

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Replace `<measured values>` with the real numbers before running.
