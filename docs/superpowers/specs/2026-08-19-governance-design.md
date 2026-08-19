<!--
status: canonical
scope: agent governance — findings log, permission rule, self-learning gate
read-when: implementing the governance spec (Spec 2 of 3)
updated: 2026-08-19
-->

# Design: Governance — findings are logged, not acted on

## Problem

An agent that finds a defect while doing something else has no sanctioned place
to put it. The repo offers three bad options and no good one:

1. **Fix it in the same pass.** Widens the diff past the assignment, mixes
   unreviewed work into a reviewed change, and decides on the user's behalf that
   the finding is worth the risk.
2. **Mention it in chat and move on.** The record dies with the session.
3. **Park it in `DECISIONS.md`'s Deferred list.** Two entries already sit there
   — the `scripts/check-context-map.sh` false positive and the 501 capture-mode
   gap — inside a single `·`-separated run-on line that otherwise holds eleven
   deliberately-unbuilt features. "We chose not to build this" and "this is
   broken" are opposite states filed under one heading.

The cost is visible right now. Five contradictions are live in the repo, every
one of them found incidentally during earlier tasks, none recorded anywhere:

| Contradiction | Evidence |
| ------------- | -------- |
| `permissions.allow` grants `Bash(gh pr view/list/diff:*)` | `gh` is absent from the session container |
| Root `CLAUDE.md` mandates *"Consult before broad grep: `graphify query`"* | `graphify` is absent from the session container |
| `DECISIONS.md` "How to add a decision" says the max id is `D198` | actual max is `D213` |
| `.graphifyignore` ignores `.worktrees/` | D102 forbids worktrees; the directory cannot exist |
| The `check-context-map.sh` false positive is filed as a deferred *feature* | it is a known-broken script, not an unbuilt one |

A sixth — `permissions.allow` granting `Bash(git worktree:*)` against the
*"No git worktrees"* hard invariant — was removed by explicit user instruction
while this spec was being written. It is not in the table because it is fixed,
and it is the only one that is.

Two existing mechanisms are adjacent to the gap but do not close it:

- **The self-learning gate** (`context-maintenance` step 8, D107) already
  encodes propose-then-confirm — but only for `CLAUDE.md`/`AGENT.md` *rule
  sharpenings*. Half its stated target is now dead: Spec 1 reduced every
  `AGENT.md` to a pointer stub, so there are no rules there to sharpen. And a
  stale doc, a broken script, or a bug outside scope is not a rule sharpening,
  so the gate never fires for any of the five rows above.
- **The Deferred list** is the accidental precursor to a findings log:
  unstructured, unformatted, ungated, and welded to an append-only permanent
  ledger whose lifecycle is the opposite of a finding's.

## Scope

Spec 2 of three. Establishes one rule, one log, one gate.

Explicitly **out of scope**:

- **Spec 3 (consistency):** templates / reference exemplars, and fixing the
  `graphify` rule. This spec *logs* that contradiction as `F2`; it does not
  resolve it.
- **No PR-scope CI job.** Comparing a PR's file list against a plan's declared
  task scope was considered and rejected: plans do not enumerate every
  legitimately-touched file, so the gate would fail honest work.
- **The four remaining seeded findings are not fixed by this spec.** See
  "Dogfood" below — this is load-bearing, not an omission.

## Design

### 1. The rule

Root `CLAUDE.md` gains one Hard Invariant:

> - A finding is not a work item. Anything you notice that the task did not ask
>   you to change — a bug, a stale doc, a contradicting rule, a dead file — is
>   logged in `FINDINGS.md` and raised in the completion report; it is never
>   fixed in the same pass. Acting on a finding requires explicit user
>   permission, always. (2026-08-19)

Cost: ~55 tokens on the per-session floor, which Spec 1 cut to ~3.2k. This is
the only floor increase in the spec, and it is deliberate: the rule is
non-negotiable, so it belongs where every task already reads.

What the rule does **not** restrict: the assigned task itself. Work a task step
names — including adjacent edits that work genuinely requires, like fixing an
import the change breaks — proceeds without extra permission. The rule governs
*incidental* discovery only.

### 2. The log

**`FINDINGS.md`** (repo root, new), sibling to `DECISIONS.md`. Same block shape,
so nothing new has to be learned; opposite lifecycle.

```markdown
### F3 — DECISIONS.md states a stale maximum decision id
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: "How to add a decision" names D198 as the current maximum
Evidence: `DECISIONS.md:45` vs derived max `D213`
Impact: an agent trusting the number issues a colliding id; the derive command
  on the same line is correct, so the stale figure is pure trap
Proposed: restate as D213, or drop the parenthetical and keep only the command
```

Seven fields, all required: `Status`, `Found`, `Task`, `Claim`, `Evidence`,
`Impact`, `Proposed` — the header line carries `Status`/`Found`/`Task`.

**Lifecycle — the load-bearing difference from `DECISIONS.md`.** Decisions are
permanent and append-only. Findings are open until closed, and a closed finding
is **deleted**. The record of the fix is the commit that fixed it plus, where
the fix embodies a real choice, a decision in `decisions/**`. Nothing
accumulates. This is what stops `FINDINGS.md` growing into the 28k provenance
blob Spec 1 spent a whole spec carving out of the context map.

Because entries are deleted, ids cannot be derived by scanning the file. The
front-matter carries an explicit high-water mark:

```
highest-issued: F5
```

Next id is that plus one; the line is bumped in the same edit. Ids are never
reused, matching the decision ledger's guarantee by a different mechanism.

`Status` is `Open` (logged, not yet shown to the user) or `Raised` (named in a
completion report). There is no `Resolved` — resolved entries are gone.

The file is registered in `00-File-Inventory.md` and named in one context-map
pointer line, but sits in **no context pack**: agents write to it, humans read
it when triaging.

### 3. The gate

**`scripts/check-findings-log.sh`** (gate 16), joining `.husky/pre-commit` and
`.github/workflows/quality.yml`. Asserts:

1. `FINDINGS.md` exists and its front-matter carries `status:` and
   `highest-issued: F<n>`.
2. Every `### F<id> —` block carries all seven required fields.
3. Ids are unique and `≤ highest-issued`.
4. `Status:` is `Open` or `Raised` — never `Resolved`.
5. Every backticked path in an `Evidence:` line resolves to a file that exists.
6. `Found:` dates are ISO `YYYY-MM-DD`.

Check 5 is the one with teeth over time: it makes a finding whose evidence has
been deleted or moved fail the build, so the log cannot quietly rot into a list
of claims about files that no longer exist.

**What this gate cannot do**, stated plainly so no one mistakes its green for a
guarantee: it proves the log is well-formed and its evidence is live. It cannot
prove an agent logged a finding instead of fixing it — no script can detect the
absence of a fix that was never written. The invariant in §1 carries that
obligation; the gate carries only the shape.

### 4. The self-learning gate is absorbed

A rule sharpening is a finding whose subject happens to be a rule. It needs no
separate mechanism, and its own mechanism is now half-dead.

`context-maintenance` step 8 is rewritten from "Self-learning gate" to
"Findings gate":

> 8. **Findings gate.** Anything this task surfaced that it was not asked to
>    change — a contradiction, an unenforced rule, a stale doc, a bug outside
>    scope — is appended to `FINDINGS.md` as a new `F` entry and named in the
>    completion report. Never fix it in the same pass; never apply a rule change
>    unilaterally. If the user approves acting on a finding, that is a new task
>    on its own branch, and the entry is deleted when it lands.

D107's propose-then-confirm intent is preserved verbatim — widened from rule
sharpenings to every kind of finding, and given a durable home instead of chat.
The new decision cites `Supersedes: D107`.

### 5. The Deferred/Findings boundary

`DECISIONS.md`'s Deferred section gains one line:

> Unbuilt things defer here. Broken things go to `FINDINGS.md`.

and the `check-context-map.sh` false-positive entry is moved out of the run-on
line into `FINDINGS.md` as `F5`. The 501 capture-mode entry stays: it is a
genuine unbuilt capability, not a defect.

This migration is the assignment, not a finding — this spec is what establishes
the boundary, so drawing it is in scope.

### 6. Seeding, and the dogfood

`FINDINGS.md` ships holding `F1`–`F5`: the four contradictions in the Problem
table plus the migrated `F5`. `highest-issued: F5`.

**This spec logs all five and fixes none of them** — including `F2`, the
`graphify` rule, which is Spec 3's entire subject and which an agent could close
in one line. That restraint is the point. A spec that establishes "log, do not
fix" and then fixes four easy things on its way past has demonstrated that the
rule yields to convenience, and every later agent will read it that way. The
seeded log is the rule's first test, and passing it costs four fixes.

The single exception is the `git worktree` allowlist entry, removed during this
spec's own drafting — on explicit user instruction, which is exactly the
permission the rule requires. It models the sanctioned path rather than
breaking it.

## Files

| File | Change |
| ---- | ------ |
| `FINDINGS.md` | new — front-matter, how-to-add, `F1`–`F5` |
| `CLAUDE.md` | new Hard Invariant; "Where Everything Lives" row |
| `scripts/check-findings-log.sh` | new — gate 16 |
| `.husky/pre-commit` | add gate (12 scripts) |
| `.github/workflows/quality.yml` | add gate (16 scripts) |
| `.claude/skills/context-maintenance/SKILL.md` | step 8 rewritten; description updated |
| `DECISIONS.md` | boundary line; `check-context-map.sh` entry removed from Deferred |
| `decisions/context-system.md` | D214, `Supersedes: D107` |
| `docs/architecture/00-File-Inventory.md` | rows for `FINDINGS.md`, the new script |
| `docs/architecture/00-Context-Map.md` | one pointer line |
| `docs/architecture/00-Context-Map-History.md` | version entry |
| `.claude/settings.json` | `Bash(git worktree:*)` removed (done, by instruction) |

## Verification

- `bash scripts/check-findings-log.sh` exits 0 on the seeded log.
- It **fails** when deliberately fed each of: a block missing a field, a
  duplicate id, an id above the high-water mark, `Status: Resolved`, an
  `Evidence:` path that does not exist, a non-ISO date. A gate not proven to
  bite is not a gate.
- The full gate suite passes: `run-all-gates`.
- `grep -c '^### F' FINDINGS.md` returns 5; `highest-issued` reads `F5`.
- Per-session floor measured after the `CLAUDE.md` edit; expected ~3.2k → ~3.3k.
