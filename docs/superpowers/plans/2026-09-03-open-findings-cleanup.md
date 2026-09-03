# Open Findings Cleanup (F15 partial, F58, F59) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three small, independent open findings — a dead CSS class, three missing Version History entries, and a new plan-verification gate — as bundled per `docs/superpowers/specs/2026-09-03-open-findings-cleanup-design.md`.

**Architecture:** No shared code path across the three tasks. Task 1 is a one-line `.astro` class removal plus a `FINDINGS.md` edit. Task 2 is a doc-only backfill of `docs/architecture/00-Context-Map-History.md`. Task 3 adds a new Python-backed bash gate script (mirroring `scripts/check-findings-log.sh`'s shape) wired into `.claude/settings.json` as a `PostToolUse` hook on `docs/superpowers/plans/*.md` writes/edits.

**Tech Stack:** Astro, TypeScript/Vitest (app), bash + python3 (gate scripts), Claude Code hooks (`.claude/settings.json`).

## Global Constraints

- Minimal diffs; validate and fix docs with targeted edits — never regenerate them (root `CLAUDE.md`).
- `.astro` markup has no dedicated unit test (D101) — Task 1 needs no new test file.
- Decisions ledger is append-only; a reversal cites `Supersedes:` (root `CLAUDE.md`) — not touched by this plan (no new architectural decision made).
- `FINDINGS.md` is guarded by `scripts/check-findings-log.sh`: `Status:` only `Open`/`Raised` (never `Resolved` — a resolved finding is DELETED); every `Evidence:` backtick path must resolve on disk; `highest-issued: F59` never decreases.
- `docs/architecture/00-Context-Map-History.md` is append-only provenance; `context-maintenance` writes new Version entries, never edits old ones.
- Closes FINDINGS.md F15 (partially — only the dead-`flex-1` half; the 8-file `h-full`/`flex-1` audit stays open), F58, F59.
- Every task branch's diff must keep `scripts/check-context-budget.sh` passing — `docs/architecture/00-File-Inventory.md`'s `~Nk` row for `00-Context-Map-History.md` (currently `~45.1k`, line 25) must be refreshed if Task 2 pushes real size past its 20% tolerance.

---

## Task 1: F15 (partial) — drop dead `flex-1` from `SplitScoreboardHalf.astro`

**Files:**
- Modify: `app/src/components/layout/games/SplitScoreboardHalf.astro:53`
- Modify: `FINDINGS.md` (F15 block, lines 49-54)

**Interfaces:**
- Consumes: nothing from another task.
- Produces: nothing consumed by a later task in this plan.

- [ ] **Step 1: Remove the dead `flex-1` class**

In `app/src/components/layout/games/SplitScoreboardHalf.astro`, the `cn()` call at line 52-55 currently reads:

```astro
const className = cn(
  "flex flex-col gap-1 items-center min-h-0 flex-1",
  classNameProp,
);
```

Change it to:

```astro
const className = cn(
  "flex flex-col gap-1 items-center min-h-0",
  classNameProp,
);
```

Rationale (do not add as a code comment — this is prose for the commit message only): the parent `SplitScoreboard.astro` is `display: grid`, so `flex-*` utilities have no effect on this element; height comes from grid-row stretch either way. No visual or behavioral change.

- [ ] **Step 2: Type-check**

Run: `cd app && npx astro check --minimumFailingSeverity hint`
Expected: `0 errors, 0 warnings, 0 hints` (no new hints from a plain class-string edit).

- [ ] **Step 3: Edit FINDINGS.md's F15 block**

`FINDINGS.md` lines 49-54 currently read:

```
### F15 — Every game interface repeats a fragile `max-h-2/5 h-full` sizing pair, and one grid item carries a dead `flex-1`
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: fixing a real-device-only (iPhone 12 Pro, not reproducible in this environment's Chromium or in desktop-simulated mobile viewports) overlap in the split scoreboard found the nested `glass` (`backdrop-filter`) stack unique to that path and removed it; this closes the one occurrence actually reported, not the underlying sizing pattern all nine interfaces share
Evidence: every interfaces file passes `class="max-h-2/5 h-full"` (or `min-h-2/5 max-h-2/5 h-full`) to its `SinglePlayerDisplay`/`SplitScoreboard` — `app/src/components/layout/games/interfaces/Shanghai.astro:24`, `app/src/components/layout/games/interfaces/ScoreTraining.astro:23`, `app/src/components/layout/games/interfaces/TenUpOneDown.astro:21`, `app/src/components/layout/games/interfaces/OneTwentyOne.astro:21`, `app/src/components/layout/games/interfaces/DoublesTraining.astro:24`, `app/src/components/layout/games/interfaces/SinglesTraining.astro:24`, `app/src/components/layout/games/interfaces/Bobs27.astro:24`, `app/src/components/layout/games/interfaces/AroundTheClock.astro:23`, `app/src/components/layout/games/interfaces/FiveOhOne.astro:25` — stacking `h-full` (percentage height) on a flex item whose `flex-1` already sets `flex-basis: 0%`, which per spec makes the percentage height inert; separately, `app/src/components/layout/games/SplitScoreboardHalf.astro:53`'s root div carries `flex-1`, but its parent (`app/src/components/layout/games/SplitScoreboard.astro`) is `display: grid`, where `flex-*` properties have no effect at all. The `SplitScoreboard` call site at `app/src/components/layout/games/interfaces/FiveOhOne.astro:76` was changed to h-2/5 (2026-08-22, reported production overlap still visible under the old classes) — this only fixes that one call site, not the pattern across the other eight interfaces
Impact: the pattern was never proven to be the reported bug's cause (the nested `glass` fix was), so it may or may not harbor a real cross-browser sizing risk on the other eight interfaces' own iOS rendering — unverified either way since no WebKit engine is available in this environment; the dead `flex-1` class is harmless but misleads a reader into thinking `SplitScoreboardHalf`'s height is flex-resolved when it is actually grid-row-stretched
Proposed: audit whether `h-full` can simply be dropped everywhere it sits beside `flex-1` (no behavior change per spec, one less redundant declaration), and replace `SplitScoreboardHalf.astro:53`'s `flex-1` with nothing (or an explicit `h-full`, if grid stretch is ever found unreliable) — small, mechanical, but touches nine files and deserves its own task and on-device verification rather than folding into this one
```

Replace that whole block (all 6 lines, heading through `Proposed:`) with:

```
### F15 — Every game interface repeats a fragile `max-h-2/5 h-full` sizing pair
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: fixing a real-device-only (iPhone 12 Pro, not reproducible in this environment's Chromium or in desktop-simulated mobile viewports) overlap in the split scoreboard found the nested `glass` (`backdrop-filter`) stack unique to that path and removed it; this closes the one occurrence actually reported, not the underlying sizing pattern all nine interfaces share
Evidence: every interfaces file passes `class="max-h-2/5 h-full"` (or `min-h-2/5 max-h-2/5 h-full`) to its `SinglePlayerDisplay`/`SplitScoreboard` — `app/src/components/layout/games/interfaces/Shanghai.astro:24`, `app/src/components/layout/games/interfaces/ScoreTraining.astro:23`, `app/src/components/layout/games/interfaces/TenUpOneDown.astro:21`, `app/src/components/layout/games/interfaces/OneTwentyOne.astro:21`, `app/src/components/layout/games/interfaces/DoublesTraining.astro:24`, `app/src/components/layout/games/interfaces/SinglesTraining.astro:24`, `app/src/components/layout/games/interfaces/Bobs27.astro:24`, `app/src/components/layout/games/interfaces/AroundTheClock.astro:23`, `app/src/components/layout/games/interfaces/FiveOhOne.astro:25` — stacking `h-full` (percentage height) on a flex item whose `flex-1` already sets `flex-basis: 0%`, which per spec makes the percentage height inert. The `SplitScoreboard` call site at `app/src/components/layout/games/interfaces/FiveOhOne.astro:76` was changed to h-2/5 (2026-08-22, reported production overlap still visible under the old classes) — this only fixes that one call site, not the pattern across the other eight interfaces
Impact: the pattern was never proven to be the reported bug's cause (the nested `glass` fix was), so it may or may not harbor a real cross-browser sizing risk on the other eight interfaces' own iOS rendering — unverified either way since no WebKit engine is available in this environment
Proposed: audit whether `h-full` can simply be dropped everywhere it sits beside `flex-1` (no behavior change per spec, one less redundant declaration) — small, mechanical, but touches nine files and deserves its own task and on-device verification rather than folding into this one. `SplitScoreboardHalf.astro:53`'s own dead `flex-1` (the parent `SplitScoreboard.astro` is `display: grid`, where `flex-*` has no effect) was fixed on `claude/open-findings-brainstorm-3sffvz` — the class was dropped with no behavior change, so a future reader auditing this pattern doesn't re-discover the same dead class
```

- [ ] **Step 4: Run the findings-log gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0; prints `OK: field shape — all N block(s) carry the seven required fields, valid Status, ISO Found date` and `OK: evidence — all N cited path(s) resolve` among its output (F15's edited `Evidence:` line still cites only paths that exist).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/games/SplitScoreboardHalf.astro FINDINGS.md
git commit -m "$(cat <<'EOF'
fix: drop dead flex-1 from SplitScoreboardHalf (F15 partial)

The parent SplitScoreboard.astro is display:grid, so flex-1 on this
child has no effect — height comes from grid-row stretch either way.
Trims F15's Claim/Evidence to the still-open 8-file h-full/flex-1
audit and notes this half is fixed, so a future reader doesn't
re-discover the same dead class.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

---

## Task 2: F58 — backfill 3 missing Version History entries

**Files:**
- Modify: `docs/architecture/00-Context-Map-History.md` (insert 3 new `> **Version:**` blocks between the existing `1.36.0` entry, line 28, and the existing `1.35.0` entry, line 30)
- Modify: `docs/architecture/00-File-Inventory.md` (line 25 — `00-Context-Map-History.md`'s `~Nk` row, refreshed if `check-context-budget.sh` flags drift)
- Modify: `FINDINGS.md` (delete the F58 block)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing consumed by Task 3 (independent).

No code change in this task — all three plans it backfills (`dartbot-setup-wiring-fixes`, `alpine-reactivity-fold-fixes`, `preview-seat-scoping-fixes`) already merged into `main` via PR #224 (`8ebed57`, "Fold Alpine reactivity for six play controllers", merged 2026-09-02T22:03:48Z) — their commits are already on this branch. This task only writes the three missing prose entries.

- [ ] **Step 1: Read the current insertion point**

Run: `sed -n '24,32p' docs/architecture/00-Context-Map-History.md`
Expected: line 26 is the `1.37.0` entry, line 28 is `1.36.0`, line 30 is `1.35.0`, each followed by a blank line (27, 29, 31).

- [ ] **Step 2: Insert the three new entries between line 29 (blank, after 1.36.0) and line 30 (1.35.0)**

Insert, in this exact order (newest-first, matching the file's existing descending-version convention), each followed by a blank line, directly before the existing `> **Version:** 1.35.0 (...)` line:

```
> **Version:** 1.35.3 (2026-09-02 — preview-seat-scoping-fixes: backfilled Version History entry for a plan whose own context-maintenance pass (`fbec686`) skipped it — closes F32, F33. `singles-training-play.data.ts`'s `previewSegmentsFor` computed its round index from `turns.length` (global turn count across both seats), the same seat-unscoped bug issue #166 found in Shanghai — fixed to derive the round from a count of turns filtered to the last turn's own `participantRef` (`c56c9f0`, "scope Singles Training's preview target to the throwing seat's own round"). `around-the-clock-play.data.ts`'s `previewSegments()` filtered `$store.game.turns` by `state.activeParticipantRef` before computing the preview, but `seat-rota.module.ts`'s `activeSeat` rotates to the next thrower the instant a turn closes — before the 1.5s reveal timer even starts — so during that window the preview read the *next* seat's (usually empty) turn history instead of the seat whose darts were fading out; fixed to scope by the last turn's own `participantRef` instead of the rotated active seat (`31413a2`, "scope Around the Clock's preview to the just-closed turn's own seat"). Same fix direction both times, adapted to each file's own `previewSegmentsFor` signature — no shared helper extracted. Plan: `docs/superpowers/plans/2026-09-02-preview-seat-scoping-fixes.md`. Validation: covered by PR #224's aggregate run before merge — `cd app && npx vitest run` 3289/3289 pass; `npx fallow` 0 above threshold; `astro check --minimumFailingSeverity hint` 0 errors/0 warnings/0 hints; all local gate scripts `OK`. No new `FINDINGS.md` entries from this plan itself. No `DECISIONS.md` entry — mirrors the already-established Shanghai preview-seat-scoping fix (`docs/superpowers/plans/2026-08-27-shanghai-preview-seat-scoping.md`), no new alternative weighed.)

> **Version:** 1.35.2 (2026-09-02 — alpine-reactivity-fold-fixes: backfilled Version History entry for a plan whose own context-maintenance pass (`c30b733`) skipped it — closes F31. Six `*-play.data.ts` files' `state()` read `this.engine?.state()` — a plain, non-reactive class instance — instead of folding `$store.game`'s own Alpine-tracked `stages`/`turns` fields, so `x-text`/`x-show` expressions never re-rendered on a recorded dart (the same defect TUOD and 501 had already fixed). Score Training and Shanghai swapped `state()` to call each engine module's already-exported `foldXState`. Doubles Training, Around the Clock, and Singles Training each had a private module-level fold function exported, then `state()` swapped to call it directly. Bob's 27 needed a real extraction: `foldBobs27State` pulled out of `Bobs27Engine.deriveState()`'s inline logic into its own exported function, then `state()` swapped to call it. Each affected `*-play-data.test.ts`'s pre-existing "per-seat accessors" test had stubbed `engine.state()` directly — a fixture shape the new store-folding `state()` no longer reads — re-pointed at the same guarantee (correct seat selected among several / an unknown seat returns `""`) via `$store.game.recordFacts` instead of being deleted. Plan: `docs/superpowers/plans/2026-09-02-alpine-reactivity-fold-fixes.md`; PR: #224 ("Fold Alpine reactivity for six play controllers", merged 2026-09-02T22:03:48Z). Validation: `cd app && npx vitest run` 3289/3289 pass; `npx fallow` 0 above threshold; `astro check --minimumFailingSeverity hint` 0 errors/0 warnings/0 hints; all local gate scripts (context map, doc links, context budget, agent mirrors, file locations, findings log, test coverage, Astro class composition/conventions, game engines, refinement coverage, type barrels, alias sync, constraint mirror, no-inline-comments, style tokens, game wiring) `OK`. No new `FINDINGS.md` entries. No `DECISIONS.md` entry — a mechanical fix mirroring TUOD/501's already-established fold pattern, no new decision made.)

> **Version:** 1.35.1 (2026-09-02 — dartbot-setup-wiring-fixes: backfilled Version History entry for a plan whose own context-maintenance pass (`f90583e`) skipped it — closes F45, F54, F55, F56, F57. F54: `fiveOhOneSetup()`/`FiveOhOneSetupContext` gained the `bot`/`addBot`/`removeBot`/`showOpponentChooser` state and methods `PresetSetupContext` already had, and `start()` now calls `participantsFromGuests(this.guests, this.bot)`, so the 501 setup screen's DartBot chooser can actually seat a bot (`26b6a72`). F45: both 121 and Singles Training setup always submitted their V2 ruleset key regardless of guest count, so a 1v1 session could never be created for either — 121's `start()` now resolves `121_V1` for a guested session via new `resolveStartPreset`/`resolveStartOverrides` helpers (extracted after the guest-aware branching pushed the function's CRAP score over the app-wide `maxCrap:30` gate; `e6d2982`, `655a88e`), and Singles Training's shared `createPresetSetupController` widened its `rulesetVersionKey` option to accept a per-context resolver function so `singlesTrainingSetup()` can resolve `SINGLES_V1` once guested (`4747bf9`). F55: `playFoldBotQuickScoreVisit` looped on `isComplete()` (whole-match completion) alone, so a bust or non-final-leg checkout that closed the bot's current visit before the third dart went unnoticed — the loop opened a new, fabricated visit and returned that instead of the bot's real one; fixed to stop the loop once the visit it just recorded closes (`301958a`). F56: `toSeatFacts`/`composeSeatFacts` each guarded their `DARTBOT` branch on type-plus-payload, silently falling through to `PLAYER`/`GUEST` when the `dartbot` payload was absent — the two-collapses-in-opposite-directions failure mode `08-DartBot.md` names as actively dangerous; both now throw instead of mislabeling the seat when the payload is unexpectedly missing (unreachable today — `buildSeatPlan` always attaches it — but no longer silently wrong if that ever changes) (`409799a`). F57: `08-DartBot.md`'s scatter-model paragraph reworded to describe `covarianceRotationDegrees` as a fixed per-player technique bias rather than a target-wire-relative rotation, matching what the code actually computes (doc-only; the constant is 0 for every level today, so this was latent, not observable) (`612dd75`). Plan: `docs/superpowers/plans/2026-09-02-dartbot-setup-wiring-fixes.md`; PR: #224 ("Fold Alpine reactivity for six play controllers", merged 2026-09-02T22:03:48Z — its diff also carries this plan's and preview-seat-scoping-fixes' commits, landed on the same branch before that PR opened). Validation: covered by PR #224's aggregate run before merge — `cd app && npx vitest run` 3289/3289 pass; `npx fallow` 0 above threshold; `astro check --minimumFailingSeverity hint` 0 errors/0 warnings/0 hints; all local gate scripts `OK`. No new `FINDINGS.md` entries from this plan itself. No `DECISIONS.md` entry — each fix follows an already-established sibling pattern (`PresetSetupContext`'s bot fields, the other three engines' bot-visit fold, the type-discriminant-first guard shape), no new alternative weighed.)

```

- [ ] **Step 3: Verify insertion order and blank lines**

Run: `grep -n "^> \*\*Version:\*\*" docs/architecture/00-Context-Map-History.md | head -8`
Expected output shows, in this order: `1.40.0`, `1.39.0`, `1.38.0`, `1.37.0`, `1.36.0`, `1.35.3`, `1.35.2`, `1.35.1`, `1.35.0` (or whatever the current highest version is at the top — the key check is `1.36.0` immediately followed by `1.35.3`, `1.35.2`, `1.35.1`, `1.35.0` in strict descending order with no gaps or duplicates).

- [ ] **Step 4: Delete the F58 block from FINDINGS.md**

`FINDINGS.md` currently has (exact text, confirm with `grep -n -A6 '^### F58' FINDINGS.md` first):

```
### F58 — Three already-landed plans' `context-maintenance` passes skipped the Version History entry
Status: Open · Found: 2026-09-02 · Task: claude/rebase-pr-three-docs-4tm39h
Claim: `dartbot-setup-wiring-fixes` (commit `f90583e`), `alpine-reactivity-fold-fixes` (`c30b733`), and `preview-seat-scoping-fixes` (`fbec686`) each shipped a "docs: context maintenance for ..." commit closing their own findings (F45/F54-F57, F31, F32/F33 respectively), but none of the three added a `docs/architecture/00-Context-Map-History.md` Version History entry — the mandatory step this same skill's own procedure requires (root `CLAUDE.md`, Context Maintenance section)
Evidence: `git log --oneline --all -S"F54 —" -- FINDINGS.md` / `-S"F31 —"` / `-S"F32 —"` each resolve to the three commits named above, all already on this branch; `grep -n "alpine-reactivity\|dartbot-setup-wiring\|preview-seat-scoping" docs/architecture/00-Context-Map-History.md` returns nothing, while every other 2026-09-02 plan on this branch (board-dart-bull-double-checkout, tuod-hardening, scoring-stats-correctness) has its own Version entry
```

(followed by an `Impact:` and `Proposed:` line — read the actual file to get their exact text before deleting, since this plan's excerpt above may not reproduce every line verbatim). Delete the entire block: the `### F58 — ...` heading line through its `Proposed:` line, plus the blank line immediately after it.

- [ ] **Step 5: Run the findings-log gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0.

- [ ] **Step 6: Run the context-budget gate and refresh the File-Inventory row if it fails**

Run: `bash scripts/check-context-budget.sh`

If it reports `00-Context-Map-History.md` drifted past its 20% tolerance, update `docs/architecture/00-File-Inventory.md:25`'s `~45.1k` value to the actual estimate the script reports, then re-run the same command until it exits 0. If it already passes with no change needed, skip the edit.

- [ ] **Step 7: Commit**

```bash
git add docs/architecture/00-Context-Map-History.md docs/architecture/00-File-Inventory.md FINDINGS.md
git commit -m "$(cat <<'EOF'
docs: backfill 3 missing Version History entries (F58)

dartbot-setup-wiring-fixes, alpine-reactivity-fold-fixes, and
preview-seat-scoping-fixes each shipped without the mandatory
context-maintenance Version History step. All three already merged
via PR #224; this only writes the missing prose (1.35.1-1.35.3,
inserted chronologically between the existing 1.35.0 and 1.36.0
entries). No code change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

---

## Task 3: F59 — automate the plan-verification gap

**Files:**
- Create: `scripts/check-plan-findings-closure.sh`
- Create: `scripts/check-plan-findings-closure-hook.sh`
- Modify: `.claude/settings.json` (add `PostToolUse` hook)
- Modify: `FINDINGS.md` (delete the F59 block)

**Interfaces:**
- Consumes: nothing from Task 1 or Task 2.
- Produces: `scripts/check-plan-findings-closure.sh <plan-file>` — a standalone CLI: exits 0 if every `Closes FINDINGS.md F<id>` claim in the plan has a matching deletion step somewhere in the file, exits 1 (printing each missing id to stderr) otherwise. Called both directly (for testing) and by the hook wrapper.

- [ ] **Step 1: Write `scripts/check-plan-findings-closure.sh`**

This mirrors `scripts/check-findings-log.sh`'s shape: a bash entry point that `cd`s to the repo root and hands off to an inline `python3` script, taking the plan file path as its one required argument.

```bash
#!/usr/bin/env bash
# Plan findings-closure gate — F59. A plan's "Closes FINDINGS.md F<id>"
# claim (in its Global Constraints or header) is only as good as an actual
# deletion step for that id somewhere in the plan; nothing before this
# mechanically checked the two lists agree. Companion to
# scripts/check-findings-log.sh, which checks FINDINGS.md's own shape —
# this checks a *plan file's* claim against its own task text.
#
# WHAT THIS CANNOT DO: it cannot verify the deletion step actually deletes
# the right block, or that a plan's code is correct — only that every id it
# claims to close has *some* step whose text names deleting that id's
# FINDINGS.md block. See docs/superpowers/specs/2026-09-03-open-findings-cleanup-design.md
# Task 3 for the companion gate-script-diff reminder, which is NOT
# mechanically checkable and is handled separately by the PostToolUse hook.
#
# ARGUMENT: the plan file to check (required — no default, unlike
# check-findings-log.sh, since there is no single canonical plan file).

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

PLAN="${1:?usage: check-plan-findings-closure.sh <plan-file.md>}"

[ -f "$PLAN" ] || { echo "FAIL: $PLAN not found" >&2; exit 1; }

python3 - "$PLAN" <<'PY'
import re
import sys
from pathlib import Path

plan_path = sys.argv[1]
text = Path(plan_path).read_text(encoding="utf-8")

# "Closes FINDINGS.md F12" / "Closes FINDINGS.md F12, F13" / "closes F12"
# (case-insensitive on "closes"; F-ids comma-or-and-separated)
CLOSES_RE = re.compile(r"[Cc]loses(?:\s+FINDINGS\.md)?\s+((?:F\d+[,\s]*(?:and)?\s*)+)")
FID_RE = re.compile(r"F(\d+)")
# A step that names deleting/closing that id's own FINDINGS.md block.
DELETES_RE = re.compile(
    r"(delet\w*|remov\w*|clos\w*).{0,80}\bF(\d+)\b|"
    r"\bF(\d+)\b.{0,80}(delet\w*|remov\w*|clos\w*)",
    re.IGNORECASE,
)

claimed: set[int] = set()
for m in CLOSES_RE.finditer(text):
    for fid in FID_RE.finditer(m.group(1)):
        claimed.add(int(fid.group(1)))

if not claimed:
    print(f"OK: {plan_path} makes no 'Closes FINDINGS.md F<id>' claim — nothing to check")
    sys.exit(0)

deleted: set[int] = set()
for m in DELETES_RE.finditer(text):
    fid = m.group(2) or m.group(3)
    if fid:
        deleted.add(int(fid))

missing = sorted(claimed - deleted)
if missing:
    ids = ", ".join(f"F{i}" for i in missing)
    print(
        f"FAIL: {plan_path} claims to close {ids} but no step's text names "
        f"deleting/closing that id's FINDINGS.md block",
        file=sys.stderr,
    )
    sys.exit(1)

print(f"OK: {plan_path} — all {len(claimed)} claimed closure(s) have a matching deletion step")
sys.exit(0)
PY
```

Make it executable: `chmod +x scripts/check-plan-findings-closure.sh`.

- [ ] **Step 2: Prove the gate fails on malformed input**

```bash
mkdir -p /tmp/claude-scratch-f59
cat > /tmp/claude-scratch-f59/bad-plan.md <<'EOF'
# Bad Plan

## Global Constraints

- Closes FINDINGS.md F999.

## Task 1: Do something

- [ ] Step 1: write code
- [ ] Step 2: commit
EOF
bash scripts/check-plan-findings-closure.sh /tmp/claude-scratch-f59/bad-plan.md
echo "exit code: $?"
```

Expected: prints `FAIL: /tmp/claude-scratch-f59/bad-plan.md claims to close F999 but no step's text names deleting/closing that id's FINDINGS.md block` to stderr, `exit code: 1`.

- [ ] **Step 3: Prove the gate passes on well-formed input**

```bash
cat > /tmp/claude-scratch-f59/good-plan.md <<'EOF'
# Good Plan

## Global Constraints

- Closes FINDINGS.md F999.

## Task 1: Do something

- [ ] Step 1: write code
- [ ] Step 2: delete the F999 block from FINDINGS.md
- [ ] Step 3: commit
EOF
bash scripts/check-plan-findings-closure.sh /tmp/claude-scratch-f59/good-plan.md
echo "exit code: $?"
```

Expected: prints `OK: /tmp/claude-scratch-f59/good-plan.md — all 1 claimed closure(s) have a matching deletion step`, `exit code: 0`.

- [ ] **Step 4: Clean up the scratch fixtures**

```bash
rm -rf /tmp/claude-scratch-f59
```

- [ ] **Step 5: Write `scripts/check-plan-findings-closure-hook.sh`**

The `PostToolUse` hook wrapper. Claude Code feeds every `PostToolUse` hook a JSON object on stdin with (among other keys) `tool_name` and `tool_input.file_path`; the hook filters to plan files, runs the gate above, and separately prints a non-blocking reminder when the plan looks like it proposes a `scripts/` diff.

```bash
#!/usr/bin/env bash
# PostToolUse hook wrapper for F59 — fires on every Write/Edit tool call
# (matcher in .claude/settings.json), filters to docs/superpowers/plans/*.md,
# then:
#   1. Runs check-plan-findings-closure.sh against the written file —
#      BLOCKING (exit 2) on a closure mismatch, per the user's own
#      "block on closure mismatch, warn on diffs" scoping decision.
#   2. Prints a non-blocking stderr reminder if the plan's text names a
#      scripts/*.sh path inside a fenced code block — not mechanically
#      verifiable (would require executing the plan's own proposed change
#      against the live repo), so this is a reminder, not a check.
#
# Reads the tool-call JSON on stdin; exits 0 silently for any tool call
# that isn't a Write/Edit of a docs/superpowers/plans/*.md file.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

INPUT="$(cat)"

FILE_PATH="$(python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print(data.get("tool_input", {}).get("file_path", ""))
' <<<"$INPUT")"

case "$FILE_PATH" in
  */docs/superpowers/plans/*.md|docs/superpowers/plans/*.md) ;;
  *) exit 0 ;;
esac

[ -f "$FILE_PATH" ] || exit 0

if ! bash scripts/check-plan-findings-closure.sh "$FILE_PATH" 1>&2; then
  echo "BLOCKED: $FILE_PATH has an unclosed FINDINGS.md claim — see above, fix before this write/edit can stand." >&2
  exit 2
fi

if grep -q '```' "$FILE_PATH" && grep -qE '\bscripts/[A-Za-z0-9_.-]+\.sh\b' "$FILE_PATH"; then
  N="$(grep -cE '\bscripts/[A-Za-z0-9_.-]+\.sh\b' "$FILE_PATH")"
  echo "REMINDER: $FILE_PATH names $N scripts/*.sh reference(s) — run any proposed gate-script/checklist diff against the current repo before publishing this plan (not mechanically checked)." >&2
fi

exit 0
```

Make it executable: `chmod +x scripts/check-plan-findings-closure-hook.sh`.

- [ ] **Step 6: Wire the hook into `.claude/settings.json`**

Current `.claude/settings.json`'s `hooks` block only has `UserPromptSubmit`:

```json
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"Repo concision rule (always on): be extremely concise in all output AND in internal reasoning/thinking — no verbose deliberation, keep thinking terse and to the point. Applies to all replies, commits, and plans; sacrifice grammar and pleasantries for brevity; prefer short words; no recaps; no transitional or acknowledgment phrases. Acknowledge only with On it. or Starting search., then execute immediately.\"}}'",
            "statusMessage": "Applying concision rule"
          }
        ]
      }
    ]
  }
```

Add a `PostToolUse` sibling key so the block reads:

```json
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"Repo concision rule (always on): be extremely concise in all output AND in internal reasoning/thinking — no verbose deliberation, keep thinking terse and to the point. Applies to all replies, commits, and plans; sacrifice grammar and pleasantries for brevity; prefer short words; no recaps; no transitional or acknowledgment phrases. Acknowledge only with On it. or Starting search., then execute immediately.\"}}'",
            "statusMessage": "Applying concision rule"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash scripts/check-plan-findings-closure-hook.sh",
            "statusMessage": "Checking plan findings-closure (F59 gate)"
          }
        ]
      }
    ]
  }
```

Use the `update-config` skill to make this edit (hooks are its domain per root `CLAUDE.md`'s routing) rather than hand-editing the JSON — invoke it with the exact block above as the target state.

- [ ] **Step 7: Verify the hook fires — closure mismatch (blocking)**

```bash
mkdir -p /tmp/claude-scratch-f59-hook
cat > /tmp/claude-scratch-f59-hook/plan.md <<'EOF'
# Scratch

## Global Constraints

- Closes FINDINGS.md F999.

## Task 1

- [ ] Step 1: write code
EOF
echo '{"tool_name":"Write","tool_input":{"file_path":"/tmp/claude-scratch-f59-hook/plan.md"}}' | bash scripts/check-plan-findings-closure-hook.sh
echo "exit code: $?"
```

Expected: `exit code: 2`, with `FAIL: ...` and `BLOCKED: ...` lines on stderr.

- [ ] **Step 8: Verify the hook fires — gate-script-diff reminder (non-blocking)**

```bash
cat > /tmp/claude-scratch-f59-hook/plan2.md <<'EOF'
# Scratch 2

## Task 1

Proposed diff:

```diff
--- a/scripts/check-example.sh
+++ b/scripts/check-example.sh
@@
+echo hi
```

- [ ] Step 1: write code
EOF
echo '{"tool_name":"Write","tool_input":{"file_path":"/tmp/claude-scratch-f59-hook/plan2.md"}}' | bash scripts/check-plan-findings-closure-hook.sh
echo "exit code: $?"
```

Expected: `exit code: 0`, with a `REMINDER: ... scripts/check-example.sh ...` line on stderr.

- [ ] **Step 9: Verify the hook is a no-op for non-plan files**

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"/tmp/claude-scratch-f59-hook/not-a-plan.txt"}}' | bash scripts/check-plan-findings-closure-hook.sh
echo "exit code: $?"
```

Expected: `exit code: 0`, no output.

- [ ] **Step 10: Clean up scratch fixtures**

```bash
rm -rf /tmp/claude-scratch-f59-hook
```

- [ ] **Step 11: Delete the F59 block from FINDINGS.md**

Read the current block first: `grep -n -A6 '^### F59' FINDINGS.md`. Delete the entire `### F59 — ...` heading line through its `Proposed:` line, plus the blank line immediately after it — F59's Proposed section ("extend F50's own suggestion... to all plans") is fulfilled by this automated, always-on check.

- [ ] **Step 12: Run the findings-log gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0; `highest-issued: F59` in the front matter is unchanged (the high-water mark never decreases, even though F59 itself is now deleted).

- [ ] **Step 13: Run the repo's structural gates touched by this task**

Run: `bash scripts/check-context-map.sh && bash scripts/check-file-locations.sh`
Expected: both exit 0 (new `scripts/*.sh` files follow the existing `check-*.sh` naming/location convention; no doc cross-reference broke).

- [ ] **Step 14: Commit**

```bash
git add scripts/check-plan-findings-closure.sh scripts/check-plan-findings-closure-hook.sh .claude/settings.json FINDINGS.md
git commit -m "$(cat <<'EOF'
feat: automate the plan-verification gap with a findings-closure gate (F59)

New scripts/check-plan-findings-closure.sh mechanically verifies every
"Closes FINDINGS.md F<id>" claim in a plan has a matching deletion step.
Wired as a PostToolUse hook on docs/superpowers/plans/*.md writes/edits:
blocks (exit 2) on a closure mismatch, non-blocking stderr reminder when
a plan proposes a scripts/ diff (not mechanically verifiable). Replaces
the one-off manual habit F59's own Proposed section suggested.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

---

## Task 4: Context maintenance and final validation

**Files:**
- Modify: `docs/architecture/00-Context-Map-History.md` (final Version History entry for this plan itself — written by the `context-maintenance` skill's own procedure, not hand-authored here)
- Modify: `docs/architecture/00-File-Inventory.md` (row for any new/changed file this plan touched, if the skill finds one stale — `scripts/check-plan-findings-closure.sh` and `scripts/check-plan-findings-closure-hook.sh` are new files and need rows)

**Interfaces:**
- Consumes: the finished diffs from Tasks 1-3.
- Produces: nothing consumed elsewhere — this is the plan's terminal task.

- [ ] **Step 1: Run the full validation sequence**

Run: `cd app && npx astro check --minimumFailingSeverity hint && npx fallow && npm test`
Expected: `astro check` 0 errors/0 warnings/0 hints; `npx fallow` 0 above threshold; `npm test` full suite passes with no regressions (no `app/` runtime source file changed in this plan — Tasks 1-3 touch `.astro`, `.md`, and new top-level `scripts/*.sh` files only, so no test count should shift).

- [ ] **Step 2: Run the root structural gates**

Run:
```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-findings-log.sh
bash scripts/check-test-coverage.sh
```
Expected: all exit 0.

- [ ] **Step 3: Invoke the `context-maintenance` skill**

Run the `context-maintenance` skill per root `CLAUDE.md`'s mandatory-every-task rule. It will: add a new Version History entry for this plan itself to `docs/architecture/00-Context-Map-History.md`; add `00-File-Inventory.md` rows for `scripts/check-plan-findings-closure.sh` and `scripts/check-plan-findings-closure-hook.sh`; confirm no stale doc cross-reference remains; re-run the Findings gate.

- [ ] **Step 4: Commit the context-maintenance output**

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs: context maintenance for open-findings-cleanup plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

## Testing

- Task 1: `app/src/components/layout/games/SplitScoreboardHalf.astro` has no dedicated `.astro` component test (D101 — markup logic isn't unit tested). Verified via `astro check` only; no behavior change (grid stretch already governed height with or without `flex-1`).
- Task 2: doc-only. `scripts/check-doc-links.sh` and `scripts/check-context-budget.sh` must still pass after the 3 new entries; no test file to touch.
- Task 3: `scripts/check-plan-findings-closure.sh` has no automated test harness in this repo (no `.bats`, no `app/tests/scripts/*.ts` equivalent for root-level `scripts/*.sh` — those are TS build scripts under `app/`, a different category). Verified via the fixture-file steps above (Steps 2-3, 7-9), mirroring `check-findings-log.sh`'s own pattern of proving a gate fails on malformed input before proving it passes on well-formed input. The hook itself has no automated test harness either — verified manually by piping synthetic `PostToolUse` JSON at the hook script directly (Steps 7-9), which is the same input shape Claude Code itself feeds the hook at runtime.

## Non-goals

- No fix to the 8 remaining `h-full`/`flex-1` interface files — stays open in `FINDINGS.md` pending on-device iOS verification.
- No renumbering of existing Version History entries beyond inserting the 3 new `1.35.x` slots.
- No attempt to mechanically verify a plan's proposed gate-script diff actually passes — flagged for human/agent follow-through via the reminder, not enforced.
- No change to `check-findings-log.sh` itself; the new script is additive.
- No change to `app/src/lib/game/types.ts` or any `*-play.data.ts` file — that's F27's and F29's separate plans.
