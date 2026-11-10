# Quality 1 — Pin fallow, revive the clone ratchet, clean its config

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every fallow run in the repo uses one pinned version, the clone ratchet sees the clones that exist, and the fallow config holds no stale row.

**Architecture:** `fallow` becomes an exact-version devDependency of `app/`; both wrapper scripts call the installed binary. The three clone groups the pinned version reports are removed, so the baseline stays empty.

**Tech Stack:** fallow 3.42.0, npm, bash, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-codebase-quality-audit-design.md` (findings 1–3).

## Global Constraints

- No behaviour change: same HTTP bodies, same HTML, same persisted facts.
- `cd app && npm test` before every commit; expect `Test Files 551 passed`, `Tests 11295 passed | 4 skipped` (a higher count is fine, a lower one is not).
- No comments inside function bodies in `app/src`; exported types live in `types.ts`.
- A runtime `.ts` edit needs a test edit in the same commit (`check-test-coverage.sh`). Never `--no-verify`.
- `scripts/dupes-baseline.txt` stays empty (0 bytes).
- Finish with the `context-maintenance` and `run-all-gates` skills, then `finishing-a-dart-branch`.

## Review Focus

- A fallow upgrade later changes findings: the pin must be exact (`3.42.0`, no caret) and in `package-lock.json`.
- `npx --no-install` with `node_modules` absent must fail loudly, not download: check the error text.
- `createSchedule` and `replaceSchedule` must still generate a fresh id per day on every call.
- A routine summary row order change is visible in the UI: row order and labels must be identical.
- `DurationField` props are read by setup forms: prop names and types unchanged.

---

### Task 1: Pin fallow

**Files:**
- Modify: `app/package.json`, `app/package-lock.json`
- Modify: `scripts/fallow-gate.sh` (two `npx fallow` calls), `scripts/check-dupes.sh:23`

- [ ] **Step 1:** `cd app && npm install --save-dev --save-exact fallow@3.42.0`
- [ ] **Step 2:** In `scripts/fallow-gate.sh` replace both `npx fallow` with `npx --no-install fallow`. In `scripts/check-dupes.sh` replace `npx -y fallow@3.38.0` with `npx --no-install fallow`.
- [ ] **Step 3: Verify the pin.** Run `cd app && npx --no-install fallow --version`. Expected: `fallow 3.42.0`.
- [ ] **Step 4: Verify the ratchet is alive.** Run `bash scripts/check-dupes.sh`. Expected: exit 1 and three `new clone group:` lines (`schedule.service.ts`, `routine-summary.module.ts`, `DurationField.astro | DurationSoloFields.astro`). This red run is the proof.
- [ ] **Step 5:** Commit: `chore(fallow): pin fallow 3.42.0 as a devDependency`. The pre-commit hook does not run `check-dupes.sh`, so the commit passes.

### Task 2: Remove the three clone groups

**Files:**
- Modify: `app/src/services/schedule.service.ts:133-171`
- Modify: `app/src/modules/training/routines/routine-summary.module.ts:240-305`
- Modify: `app/src/components/layout/games/setup/DurationField.astro`, `DurationSoloFields.astro`, and the `types.ts` barrel that `check-type-barrels.sh` accepts for that folder (none exists there today; follow `06-API/03-Shared-Conventions.md` type-raising)
- Test: `app/tests/services/schedule.service.test.ts`, `app/tests/modules/training/routines/routine-summary.module.test.ts`

- [ ] **Step 1: Pin current behaviour.** Add one test per function pair that asserts the full returned value (schedule: day records carry distinct ids and the input's `dayOfWeek`/`routineTemplateId`; summary: `toEqual` on the whole `RoutineStepSummary` for Catch 40 and Random Checkout). Run them: they pass on the old code.
- [ ] **Step 2:** `schedule.service.ts`: add unexported `toDayRecords(days: ScheduleWriteInput["days"])` returning the `{ id: generateId(), dayOfWeek, routineTemplateId }[]` both transactions build; call it from both.
- [ ] **Step 3:** `routine-summary.module.ts`: add unexported `checkoutRows(checkouts: number, attempts: number, darts: number)` returning the three shared rows (`Checkouts`, `Attempts`, `Checkout rate`) plus `Darts`; Catch 40 prepends its `Points` row.
- [ ] **Step 4:** Astro pair: move the shared prop shape (`rounds`, `minutes`, `soloHint`, slider bounds) (`formatOptions`, `rounds`, `minutes`, `soloHint`) to one exported interface in that barrel; both files declare `type Props = <that interface>`.
- [ ] **Step 5: Verify.** `bash scripts/check-dupes.sh` → `check-dupes: ok (0 file sets)`. `cd app && npm test` → counts as in Global Constraints. `npm run check` → 0 errors, 0 warnings, 0 hints.
- [ ] **Step 6:** Commit: `refactor: fold the three remaining clone groups`.

### Task 3: Drop stale config rows

**Files:**
- Modify: `app/.fallowrc.jsonc`

- [ ] **Step 1:** Delete the whole `thresholdOverrides` array (both entries are reported `stale`). Delete `jose`, `@resvg/resvg-js`, `culori`, `opentype.js` and their comment from `ignoreDependencies`. Add `"ignoreBinaries": ["neon"]` with the comment `// neonctl is installed on the machine, not by npm`.
- [ ] **Step 2: Verify.** `cd app && npx --no-install fallow > /tmp/f.txt 2>&1; echo $?` → `0`. `grep -cE "stale|hid no dependency|Unlisted binaries" /tmp/f.txt` → `0`.
- [ ] **Step 3:** Commit: `chore(fallow): remove stale overrides and ignores`.

### Task 4: Docs

**Files:**
- Modify: `.claude/skills/validate-app/SKILL.md`, `.claude/skills/run-all-gates/SKILL.md` (only lines that say `npx fallow` or name 3.38.0)
- Modify: `decisions/context-system.md` (new decision: fallow is pinned in `app/package.json`; upgrades are a PR that reruns `check-dupes.sh --update` and the benchmark gate)

- [ ] **Step 1:** `bash scripts/next-decision-id.sh`, then append the decision.
- [ ] **Step 2: Verify.** `git grep -n "fallow@3.38\|npx -y fallow" -- ':!docs/superpowers' ':!decisions'` → no output.
- [ ] **Step 3:** Commit, then run the finishing skills.
