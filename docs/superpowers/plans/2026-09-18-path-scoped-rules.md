# Path-Scoped Instruction Layer (F2 + F3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the rules that only matter inside one directory out of the always-on `app/CLAUDE.md` and into files that load when that directory is touched.

**Architecture:** Five new directory `CLAUDE.md` files (each with its mandatory `AGENT.md` stub) plus, if a probe confirms the mechanism, one `.claude/rules/game-engines.md` scoped by `paths:` for the glob no directory expresses. `00-Context-Map.md` stays the sole authority — every new file is a pointer into it, never a copy.

**Tech Stack:** Markdown, Bash, Python 3 (existing gate scripts).

**Spec:** `docs/superpowers/specs/2026-09-18-agent-context-hardening-implementation-design.md` — Branch 3.

**Branch:** `refactor/path-scoped-rules`, off latest `origin/main` **after plan 2's PR has merged** (both edit `app/CLAUDE.md` and `scripts/check-doc-links.sh`).

**Decision id:** D316 (reserved; re-derive at Task 8).

---

## Global Constraints

- **Branch first.** `git fetch origin && git switch -c refactor/path-scoped-rules origin/main`. Never commit on `main`.
- **Never `--no-verify`.**
- **Extreme concision in commit messages.**
- **Every commit message ends with:** `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **PR body ends with:** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- **Decisions are append-only.**
- **Discovered work → GitHub issue**, never fixed in this pass.
- **Every new `CLAUDE.md` needs an `AGENT.md` sibling** whose content is *exactly* the stub in Task 2, Step 1. `scripts/check-agent-mirrors.sh` auto-discovers via `git ls-files '*CLAUDE.md'` and runs in `.husky/pre-commit` — a missing or non-identical stub refuses the commit.
- **A pointer, never a copy.** If text moves out of `app/CLAUDE.md`, delete it there in the same commit. Two copies of a rule is the drift this whole branch exists to prevent.
- **No runtime code, no migrations.** Do not run `npm test` or `validate:app` and do not claim them.

---

## The rule that decides what moves

Not a line count. **A rule that must fire *before* the directory is opened stays in `app/CLAUDE.md`; detail that only matters once you are already working in the directory moves.**

The mechanism is read-triggered: a directory's `CLAUDE.md` loads when a file in that directory is read. So "put tests under `app/tests/` mirroring `app/src/`" must stay app-wide — you need it before you have opened anything in `app/tests/`. But "use Vitest mocks, never real Neon calls" can move, because by then you are in the file.

**On the line-count target.** The spec says ~85–90 lines from 145. Measured against the actual removals this plan makes, the reachable figure is **~100–108**, and plan 2 has already taken the file to ~133. The spec's number was arrived at by subtraction without the pointer lines and retained one-liners this plan adds back. Treat ~100–108 as the expected consequence and **not** as a target to hit: if you find yourself deleting an app-wide rule to reach a number, stop — that is the failure mode the spec corrected the report for.

---

## File Structure

| File | Created / modified | Responsibility |
| --- | --- | --- |
| `scripts/check-doc-links.sh` | modify | Derive the `CLAUDE.md`/`AGENT.md` scan list from git instead of hardcoding six pairs |
| `app/src/services/CLAUDE.md` + `AGENT.md` | create | Service-layer pack pointer, UUIDv7 minting, the two ruleset registries, the Zod ↔ `chk_*` mirror |
| `app/src/components/CLAUDE.md` + `AGENT.md` | create | Style non-negotiables, `cn()`, `Button.astro` reuse, `{...props}`, Alpine shorthand |
| `app/src/stores/CLAUDE.md` + `AGENT.md` | create | `.store.ts` suffix, `$persist`, `PersistFactory` once per field (D120) |
| `app/src/modules/training/CLAUDE.md` + `AGENT.md` | create | `ExerciseEngine` contract, the no-clock rule, `ExerciseRulesetVersionKey` separation |
| `app/tests/CLAUDE.md` + `AGENT.md` | create | Vitest mocks, the `.astro` no-extraction carve-out (D101), the test-strategy pointer |
| `.claude/rules/game-engines.md` | create (probe permitting) | `GameEngine` contract for `**/*.engine.module.ts` across two directories |
| `app/CLAUDE.md` | modify | Trimmed to what is genuinely app-wide; scope-guide pointer list extended |
| `docs/architecture/00-Context-Map.md` | modify | Recompute the 11 pack budgets that price `app/CLAUDE.md` |
| `docs/architecture/00-File-Inventory.md` | modify | Register every new file |
| `docs/architecture/00-Context-Map-History.md` | modify | Version entry + Task Records row |
| `decisions/context-system.md` | modify | D316 |

---

### Task 1: Probe the `.claude/rules/` mechanism — gating, throwaway

**Files:** none committed. Everything this task creates is deleted before it ends.

**Interfaces:**
- Consumes: nothing.
- Produces: a yes/no that decides Task 5's shape. Record the answer in the PR body either way.

**Why this exists.** `strings -a` on binary `2.1.236` shows `.claude/rules` and `alwaysApply` are present in the build. That confirms the identifiers exist, **not** that a `paths:`-scoped rule file loads when a matching file is touched. Five of this branch's six new files use the directory-`CLAUDE.md` mechanism, which is already proven in this repo — `database/CLAUDE.md` does exactly this today. Only `.claude/rules/game-engines.md` rests on the unverified half. Ten minutes here decides whether it ships or is rehomed.

- [ ] **Step 1: Create a rule with an unmistakable marker**

```bash
mkdir -p .claude/rules
cat > .claude/rules/zzz-probe.md <<'EOF'
---
paths: ["**/*.engine.module.ts"]
---

PROBE-MARKER-7F3A: if you can see this string, a paths-scoped rule loaded.
EOF
```

- [ ] **Step 2: In a fresh session, touch a matching file and ask for the marker**

Open a new Claude Code session in this repo. Read `app/src/modules/game/bobs27.engine.module.ts`. Then ask, verbatim:

> Without searching the filesystem, is the string PROBE-MARKER-7F3A present in your context? Answer yes or no.

Also run `/context` and look for a `.claude/rules` or rules-related entry.

- [ ] **Step 3: Control — confirm the marker does *not* arrive unconditionally**

In another fresh session, read a non-matching file (`app/src/db/schema.ts` is denied by D314 — use `app/src/lib/utils/` instead) and ask the same question. A `yes` here means the rule loaded unconditionally, which is a different (and worse) answer than either expected one: it would mean `.claude/rules/` is always-on cost, not path-scoped.

- [ ] **Step 4: Record the result and delete the probe**

```bash
rm -rf .claude/rules
git status --short   # must be clean of anything under .claude/rules/
```

Write the outcome down for the PR body — one of:

- **PASS** (marker present after touching a matching file, absent after touching a non-matching one) → Task 5 ships `.claude/rules/game-engines.md` as written.
- **FAIL** (marker absent in both) → Task 5 takes the fallback: no rule file; the `GameEngine` contract goes into a new `app/src/modules/game/CLAUDE.md` + `AGENT.md` pair, and `app/src/modules/training/CLAUDE.md` carries a one-line pointer to it for the three exercise engines. This accepts the cross-directory duplication the glob was meant to avoid, and it is a graceful degradation, not a blocked branch.
- **UNCONDITIONAL** (marker present in both) → take the FAIL fallback anyway. A rule that loads on every session is `CLAUDE.md` with extra steps and worse discoverability.

- [ ] **Step 5: No commit**

This task commits nothing. If `git status` shows anything under `.claude/rules/`, remove it before continuing.

---

### Task 2: Derive the doc-link scan list from git

**Files:**
- Modify: `scripts/check-doc-links.sh` — the `pairs = [...]` literal inside `canonical_files()` (thirteen `Path(...)` entries) and the import block. Locate it by content, not line number: plans 1 and 2 both inserted lines above it.

**Interfaces:**
- Consumes: nothing.
- Produces: automatic doc-link coverage for every `CLAUDE.md`/`AGENT.md` this branch adds. Tasks 3–6 depend on this landing first — otherwise each new file's pointers go unchecked until someone remembers to extend a list.

**Why not just add five paths.** The spec names "add the five new `CLAUDE.md` files to `check-doc-links.sh`'s hardcoded list". Deriving the list is a strictly better way to satisfy that requirement: the hardcoded list is *why* the requirement exists, and it will silently miss the next directory guide exactly as it would have missed these five. `check-agent-mirrors.sh` and `check-context-map.sh` already derive their file sets from `git ls-files`; this makes the third gate consistent with them. `git ls-files` also excludes worktree copies for free, since both worktree roots are gitignored.

- [ ] **Step 1: Add the import**

In the `python3 - <<'PY'` heredoc in `scripts/check-doc-links.sh`, add to the import block (after `import re`):

```python
import subprocess
```

- [ ] **Step 2: Replace the hardcoded `pairs` list**

Delete the whole `pairs = [...]` literal (the 13 `Path(...)` entries) and the `for p in pairs:` loop that follows it, and put in their place:

```python
    # Every tracked CLAUDE.md / AGENT.md, derived rather than listed. The
    # hardcoded thirteen-path list this replaces would have silently missed
    # the five directory guides added alongside this change — a list that
    # must be remembered is the same class of defect as a rule that must be
    # remembered. git ls-files also excludes worktree copies for free: both
    # .worktrees/ and .claude/worktrees/ are gitignored.
    tracked = subprocess.run(
        ["git", "ls-files", "*CLAUDE.md", "*AGENT.md"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split()
    for ref in tracked:
        p = Path(ref)
        if p.is_file():
            files.append(p)
    readme = Path("README.md")
    if readme.is_file():
        files.append(readme)
```

- [ ] **Step 3: Confirm the file count is unchanged today**

```bash
bash scripts/check-doc-links.sh
```

Expected: `OK: doc links and path-like references resolve (N files scanned).` with the same `N` as before the edit — the repo has exactly the six pairs the old list named (`AGENT.md`, `CLAUDE.md`, `app/AGENT.md`, `app/CLAUDE.md`, `app/src/db/*`, `app/src/pages/api/*`, `database/*`, `docs/*`) plus `README.md`. A different `N` means the derivation found something the list missed — read what, then keep the derivation.

- [ ] **Step 4: Prove the derivation picks up a new pair**

```bash
mkdir -p app/src/stores
printf -- '# Agent Rules — probe\n\nSee `docs/architecture/00-Not-Real.md`.\n' > app/src/stores/CLAUDE.md
git add -N app/src/stores/CLAUDE.md
bash scripts/check-doc-links.sh; echo "exit=$?"
```

Expected: `FAIL: app/src/stores/CLAUDE.md: unresolved path-like reference \`docs/architecture/00-Not-Real.md\`` and `exit=1`. A new guide is covered the moment it is tracked, with no list to update.

- [ ] **Step 5: Remove the probe and confirm green**

```bash
git rm --cached -q app/src/stores/CLAUDE.md
rm -f app/src/stores/CLAUDE.md
bash scripts/check-doc-links.sh; echo "exit=$?"
```

Expected: the `OK:` line and `exit=0`.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-doc-links.sh
git commit -m "$(cat <<'EOF'
refactor: derive the doc-link CLAUDE.md scan list from git ls-files

The hardcoded thirteen-path list is why "remember to add the new guides"
was a plan step. Deriving it removes the step permanently, matches what
check-agent-mirrors and check-context-map already do, and excludes
worktree copies for free.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `app/src/services/CLAUDE.md`

**Files:**
- Create: `app/src/services/CLAUDE.md`, `app/src/services/AGENT.md`

**Interfaces:**
- Consumes: Task 2's derived scan list.
- Produces: the `AGENT.md` stub text used verbatim in Tasks 4, 5 and 6.

**Scope correction against the spec.** The spec's table says this file "carries, relocated from `app/CLAUDE.md`" the Controller→Service→Repository layering and UUIDv7 minting. Those are two of the ten Non-Negotiables (lines 52 and 54) and the same spec says eight of the ten are app-wide and stay — only the two engine bullets move. Both statements cannot hold. **Resolution: the layering and UUIDv7 one-liners stay in `app/CLAUDE.md`**; this file carries the service-directory detail that is not there today, in the shape `database/CLAUDE.md` already uses — a pack pointer plus directory-specific rules. Nothing is deleted from `app/CLAUDE.md` by this task.

- [ ] **Step 1: Write the `AGENT.md` stub**

This exact content, byte for byte. `scripts/check-agent-mirrors.sh` string-compares it.

```bash
mkdir -p app/src/services
cat > app/src/services/AGENT.md <<'EOF'
# AGENT.md

Not a rule source. The authority for this directory is the sibling
`CLAUDE.md` — read that instead. Rules live there and only there.
EOF
```

- [ ] **Step 2: Write the guide**

Create `app/src/services/CLAUDE.md`:

```markdown
# Agent Rules — `app/src/services/`

Scope: the service layer — domain workflows between route handlers and repositories. Load the "New API endpoint" or "API middleware / layering change" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. Global app rules and the validation procedure live in `app/CLAUDE.md`. (2026-09-18)

## Rules

- Handlers stay thin; this layer owns the workflow. Never parse a JWT here — middleware verifies identity, services handle domain authorization.
- Mint UUIDv7 here for every runtime persistence record. The database never generates ids, and neither does the handler.
- Reads go through views (`v_*`); writes go to runtime tables inside a transaction.
- **Request schemas mirror the column CHECK constraints of the tables they write.** A bound the database enforces (`chk_*` in `database/migrations/`) belongs beside the field's type in the shared Zod schema, once — not restated per ruleset validator, which keeps only ruleset rules. A value the schema lets through and the database rejects aborts the write transaction and fails the whole batch with a 500 instead of a `VALIDATION_FAILED` naming the offending record. `scripts/check-constraint-mirror.sh` enforces the anchor.
- **Two ruleset registries, kept apart.** `services/rulesets/registry.ts` holds game rulesets; `services/exercise-rulesets/registry.ts` holds exercise rulesets, and `ExerciseRulesetVersionKey` never enters the game union (D264). `scripts/check-game-wiring.sh` requires every key in the game registry to declare a capture/input mode pair, which an exercise has neither of.
- A new game engine's `rulesetVersionKey` and its server-side validator here must land in the **same commit** — `scripts/check-game-engines.sh` runs pre-commit and rejects one without the other, so a plan that splits them into separate commits cannot land as drafted.
```

- [ ] **Step 3: Verify the mirror gate accepts the stub**

```bash
bash scripts/check-agent-mirrors.sh
```

Expected: `OK: every AGENT.md is the pointer stub redirecting to its CLAUDE.md.` If it reports `app/src/services/AGENT.md is not the pointer stub`, the heredoc picked up an edit — rewrite it from Step 1 exactly.

- [ ] **Step 4: Verify every path reference resolves**

```bash
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
```

Expected: `OK:` from both. `check-context-map.sh` check 1 scans every tracked `*CLAUDE.md` for backticked `.md`/`.sh`/`.sql` refs, so it is what proves `scripts/check-constraint-mirror.sh`, `scripts/check-game-wiring.sh` and `scripts/check-game-engines.sh` all exist.

- [ ] **Step 5: Commit**

```bash
git add app/src/services/CLAUDE.md app/src/services/AGENT.md
git commit -m "$(cat <<'EOF'
docs: scope guide for app/src/services/

Pack pointer plus the service-directory rules that were nowhere: the two
ruleset registries and their separation (D264), the Zod/chk_* mirror, and
the same-commit rule for a new engine's validator.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `app/src/components/CLAUDE.md` and `app/src/stores/CLAUDE.md`

**Files:**
- Create: `app/src/components/CLAUDE.md`, `app/src/components/AGENT.md`
- Create: `app/src/stores/CLAUDE.md`, `app/src/stores/AGENT.md`
- Modify: `app/CLAUDE.md` — the Handbook line and the Style non-negotiables block

**Interfaces:**
- Consumes: the `AGENT.md` stub from Task 3, Step 1.
- Produces: an `app/CLAUDE.md` with the style block and the store half of the Handbook line removed.

**Why one task.** Both files are carved out of the same two `app/CLAUDE.md` regions. Splitting them would mean two commits editing the same line of the Handbook sentence.

- [ ] **Step 1: Write both `AGENT.md` stubs**

```bash
mkdir -p app/src/components app/src/stores
for d in app/src/components app/src/stores; do
cat > "$d/AGENT.md" <<'EOF'
# AGENT.md

Not a rule source. The authority for this directory is the sibling
`CLAUDE.md` — read that instead. Rules live there and only there.
EOF
done
```

- [ ] **Step 2: Write `app/src/components/CLAUDE.md`**

This is the current `app/CLAUDE.md` **Style non-negotiables** block (lines 136–145 before this branch, verbatim) plus the Alpine half of the Handbook line, with a pack pointer on top:

```markdown
# Agent Rules — `app/src/components/`

Scope: Astro components — `ui/`, `forms/`, `layout/`. Load the "Frontend page / component work" or "New portable UI primitive" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. Global app rules and the validation procedure live in `app/CLAUDE.md`. (2026-09-18)

## Style non-negotiables

- Semantic tokens only — `surface` / `foreground` / `muted*` / `accent*` / states; never `bg-bg*` / `text-fg*` or raw palette utilities
- Reuse primitives from `app/src/styles/global.css`; do not reinvent per screen
- **Reuse existing UI components before hand-rolling markup.** A standalone action always renders through `components/forms/Button.astro` (`variant`/`icon`/`ariaLabel`/`loadingExpr`) — never a raw `<button>` with manually composed classes. Check `components/ui/` and `components/forms/` for a fitting component before writing new markup for any recurring UI shape (buttons, modals, form controls). If nothing fits, say so and propose a new component rather than hand-rolling one inline. Exempt: multi-part custom controls a shared primitive cannot express as-is — e.g. roving-tabindex `role="radio"` options carrying a label + checkmark (`AppModeForm.astro`, `HandednessForm.astro`) — which stay raw markup by established precedent. (2026-08-11; AppModeForm's caption dropped 2026-08-26)
- Build-time class composition via `cn()` only — never `class:list` (enforced by `scripts/check-astro-class-composition.sh`)
- Forward leftover attributes as `{...props}` — never `{...rest}`
- Never `font-medium` — use `font-normal` / `font-semibold` / `font-bold`
- Tailwind v4 utilities only — no important modifier at all, neither prefix (`!utility`) nor suffix (`utility!`); compose overrides through `cn()`'s merge ordering, or extend the primitive's own variant/prop surface when its defaults conflict; arbitrary negatives as `left-[-45%]`, never `-left-[45%]`
- Full rules: `docs/architecture/07-Frontend/07-Style-Guide.md` (visual) and `07-Frontend/05-Astro-Components.md` (class composition / props); `font-medium`/`{...rest}`/raw palette utilities/Tailwind important modifier (either form) + `-prop-[…]` mechanically enforced by `scripts/check-style-tokens.sh` (2026-07-31; important-modifier ban widened to suffix form 2026-08-21)

## Alpine

- Alpine v3 shorthand: `:attr`, `@event` — not `x-bind`/`x-on`, except the Astro `{}` linter escape.
- No `x-init`. Use `x-data="factory()"`.
- Every `x-show` needs `x-cloak` (`scripts/check-astro-conventions.sh`); no HTML comments in template regions.
- Keep variant/branching logic inline in the component's own frontmatter — do not extract a helper file solely to make it testable; there is no Astro-component test runner here (D101).
- No `.ts` file lives directly under `components/` (`scripts/check-file-locations.sh`). Shared logic goes to `app/src/lib/<domain>/`.
```

- [ ] **Step 3: Write `app/src/stores/CLAUDE.md`**

```markdown
# Agent Rules — `app/src/stores/`

Scope: Alpine stores. Load the "Frontend gameplay / session features" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. Global app rules and the validation procedure live in `app/CLAUDE.md`. (2026-09-18)

## Rules

- File suffix is `.store.ts`. Stores live here and nowhere else.
- `$persist` is used **only** in stores — never in a component or a module.
- `PersistFactory` is created once per field (D120). Never reuse one `persist()` across store fields.
- Modules never import `@client/api`; a store is the boundary that talks to the client layer.
- Tests live at `app/tests/stores/`, mirroring this directory — never colocated.
```

- [ ] **Step 4: Cut the relocated text out of `app/CLAUDE.md`**

Two edits, both deletions of text now living elsewhere:

1. Delete the entire `**Style non-negotiables:**` block — the bold label line and all seven bullets (lines 136–145 in the pre-branch file), plus the blank line above it.
2. Rewrite the Handbook line (line 126 in the pre-branch file) to keep only what is still app-wide, dropping the Alpine and store clauses:

```markdown
Handbook 0.1.0 non-negotiables: file suffix conventions (`.data.ts`, `*.module.ts`); modules never import `@client/api`. Component and Alpine rules: `app/src/components/CLAUDE.md`. Store rules: `app/src/stores/CLAUDE.md`. (2026-07-17; split 2026-09-18)
```

- [ ] **Step 5: Confirm nothing was duplicated**

```bash
grep -c 'font-medium' app/CLAUDE.md app/src/components/CLAUDE.md
grep -c 'PersistFactory' app/CLAUDE.md app/src/stores/CLAUDE.md
```

Expected: `app/CLAUDE.md:0` for both, `1` for each new file. A `1` in `app/CLAUDE.md` means the text was copied rather than moved — delete it there.

- [ ] **Step 6: Run the gates this task can break**

```bash
bash scripts/check-agent-mirrors.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
bash scripts/check-style-tokens.sh
```

Expected: `OK:` from all four. `check-style-tokens.sh` is included because it scans `app/src/**/*.{astro,css}` — the new `.md` files are outside its scan set, and confirming it still passes proves nothing was accidentally written into a component.

- [ ] **Step 7: Commit**

```bash
git add app/src/components app/src/stores app/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: scope guides for components/ and stores/

Style non-negotiables and the Alpine half of the Handbook line move to
components/; the .store.ts / $persist / PersistFactory half moves to
stores/. Both deleted from app/CLAUDE.md in the same commit — a copy
would be the drift this branch exists to stop.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The engine rules — `modules/training/` and the `GameEngine` contract

**Files:**
- Create: `app/src/modules/training/CLAUDE.md`, `app/src/modules/training/AGENT.md`
- Create (probe PASS): `.claude/rules/game-engines.md`
- Create (probe FAIL / UNCONDITIONAL): `app/src/modules/game/CLAUDE.md`, `app/src/modules/game/AGENT.md`
- Modify: `app/CLAUDE.md` — delete the two engine Non-Negotiables

**Interfaces:**
- Consumes: Task 1's probe result; the `AGENT.md` stub from Task 3.
- Produces: an `app/CLAUDE.md` Non-Negotiable list of eight bullets, down from ten.

**Why the glob.** `*.engine.module.ts` files exist in two directories — nine under `app/src/modules/game/` and three under `app/src/modules/training/exercises/` (`double-pattern`, `switching`, `warm-up`). No single directory boundary expresses that trigger, which is the one case in this branch that a directory `CLAUDE.md` genuinely cannot cover.

- [ ] **Step 1: Write `app/src/modules/training/CLAUDE.md` and its stub**

```bash
mkdir -p app/src/modules/training
cat > app/src/modules/training/AGENT.md <<'EOF'
# AGENT.md

Not a rule source. The authority for this directory is the sibling
`CLAUDE.md` — read that instead. Rules live there and only there.
EOF
```

Create `app/src/modules/training/CLAUDE.md` carrying the text deleted from `app/CLAUDE.md` line 59:

```markdown
# Agent Rules — `app/src/modules/training/`

Scope: training routines and exercise engines. Load the "New non-game client tool (Trivia)" pack or `docs/architecture/09-Training/00-Overview.md` from `docs/architecture/00-Context-Map.md` before changing anything here. Global app rules and the validation procedure live in `app/CLAUDE.md`. (2026-09-18)

## Exercise engines

`modules/training/exercises/interfaces.ts`'s `ExerciseEngine<TState>` is a **parallel** contract to `GameEngine`, never built on top of it (D264). Non-game exercises — warm-ups and beyond — have no seats, no `rulesetVersionKey` from the game ruleset union, and take no dart input.

- **An exercise engine owns no clock.** State carries no elapsed-time field; the caller drives transitions with `advance()`.
- Its ruleset key (`ExerciseRulesetVersionKey`, `lib/training/exercises/rulesets/types.ts`) and its server-side validator (`services/exercise-rulesets/registry.ts`) stay out of `services/rulesets/registry.ts`, `RulesetVersionKey` and `RULESET_CAPABILITIES` — `scripts/check-game-wiring.sh` requires every key there to declare a capture/input mode pair, which an exercise has neither of.
- `modules/training/routines/training.module.ts`'s `TrainingEngine` orchestrates ordered steps across whichever `ExerciseEngine` each one resolves to, and likewise holds no clock. A routine's total duration is validated separately by `modules/training/routines/routine-duration.module.ts` (`09-Training/01-Routines.md` §7), since a `CHECK` constraint cannot sum sibling rows. (D264, 2026-09-10)

Exercise engine files here are still `*.engine.module.ts` — `double-pattern`, `switching` and `warm-up` under `exercises/`. The `GameEngine` contract does **not** apply to them.
```

- [ ] **Step 2 (probe PASS): Write `.claude/rules/game-engines.md`**

Skip to Step 3 if Task 1 returned FAIL or UNCONDITIONAL.

```bash
mkdir -p .claude/rules
```

Create `.claude/rules/game-engines.md` carrying the text deleted from `app/CLAUDE.md` line 58:

```markdown
---
paths: ["**/*.engine.module.ts", "app/src/modules/game/**"]
---

# Game engines

Applies to `*.engine.module.ts` under `app/src/modules/game/`. Files under `app/src/modules/training/exercises/` share the suffix but **not** this contract — see `app/src/modules/training/CLAUDE.md` (D264).

Every `*.engine.module.ts` implements the `GameEngine` contract (`docs/architecture/04-Architecture-patterns.md` Pattern 18): constructed from a validated config snapshot bound to a `rulesetVersionKey`, owns its `EngineFacts` log, mints `clientKey`/`sequence`/`completedAt`/`participantRef`, rehydrates from persisted facts via `create(config, prior)`, and exposes a pure `wouldComplete(input)`.

- Every engine declares a static `stageOwnership` (`SHARED` | `PER_SEAT`) so `modules/game/seat-rota.module.ts` can derive the active seat from the fact log. `record()` takes no seat — it applies to the derived active seat, and the active seat is never stored. (2026-08-21)
- `undo()` is an exact inverse of `record()` over `facts()`, including any stage the record opened; undo depth is unbounded.
- `completedAt` is stamped when a visit resolves, never when it opens, and cleared when `undo()` reopens one.
- `state()` and `facts()` return derived copies — never a live field or a shared module constant. Anything a caller must change goes through a named method, not a write to a returned object.
- **Never store a value the fact log can derive** — no accumulated score, points, ratio or average fields.
- Compose log mechanics from `modules/game/turn-log.module.ts` and per-seat derivation from `modules/game/seat-state.module.ts` rather than re-declaring them. Copying a neighbouring engine's copy is what put `npx fallow` over its duplication gate once already (D232, 2026-08-23).
- A new engine's `rulesetVersionKey` and its server-side validator (`services/rulesets/registry.ts`) must land in the **same commit** — `scripts/check-game-engines.sh` runs pre-commit and rejects one without the other. (2026-08-14)
- `bash scripts/check-game-engines.sh` must pass. (2026-07-26)
```

- [ ] **Step 3 (probe FAIL or UNCONDITIONAL): the fallback instead**

Only if Step 2 was skipped. Create `app/src/modules/game/AGENT.md` with the exact stub, and `app/src/modules/game/CLAUDE.md` containing the same body as Step 2's rule file — minus the `---` frontmatter block, with a `# Agent Rules — \`app/src/modules/game/\`` heading and a scope line matching the other directory guides. Then append this line to `app/src/modules/training/CLAUDE.md`:

```markdown
The `GameEngine` contract that the nine engines under `app/src/modules/game/` implement is at `app/src/modules/game/CLAUDE.md`. It does not apply here.
```

Record in the PR body that the glob case could not be expressed and this is the accepted duplication.

- [ ] **Step 4: Delete both engine bullets from `app/CLAUDE.md`**

Remove the `- **Game engines.** …` bullet and the `- **Exercise engines.** …` bullet in full (lines 58 and 59 of the pre-branch file). The Non-Negotiable Rules list goes from ten bullets to eight. Then extend the scope-guide sentence on line 3 — see Task 7, which does it once for all five guides.

- [ ] **Step 5: Confirm the contract text exists in exactly one place**

```bash
grep -rn 'stageOwnership' --include='*.md' . | grep -v docs/superpowers | grep -v node_modules
```

Expected: exactly one Markdown hit outside `docs/architecture/` — either `.claude/rules/game-engines.md` or `app/src/modules/game/CLAUDE.md`, never both, and never `app/CLAUDE.md`.

- [ ] **Step 6: Run the gates**

```bash
bash scripts/check-agent-mirrors.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
bash scripts/check-game-engines.sh
```

Expected: `OK:` from all four. `check-game-engines.sh` is the one that would notice if moving the contract text broke a reference it reads.

- [ ] **Step 7: Commit**

```bash
git add app/src/modules app/CLAUDE.md .claude/rules 2>/dev/null; git add app/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: engine contracts move to where they fire

GameEngine goes to the path-scoped rule (probe confirmed), ExerciseEngine
to modules/training/. app/CLAUDE.md's Non-Negotiables: 10 bullets -> 8.

The two contracts are parallel, never nested (D264), and the .engine.module.ts
suffix spans both directories — which is why one of them is a glob.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

Adjust the first line of the body if the probe failed and the fallback was taken.

---

### Task 6: `app/tests/CLAUDE.md`

**Files:**
- Create: `app/tests/CLAUDE.md`, `app/tests/AGENT.md`
- Modify: `app/CLAUDE.md` — the TDD `Rules:` bullets

**Interfaces:**
- Consumes: the `AGENT.md` stub from Task 3.
- Produces: the last of the five directory guides.

**What stays behind, and why.** The placement rule — "tests live under `app/tests/`, mirroring `app/src/`, never colocated" — **stays in `app/CLAUDE.md`**. It has to fire before you open anything in `app/tests/`, and a directory guide loads on read. The two bullets that only matter once you are writing the test move.

- [ ] **Step 1: Write the stub**

```bash
mkdir -p app/tests
cat > app/tests/AGENT.md <<'EOF'
# AGENT.md

Not a rule source. The authority for this directory is the sibling
`CLAUDE.md` — read that instead. Rules live there and only there.
EOF
```

- [ ] **Step 2: Write the guide**

Create `app/tests/CLAUDE.md`:

```markdown
# Agent Rules — `app/tests/`

Scope: the Vitest suite. Load the "New test / test-strategy question" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. The red→green→refactor procedure and the `npm test` commands are in `app/CLAUDE.md` §Test-Driven Development — that section is the sole definition (D99). (2026-09-18)

## Rules

- Mirror `app/src/`'s (and `app/scripts/`'s) directory structure. `app/src/lib/game/foo.ts` is tested by `app/tests/lib/game/foo.test.ts`. Never colocate a test beside the module under test.
- Test pure functions, stores, clients and utilities with Vitest mocks. **No real network or Neon calls in unit tests.**
- `.astro` markup is not unit-tested — there is no Astro-component test runner in this project. Keep variant/branching logic inline in the component's frontmatter and do **not** extract a helper file solely to make it testable (D101).
- A changed source file needs a changed covering test: `scripts/check-test-coverage.sh` fails any change set touching a runtime `.ts` under `app/src/` or `app/scripts/` without also touching a test that imports it. There is no per-file silencer — if a file has no covering test, write one (D224).
- Shared-mock promotion threshold and the full-suite-always-runs policy: `docs/architecture/07-Frontend/06-Test-Strategy.md`.
- Framework is **Vitest** (`vitest.config.ts` at `app/` root). Every alias in `tsconfig.json`'s `compilerOptions.paths` must also exist in `vitest.config.ts`'s `resolve.alias` — an alias used only inside `vi.mock(...)` factories can pass without ever resolving for real.
```

- [ ] **Step 3: Trim `app/CLAUDE.md`'s TDD Rules block**

In the `## Test-Driven Development (mandatory)` section, the `Rules:` list keeps only the placement bullet and gains a pointer. Replace the three-bullet list with:

```markdown
Rules:

- Place tests under `app/tests/`, mirroring `app/src/`'s (and `app/scripts/`'s) directory structure — never colocated beside the module under test.
- Everything else about writing them — Vitest mocks, the `.astro` no-extraction carve-out (D101), the coverage gate — is in `app/tests/CLAUDE.md`.
```

Also delete the now-redundant `Framework: **Vitest** (\`vitest.config.ts\` at \`app/\` root).` line and the `Ground rules beyond the procedure above …` line, both of which the new guide carries.

- [ ] **Step 4: Confirm no duplication and that the procedure stayed put**

```bash
grep -c 'Red → green → refactor' app/CLAUDE.md app/tests/CLAUDE.md
grep -c 'D101' app/CLAUDE.md app/tests/CLAUDE.md
```

Expected: `app/CLAUDE.md:1` and `app/tests/CLAUDE.md:0` for the procedure — it is the sole definition and does not move. `app/CLAUDE.md:0` and `app/tests/CLAUDE.md:1` for D101.

- [ ] **Step 5: Run the gates**

```bash
bash scripts/check-agent-mirrors.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
bash scripts/check-test-coverage.sh
```

Expected: `OK:` from all four.

- [ ] **Step 6: Commit**

```bash
git add app/tests/CLAUDE.md app/tests/AGENT.md app/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: scope guide for app/tests/

Placement stays in app/CLAUDE.md — it must fire before the directory is
opened, and a directory guide loads on read. Mocks, the D101 carve-out
and the coverage gate move.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Final `app/CLAUDE.md` trim and the scope-guide index

**Files:**
- Modify: `app/CLAUDE.md` — delete the Astro documentation link list; extend the scope-guide sentence

**Interfaces:**
- Consumes: all five guides from Tasks 3–6 and Task 5's rule file, whose paths this task names.
- Produces: the final `app/CLAUDE.md` that Task 8 prices.

- [ ] **Step 1: Delete the `## Astro Documentation` section**

Remove the heading, the `Full documentation: https://docs.astro.build` line and all six bullets (lines 37–46 of the pre-branch file). Deleted outright, not relocated: it is six links to upstream Astro docs that any session can reach, restating a URL that is already on the line above them.

- [ ] **Step 2: Extend the scope-guide sentence on line 3**

Replace `Scope guides: \`app/src/db/CLAUDE.md\`, \`app/src/pages/api/CLAUDE.md\`.` with:

```
Scope guides: `app/src/db/CLAUDE.md`, `app/src/pages/api/CLAUDE.md`, `app/src/services/CLAUDE.md`, `app/src/components/CLAUDE.md`, `app/src/stores/CLAUDE.md`, `app/src/modules/training/CLAUDE.md`, `app/tests/CLAUDE.md` — each loads when you open a file in its directory, so you do not need to read them from here.
```

If Task 5 took the fallback, add `app/src/modules/game/CLAUDE.md` to that list.

- [ ] **Step 3: Measure the result**

```bash
wc -l app/CLAUDE.md
```

Expected: **100–108 lines**, from 145 before plan 2. If it is below 95, something app-wide was deleted — run `git diff origin/main -- app/CLAUDE.md` and check every removal against the rule at the top of this plan. If it is above 112, something that should have moved did not.

- [ ] **Step 4: Confirm what stayed is what should have stayed**

```bash
grep -n '^## ' app/CLAUDE.md
```

Expected headings: Development, Knowledge Graph (graphify), Non-Negotiable Rules, Comments, Formatting, Test-Driven Development (mandatory), Validation Standard Procedure (sole definition), Forbidden, Frontend Rules. Astro Documentation must be gone. Nothing else should have disappeared.

- [ ] **Step 5: Commit**

```bash
git add app/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: drop the Astro link list, index the scope guides

Six links to upstream docs under a line that already gives the URL.
app/CLAUDE.md: 145 -> ~105 lines across this branch and the last.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Budgets, registration, D316, and the PR

**Files:**
- Modify: `docs/architecture/00-Context-Map.md` — the 11 pack `~Budget` values that price `app/CLAUDE.md`
- Modify: `docs/architecture/00-File-Inventory.md` — rows for every new file
- Modify: `docs/architecture/00-Context-Map-History.md` — version entry + Task Records row
- Modify: `decisions/context-system.md` — D316

**Interfaces:**
- Consumes: every file this branch created or changed.
- Produces: green budgets. **This task is not optional.** `check-context-budget.sh` runs in `quality.yml` and would fail the PR.

**What is actually at risk.** `app/CLAUDE.md` has no `~Tokens` value in `00-File-Inventory.md` — its row is in a three-column table, so the per-file check (20% tolerance) never sees it. What does price it is `00-Context-Map.md`'s Context Packs table: **11 rows cite `app/CLAUDE.md`** — lines 32, 33, 34, 35, 36, 37, 39, 40, 47, 48 and 49. Per-pack tolerance is **30%**, and `app/CLAUDE.md` is one file among several in each pack, so several rows may still be inside tolerance. Recompute all 11 anyway; a value that is merely *inside tolerance* while being wrong is how drift accumulates.

- [ ] **Step 1: Recompute the 11 pack budgets**

```bash
python3 - <<'PY'
import re
from pathlib import Path
ROOT = Path(".")
ARCH = ROOT / "docs/architecture"
text = (ARCH / "00-Context-Map.md").read_text()
section = text.split("# Context Packs", 1)[1].split("# Authority Order", 1)[0]
def resolve(ref):
    if not ref.endswith(".md"):
        return None
    for c in (ARCH/ref, ARCH/"05-Database"/ref, ROOT/ref, ROOT/"docs"/ref, ROOT/"app"/ref):
        if c.is_file():
            return c
    return None
for m in re.finditer(r"\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(~[\d.]+k)\s*\|", section):
    task, load, claimed = (x.strip() for x in m.groups())
    if task == "Task type" or task.startswith("-"):
        continue
    if "app/CLAUDE.md" not in load:
        continue
    total = sum(len(p.read_text())/4/1000 for r in re.findall(r"`([^`]+)`", load)
                if (p := resolve(r)) is not None)
    r = round(total*10)/10
    new = f"~{int(r)}k" if r == int(r) else f"~{r}k"
    flag = "" if claimed == new else "   <-- UPDATE"
    print(f"{task:42} claimed={claimed:7} computed={new}{flag}")
PY
```

Edit `00-Context-Map.md` so every row this prints with `<-- UPDATE` carries the computed value. Change nothing else in that file — it is read at the start of every task and stays small.

- [ ] **Step 2: Verify the budget gate**

```bash
bash scripts/check-context-budget.sh
```

Expected: `OK: context-map per-file and per-pack token budgets within tolerance.`

- [ ] **Step 3: Register every new file in the File Inventory**

In §Context & history, replace the existing `app/CLAUDE.md` row's parenthetical to note the split, and add:

```markdown
| `app/src/services/CLAUDE.md` | Service-layer scope guide: pack pointer, UUIDv7 minting, the two separated ruleset registries (D264), the Zod ↔ `chk_*` mirror, the engine/validator same-commit rule (2026-09-18, D316) | canonical |
| `app/src/components/CLAUDE.md` | Component scope guide: the style non-negotiables and Alpine rules relocated from `app/CLAUDE.md` (2026-09-18, D316) | canonical |
| `app/src/stores/CLAUDE.md` | Store scope guide: `.store.ts` suffix, `$persist` only in stores, `PersistFactory` once per field (D120) (2026-09-18, D316) | canonical |
| `app/src/modules/training/CLAUDE.md` | Training scope guide: the `ExerciseEngine` contract, the no-clock rule and the `ExerciseRulesetVersionKey` separation, relocated from `app/CLAUDE.md` (2026-09-18, D316, D264) | canonical |
| `app/tests/CLAUDE.md` | Test scope guide: Vitest mocks, the `.astro` no-extraction carve-out (D101), the coverage gate; the red→green→refactor procedure stays in `app/CLAUDE.md` (2026-09-18, D316) | canonical |
| `.claude/rules/game-engines.md` | Path-scoped rule (`**/*.engine.module.ts`, `app/src/modules/game/**`): the `GameEngine` contract, relocated from `app/CLAUDE.md`. Uses a glob because the suffix spans two directories (2026-09-18, D316) | canonical |
```

If Task 5 took the fallback, replace the last row with an `app/src/modules/game/CLAUDE.md` row instead.

Also update the `AGENT.md` row's directory list to include the five (or six) new directories.

`check-skill-pointers.sh` asserts the `.claude/rules/*.md` row exists — that is plan 1's gate doing its job on the tree plan 1 could not see.

- [ ] **Step 4: Append the version entry**

Directly under `# Version History`:

```markdown
> **Version:** 1.86.0 (2026-09-18 — path-scoped rules: five new directory guides (`app/src/services/`, `app/src/components/`, `app/src/stores/`, `app/src/modules/training/`, `app/tests/`), each with its mandatory `AGENT.md` stub, plus `.claude/rules/game-engines.md` scoped by `paths:` for `**/*.engine.module.ts` — the one trigger no directory expresses, since the suffix spans `modules/game/` (9 files) and `modules/training/exercises/` (3). `app/CLAUDE.md` drops the style non-negotiables, the Alpine and store halves of the Handbook line, both engine Non-Negotiables (10 bullets → 8), the Astro upstream link list and two TDD detail bullets: 145 lines → ~105 across this branch and 1.85.0. The placement rule and the red→green→refactor procedure deliberately stay — a rule that must fire before its directory is opened cannot live in that directory's guide. `check-doc-links.sh` now derives its `CLAUDE.md`/`AGENT.md` scan list from `git ls-files` rather than a hardcoded thirteen-path list. The 11 Context Pack budgets pricing `app/CLAUDE.md` are recomputed. D316.)
>
```

- [ ] **Step 5: Derive the id and append D316**

```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

At the end of `decisions/context-system.md`:

```markdown
### D316 — Directory rules load with the directory; app/CLAUDE.md keeps only what is app-wide
Status: Accepted · Date: 2026-09-18
Decision: five directory guides are added — `app/src/services/`, `app/src/components/`, `app/src/stores/`, `app/src/modules/training/` and `app/tests/` — each with the mandatory `AGENT.md` pointer stub, joining the two that already existed under `app/src/`. The `GameEngine` contract moves to `.claude/rules/game-engines.md`, scoped by `paths: ["**/*.engine.module.ts", "app/src/modules/game/**"]`. `app/CLAUDE.md` loses the style non-negotiables, the Alpine and store clauses of the Handbook line, both engine Non-Negotiables, the Astro upstream link list and two TDD detail bullets — 145 lines to roughly 105, counting the graphify trim in D315. Every relocated rule is deleted from `app/CLAUDE.md` in the same commit that adds it elsewhere. `scripts/check-doc-links.sh` derives its `CLAUDE.md`/`AGENT.md` scan set from `git ls-files` instead of a hardcoded list.
Reason: `app/CLAUDE.md` was loaded in full on every `app/` task while roughly a third of it applied to one directory. The trigger already existed and was already proven here — `database/CLAUDE.md` opens by telling the reader which context pack to load, and fires only when `database/` is touched. What the repo lacked was coverage: two narrow directories had guides while `services/`, `components/`, `stores/`, `modules/` and `tests/` — where most work happens — had none. Extending a mechanism every gate already understands beat introducing a second one for the same job, which is why the research report's nine `.claude/rules/` files became one: four of the nine duplicated directory guides that already exist. The single glob is not a preference — `*.engine.module.ts` spans `modules/game/` and `modules/training/exercises/`, so no directory boundary expresses it.
Consequences: what moves is decided by when a rule must fire, not by how much text it saves. Test *placement* stays in `app/CLAUDE.md` because a directory guide loads on read and placement is needed before the first read; the red→green→refactor procedure stays for the same reason, and remains the sole definition (D99). That principle caps the reachable saving well above the research report's ~55–60 line target and above this branch's own spec figure of ~85–90; the measured landing point is ~105, and chasing a smaller number would mean deleting rules that genuinely are app-wide. `.claude/rules/game-engines.md` rests on a mechanism confirmed by a live probe before this branch committed to it — `strings` on binary 2.1.236 shows the identifiers exist, which is not evidence of semantics, and the documented fallback was to rehome the contract into `app/src/modules/game/CLAUDE.md` and accept the duplication the glob avoided. Seven directory guides now exist under `app/`, each a maintenance surface: a rule that belongs in two of them is a signal it belongs in `app/CLAUDE.md` instead. Nothing here is mechanically provable — no gate can assert that a guide was read when its directory was opened. The honest measure is `/context` before and after, which is an observation, not a test.
```

- [ ] **Step 6: Register this plan in Task Records**

```markdown
| `docs/superpowers/plans/2026-09-18-path-scoped-rules.md` | The 8-task plan for branch 3 (F2 + F3): the gating `.claude/rules/` probe with its documented fallback (Task 1), `check-doc-links.sh` derived from `git ls-files` (Task 2), then one task per directory guide — services (3), components + stores (4), the two engine contracts (5), tests (6) — the final `app/CLAUDE.md` trim (Task 7), and budgets + registration + D316 (Task 8). Corrects the spec on two points: the services guide does not relocate the layering and UUIDv7 Non-Negotiables (the same spec keeps eight of ten app-wide), and the reachable line target is ~100–108, not ~85–90 (2026-09-18) | historical |
```

- [ ] **Step 7: Run every applicable gate and report each result**

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-skill-pointers.sh
bash scripts/check-test-coverage.sh
bash scripts/check-decision-ids.sh
bash scripts/check-game-engines.sh
bash scripts/check-game-wiring.sh
bash scripts/check-style-tokens.sh
bash scripts/check-astro-conventions.sh
```

Expected: twelve `OK:` lines. The last four are included because this branch relocated rules those gates enforce — a relocation that broke a reference would surface there. State each result explicitly.

- [ ] **Step 8: Commit**

```bash
git add docs/architecture decisions/context-system.md
git commit -m "$(cat <<'EOF'
docs: register the path-scoped rules — budgets, inventory, 1.86.0, D316

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Finish the branch**

Invoke `superpowers:finishing-a-development-branch` with the `finishing-a-dart-branch` skill. Option 2, no menu.

PR body must carry: the probe result from Task 1 (all three outcomes are reportable results, not failures), the `wc -l app/CLAUDE.md` before and after, the recomputed pack budget table, and the two places this plan corrected the spec.

---

## What this branch does not prove

No gate can assert that a directory guide was read when its directory was opened. Pickup is unobservable from CI. The honest success measure is `/context` in a live session before and after, plus whether the two failures the research report recorded — docs not read at task start, docs not updated at task end — recur. That is an observation, not a test, and no part of this plan should be read as claiming otherwise.
