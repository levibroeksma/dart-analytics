<!--
status: canonical
scope: open findings — defects and contradictions noticed but deliberately not fixed
read-when: triaging what to fix next; never loaded by a task
updated: 2026-08-20
highest-issued: F9
-->

# Findings

> Things an agent noticed while doing something else. A finding is **not** a
> work item: it is logged here and named in the completion report, never fixed
> in the same pass. Acting on one requires explicit user permission, and is a
> new task on its own branch. (Root `CLAUDE.md`, Hard Invariants; D214.)
>
> **Opposite lifecycle to `DECISIONS.md`.** Decisions are permanent and
> append-only. Findings are open until closed, and a closed finding is
> **deleted** — the record of the fix is the commit that fixed it, plus a
> decision in `decisions/**` where the fix embodied a real choice. Nothing
> accumulates here.
>
> Guarded by `scripts/check-findings-log.sh`.

## How to add a finding

- Next id is `highest-issued` in the front matter **plus one**. Bump that line
  in the same edit. Ids are never reused — because entries are deleted, the id
  cannot be derived by scanning the file, which is exactly what the high-water
  mark is for.
- `Status:` is `Open` (logged, not yet shown to the user) or `Raised` (named in
  a completion report). There is no `Resolved`: when a finding is fixed, delete
  its block.
- `Evidence:` cites at least one real path, optionally with a `:line` locator.
  The gate checks every cited path still exists, so a finding whose subject was
  deleted or moved fails the build until the entry is corrected or removed.
- Block format:

```markdown
### F<next> — Short statement of what is wrong
Status: Open · Found: YYYY-MM-DD · Task: <branch>
Claim: what the repo asserts
Evidence: `path/to/file.md:12` vs what is actually true
Impact: what it costs an agent that trusts the claim
Proposed: the smallest change that would resolve it — a proposal, not a plan
```

---

### F1 — `permissions.allow` pre-approves a CLI that is not installed
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `.claude/settings.json:20-22` grants `Bash(gh pr view:*)`, `Bash(gh pr list:*)` and `Bash(gh pr diff:*)`
Evidence: `.claude/settings.json:20` — `command -v gh` finds nothing in the session container; GitHub access runs through the `mcp__github__*` tools instead
Impact: an agent reading the allowlist as a capability inventory tries `gh pr diff`, gets a shell error, and spends a round discovering the MCP tools it should have used first
Proposed: drop the three `gh` entries, or keep them and note in the settings file that they cover a locally-installed `gh` only

### F3 — `DECISIONS.md` states a stale maximum decision id
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: "How to add a decision" names `D198` as the current maximum
Evidence: `DECISIONS.md:45` vs the derived max `D213`; the same line's ID-gap note at `DECISIONS.md:62` independently says `D212`
Impact: an agent trusting either number issues a colliding id; the derive command on the same line is correct, so the stale figures are pure trap
Proposed: drop both parentheticals and keep only the derive command, so there is no number to go stale

### F4 — `.graphifyignore` excludes a directory the invariants make impossible
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `.graphifyignore:6` ignores `.worktrees/`
Evidence: `.graphifyignore:6` vs `CLAUDE.md`'s "No git worktrees" hard invariant (D102), which forbids the directory from ever existing
Impact: small — a dead ignore line. It is logged because it is exactly the kind of residue that reads as evidence the practice is allowed
Proposed: delete the line

### F5 — A broken script is filed as a deferred feature
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `scripts/check-context-map.sh`'s migration-range regex cannot tell a seed range from a migration range, so a seed chain quoted as ending at `0003` is compared against the migration chain end and fails
Evidence: `scripts/check-context-map.sh` — the check at its "2. Migration range consistency" section; the workaround was to reword the affected doc line, leaving the script deliberately unfixed (2026-07-26)
Impact: the defect sat in `DECISIONS.md`'s Deferred list among eleven unbuilt features, where "we chose not to build this" and "this is broken" are indistinguishable
Proposed: narrow the regex to skip lines naming seeds — partly done for `decisions/**` and seed lines by D194, but the seed-vs-migration ambiguity itself remains

### F6 — The file inventory still describes `AGENT.md` as a byte-identical mirror
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `docs/architecture/00-File-Inventory.md` describes `scripts/check-agent-mirrors.sh` as asserting "every `CLAUDE.md` has a byte-identical `AGENT.md` sibling", and the `AGENT.md` row as an "Exact mirror of the sibling `CLAUDE.md` … edit both together"
Evidence: `docs/architecture/00-File-Inventory.md` — both rows, against D213 in `decisions/context-system.md`, which reduced all six `AGENT.md` files to pointer stubs and inverted the gate to assert the stub
Impact: an agent following the inventory copies rules into an `AGENT.md` and the inverted gate rejects the commit; the stale row says to do the exact thing the gate now forbids
Proposed: restate both rows against the stub behaviour D213 actually shipped

### F7 — Per-game capability verification scripts each assert the complete capability set
Status: Open · Found: 2026-08-19 · Task: claude/consistency-spec3
Claim: `database/verification/0010_around_the_clock_capability_checks.sql` is scoped to the one additive `AROUND_THE_CLOCK_V1` row, but its check 2 asserts "the table now holds exactly the 12 triples", i.e. every earlier game's rows too
Evidence: `database/verification/0010_around_the_clock_capability_checks.sql` header check 2, and the same shape in `database/verification/0009_121_capability_checks.sql`
Impact: game ten's seed makes both scripts fail on their exact-count assertion, so adding a game means either editing every earlier per-game verification script or knowingly leaving them stale — neither is what a per-game, additive script implies
Proposed: keep the exact-count parity assertion in the one shared `0007_capability_seed_checks.sql` and narrow the per-game scripts to their own rows

### F8 — One of the six preset setup files lost its shared doc line
Status: Open · Found: 2026-08-19 · Task: claude/consistency-spec3
Claim: five of the six preset-driven setup data modules carry the JSDoc line "V1 seeds exactly one configuration preset; index 0 is always that preset"; `doubles-training-setup.data.ts` carries none
Evidence: `app/src/lib/game/doubles-training-setup.data.ts` against its five siblings, e.g. `app/src/lib/game/bobs27-setup.data.ts`
Impact: cosmetic only — the fact is now stated once on `createPresetSetupController` itself, so the per-file line is arguably redundant in all six rather than missing in one
Proposed: decide once — either drop the line from all six now that the factory documents it, or add it to the sixth

### F9 — A game-frontend plan written one-commit-per-task collides with `check-game-wiring.sh`'s atomicity requirement
Status: Open · Found: 2026-08-20 · Task: claude/tuod-implementation-2lb1mh
Claim: `docs/architecture/07-Frontend/09-Adding-A-Game.md`'s touch list, and a plan written by `writing-plans` from it, break a new game's frontend into sequential per-file tasks (setup controller, setup page, play controller, play page, wiring), each with its own commit
Evidence: `scripts/check-game-wiring.sh`'s "3a"/"3b" checks require a ruleset to be fully wired (both setup/play data modules, both pages, both Alpine registrations, and its games-visibility card) or fully absent — "half a row is a failure whichever half it fell on" — in the state of every commit, not just the final one; TUOD's frontend plan (`docs/superpowers/plans/2026-08-20-tuod-frontend.md`) called for one commit per task, and the first task's commit (setup controller alone) failed the pre-commit `game-wiring` hook because `app/src/lib/game/tuod-setup.data.ts` existed while `app/src/lib/game/rulesets/games-visibility.ts` still had no `TUOD_V1` card
Impact: an agent following either the doc's task breakdown or a plan written from it hits a rejected pre-commit hook on the first task, discovers the constraint only by trial, and must fall back to committing the whole frontend fan-out in one commit instead of the plan's intended per-task history
Proposed: note the atomicity requirement in `09-Adding-A-Game.md` (e.g., "land all six trees in one commit, or hold every task's changes uncommitted until wiring lands") so a future plan is written commit-shape-aware from the start
