# Context Guardrails (F7 + F9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the four largest accidental context loads at the tool boundary, and make `.claude/skills/` and `.claude/rules/` files impossible to add without registering them.

**Architecture:** Two independent pieces on one branch. F7 is declarative — `permissions.deny` entries and `claudeMdExcludes` in `.claude/settings.json`, which the agent runtime reads, not CI. F9 is a new shell gate, `scripts/check-skill-pointers.sh`, in the same shape as the repo's other `check-*.sh` scripts: `set -u`, `cd` to the repo root, `err()` accumulator, `exit $FAIL`. It lands **before** the `.claude/rules/` tree exists (plan 3) so that tree is born covered rather than retrofitted.

**Tech Stack:** Bash, `git ls-files`, Python 3 (existing `check-doc-links.sh` only), GitHub Actions, husky.

**Spec:** `docs/superpowers/specs/2026-09-18-agent-context-hardening-implementation-design.md` — Branch 1.

**Branch:** `chore/context-guardrails`, off latest `origin/main`.

**Decision id:** D314 (reserved by the spec; re-derive at Task 5 and use whatever the command returns).

---

## Global Constraints

These apply to every task below. They are repo Hard Invariants, not plan choices.

- **Branch first.** `git fetch origin && git switch -c chore/context-guardrails origin/main`. Never commit on `main` — `.husky/pre-commit` refuses it.
- **Never `--no-verify`.** A pre-commit hook failure is fixed at its cause and re-staged.
- **Extreme concision in commit messages.** Sacrifice grammar for brevity.
- **Every commit message ends with:** `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **PR body ends with:** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- **Decisions are append-only.** Never edit or delete an existing block in `decisions/**`. New blocks go at the end of the domain file, after the existing table.
- **Discovered work is not a work item.** Anything noticed that this plan does not name is filed as a GitHub issue (`discovered-work` label) per the `capturing-discovered-work` skill and reported — never fixed in this pass. Adjacent edits a named step genuinely requires are normal work, not discovered work.
- **Context Maintenance is mandatory** before the task is claimed done (Task 5).
- **This branch touches no runtime code**, no migrations and no data. `npm test`, `validate:app` and the `app/`-specific gates have nothing to say about it; do not run them and do not claim them.

---

## File Structure

| File | Created / modified | Responsibility |
| --- | --- | --- |
| `.claude/settings.json` | modify | Declarative guardrails: four new `permissions.deny` entries + `claudeMdExcludes` |
| `scripts/check-skill-pointers.sh` | create | The F9 gate: registration of skills and rules, plus `superpowers:` pointer resolution |
| `scripts/check-doc-links.sh` | modify | Widen the scan set to `.claude/rules/*.md` |
| `.claude/skills/run-all-gates/SKILL.md` | modify | Register the new gate under §Always run |
| `.github/workflows/quality.yml` | modify | Register the new gate in the `structure` job |
| `.husky/pre-commit` | modify | Register the new gate in the local chain |
| `docs/architecture/00-File-Inventory.md` | modify | Row for the new script; refresh the `.claude/settings.json` row |
| `docs/architecture/00-Context-Map-History.md` | modify | Version entry + Task Records rows |
| `decisions/context-system.md` | modify | D314 |

---

### Task 1: Declarative guardrails in `.claude/settings.json` (F7)

**Files:**
- Modify: `.claude/settings.json:32-36` (the `permissions.deny` array) and the top level of the object

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks depend on. This task is independently revertible.

**Context:** `permissions.deny` currently holds exactly two entries, both `Bash(drizzle-kit …)`. There are no `Read(...)` deny rules and no `claudeMdExcludes` key today.

**Honest note on `claudeMdExcludes`:** `strings -a` on the installed binary (`/opt/homebrew/Caskroom/claude-code/2.1.236/claude`) shows the identifier is present. That confirms the string exists in the build, **not** that this key name and glob syntax are honoured. The key is additive and an unrecognised settings key is ignored, so the downside of being wrong is that it silently does nothing — not a breakage. Do not write a doc sentence claiming it works; Task 5's decision block must state the uncertainty as uncertainty.

- [ ] **Step 1: Capture the current file so the change is provably minimal**

```bash
cp .claude/settings.json /tmp/settings.before.json
```

- [ ] **Step 2: Add the four `Read(...)` deny entries**

Replace the `deny` array so it reads exactly:

```json
    "deny": [
      "Bash(drizzle-kit generate:*)",
      "Bash(drizzle-kit push:*)",
      "Read(./graphify-out/graph.json)",
      "Read(./.worktrees/**/*)",
      "Read(./.claude/worktrees/**/*)",
      "Read(./app/src/db/schema.ts)"
    ]
```

Why each one:
- `graphify-out/graph.json` — 7.7 MB; a whole-file read is roughly 1.9M tokens. Grep over it is unaffected (that runs through `Bash`), and grep is what root `CLAUDE.md` actually asks for.
- both worktree roots — a worktree is a second full copy of the repo. Both prefixes are listed because D312 moved the home to `.worktrees/` while pre-D312 worktrees under `.claude/worktrees/` stay populated until their branches land.
- `app/src/db/schema.ts` — `drizzle-kit introspect` output, regenerated not authored; the authority for schema is `database/migrations/`.

- [ ] **Step 3: Add `claudeMdExcludes` as a top-level key**

Insert after the `permissions` object, as a sibling of it:

```json
  "claudeMdExcludes": ["**/.worktrees/**", "**/.claude/worktrees/**"]
```

This stops a `CLAUDE.md` inside a worktree copy from being auto-loaded alongside the real one.

- [ ] **Step 4: Verify the file is still valid JSON and says what you meant**

```bash
python3 -c "import json;d=json.load(open('.claude/settings.json'));\
assert len(d['permissions']['deny'])==6, d['permissions']['deny'];\
assert d['claudeMdExcludes']==['**/.worktrees/**','**/.claude/worktrees/**'];\
print('OK: settings.json parses, 6 deny entries, claudeMdExcludes present')"
```

Expected: `OK: settings.json parses, 6 deny entries, claudeMdExcludes present`

- [ ] **Step 5: Verify nothing else moved**

```bash
diff <(python3 -c "import json;print(sorted(json.load(open('/tmp/settings.before.json'))))") \
     <(python3 -c "import json;print(sorted(json.load(open('.claude/settings.json'))))")
```

Expected: exactly one added key, `claudeMdExcludes`. `allow`, `hooks`, `enabledPlugins` and `extraKnownMarketplaces` must be untouched.

- [ ] **Step 6: Commit**

```bash
git add .claude/settings.json
git commit -m "$(cat <<'EOF'
chore: deny four accidental whole-file reads, exclude worktree CLAUDE.md

graph.json is ~1.9M tokens read whole; grep over it is unaffected and is
what root CLAUDE.md actually asks for. Both worktree roots are listed —
D312 moved the home to .worktrees/ while pre-D312 worktrees stay live.

claudeMdExcludes is present as a string in binary 2.1.236; its semantics
are unverified. Additive and ignored if unrecognised.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `scripts/check-skill-pointers.sh`, proven to bite (F9)

**Files:**
- Create: `scripts/check-skill-pointers.sh`
- Fixture (temporary, deleted in this task): `.claude/skills/fixture-unregistered/SKILL.md`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `bash scripts/check-skill-pointers.sh` — exit 0 with an `OK:` line, exit 1 with one `FAIL:` line per violation. Task 4 wires this exact command into three places. Plan 3 relies on assertion 2 already being live.

**Context:** the repo has six skills today — `capturing-discovered-work`, `context-maintenance`, `finishing-a-dart-branch`, `graphify`, `run-all-gates`, `validate-app`. All six are registered in `docs/architecture/00-File-Inventory.md` with a backticked path (lines 273–278). `.claude/rules/` does not exist yet, so assertion 2 iterates zero times and the gate lands green.

The eight `superpowers:<name>` mentions in tracked Markdown are `brainstorming`, `executing-plans`, `finishing-a-development-branch`, `subagent-driven-development`, `test-driven-development`, `using-git-worktrees`, `verification-before-completion`, `writing-plans`. All eight resolve under `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/`.

- [ ] **Step 1: Write the gate**

Create `scripts/check-skill-pointers.sh` with exactly this content:

```bash
#!/usr/bin/env bash
# Skill / rule pointer gate — Context Maintenance (root CLAUDE.md).
#
# D311's finding was that none of the eight vendored skill copies was
# registered in 00-File-Inventory.md, so no gate script ever read them and
# every upstream drift landed unobserved. This gate closes that for the
# files the repo does own. Three assertions:
#
#   1. every .claude/skills/*/SKILL.md is registered in 00-File-Inventory.md
#   2. every .claude/rules/*.md is registered in 00-File-Inventory.md
#   3. every `superpowers:<name>` named in a LIVE tracked Markdown file
#      resolves to a skill directory in the installed plugin cache
#
# Assertion 3 is SKIPPED, not failed, when the cache is absent: CI installs
# no plugins, so demanding it there would make the gate permanently red for
# a reason CI cannot fix. Local runs carry the check; CI runs 1 and 2.
#
# Assertion 3's scan set deliberately excludes the append-only and historical
# trees — decisions/**, docs/superpowers/**, docs/braindump/** and
# 00-Context-Map-History.md. D311's own Consequences paragraph records that
# mentions there are provenance, not live pointers, and decisions cannot be
# edited to follow an upstream rename even if one happened. This mirrors the
# carve-out check-doc-links.sh already makes for the same trees.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

INVENTORY="docs/architecture/00-File-Inventory.md"
FAIL=0
err() { echo "FAIL: $*" >&2; FAIL=1; }

if [ ! -f "$INVENTORY" ]; then
  echo "FAIL: missing $INVENTORY" >&2
  exit 1
fi

# --- 1 + 2. Registration ----------------------------------------------------
for f in $(git ls-files '.claude/skills/*/SKILL.md' '.claude/rules/*.md'); do
  grep -qF "\`$f\`" "$INVENTORY" \
    || err "$f is not registered in $INVENTORY"
done

# --- 3. superpowers: pointers resolve --------------------------------------
CACHE_ROOT="${SUPERPOWERS_CACHE_ROOT:-$HOME/.claude/plugins/cache/claude-plugins-official/superpowers}"
if [ ! -d "$CACHE_ROOT" ]; then
  echo "SKIP: plugin cache not found at $CACHE_ROOT — superpowers: pointers unchecked."
else
  NAMES=$(git grep -hoE 'superpowers:[a-z][a-z0-9-]*' -- '*.md' \
    ':!decisions' ':!docs/superpowers' ':!docs/braindump' \
    ':!docs/architecture/00-Context-Map-History.md' \
    | sed 's/^superpowers://' | sort -u)
  for name in $NAMES; do
    found=0
    for d in "$CACHE_ROOT"/*/skills/"$name"; do
      [ -d "$d" ] && { found=1; break; }
    done
    [ $found -eq 1 ] \
      || err "superpowers:$name does not resolve under $CACHE_ROOT"
  done
fi

[ $FAIL -eq 0 ] && echo "OK: skill/rule inventory rows present and superpowers: pointers resolve."
exit $FAIL
```

```bash
chmod +x scripts/check-skill-pointers.sh
```

- [ ] **Step 2: Run it on the repo as it stands — it must pass**

```bash
bash scripts/check-skill-pointers.sh
```

Expected: `OK: skill/rule inventory rows present and superpowers: pointers resolve.`, exit 0.

If it fails on a real skill, that skill genuinely lacks its inventory row — add the row, do not weaken the gate.

- [ ] **Step 3: Negative fixture A — an unregistered skill must fail**

`git ls-files` lists intent-to-add paths, so `git add -N` is enough to make the fixture visible without committing it.

```bash
mkdir -p .claude/skills/fixture-unregistered
printf -- '---\nname: fixture-unregistered\ndescription: throwaway gate fixture.\n---\n\n# Fixture\n' \
  > .claude/skills/fixture-unregistered/SKILL.md
git add -N .claude/skills/fixture-unregistered/SKILL.md
bash scripts/check-skill-pointers.sh; echo "exit=$?"
```

Expected: `FAIL: .claude/skills/fixture-unregistered/SKILL.md is not registered in docs/architecture/00-File-Inventory.md` and `exit=1`.

- [ ] **Step 4: Remove fixture A and confirm green again**

```bash
git rm --cached -q .claude/skills/fixture-unregistered/SKILL.md
rm -rf .claude/skills/fixture-unregistered
bash scripts/check-skill-pointers.sh; echo "exit=$?"
```

Expected: the `OK:` line and `exit=0`.

- [ ] **Step 5: Negative fixture B — a bogus `superpowers:` name must fail, with the cache present**

```bash
printf '\n<!-- fixture: superpowers:does-not-exist -->\n' >> README.md
bash scripts/check-skill-pointers.sh; echo "exit=$?"
```

Expected: `FAIL: superpowers:does-not-exist does not resolve under /Users/<you>/.claude/plugins/cache/claude-plugins-official/superpowers` and `exit=1`.

- [ ] **Step 6: Same fixture, cache absent — must SKIP, not fail**

```bash
SUPERPOWERS_CACHE_ROOT=/nonexistent bash scripts/check-skill-pointers.sh; echo "exit=$?"
```

Expected: `SKIP: plugin cache not found at /nonexistent — superpowers: pointers unchecked.`, then the `OK:` line, and `exit=0`. This is the CI path.

- [ ] **Step 7: Revert fixture B and confirm green**

```bash
git checkout -- README.md
bash scripts/check-skill-pointers.sh; echo "exit=$?"
```

Expected: the `OK:` line and `exit=0`. Confirm `git status --short` shows only `scripts/check-skill-pointers.sh`.

- [ ] **Step 8: Commit**

```bash
git add scripts/check-skill-pointers.sh
git commit -m "$(cat <<'EOF'
feat: gate skill and rule registration in the file inventory

D311's finding: none of the eight vendored skill copies was registered,
so no gate ever read them. Three assertions — skills registered, rules
registered (empty set today, so the plan-3 tree is born covered), and
superpowers: pointers resolve against the plugin cache.

Assertion 3 skips rather than fails without the cache; CI installs no
plugins and a permanently-red check CI cannot fix is not a gate.

Proven to bite on three fixtures: unregistered skill fails, bogus
superpowers: name fails with cache, same name skips without it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Widen `check-doc-links.sh` to `.claude/rules/*.md`

**Files:**
- Modify: `scripts/check-doc-links.sh:86` (inside `canonical_files()`)

**Interfaces:**
- Consumes: nothing.
- Produces: `.claude/rules/*.md` inside the doc-link gate's scan set, so plan 3's `game-engines.md` has its pointers checked from the day it lands.

**Scope decision, measured — read before editing.** The spec names widening to `.claude/skills/**/*.md` **and** `.claude/rules/*.md`, and flags the skills half as a risk that might balloon the branch. That risk was measured before this plan was written: running the widened gate surfaces exactly **8 failures, all in `.claude/skills/graphify/SKILL.md`**, all of them `references/*.md` paths that never existed in this repo — the fork copied `SKILL.md` without upstream's `references/` directory. The other five skills are clean.

Plan 2 deletes that file outright and replaces it with a ~30-line skill that has a real `references/building.md`. So fixing those eight lines here is work thrown away one branch later. **This task widens to `.claude/rules/*.md` only; plan 2 adds `.claude/skills/**/*.md` once the dangling references are gone with the file that held them.** That is the spec's own named fallback, chosen on measurement rather than on fear, and it costs no coverage: `check-skill-pointers.sh` (Task 2) already covers skills for registration from this branch on.

- [ ] **Step 1: Confirm the measurement still holds on your checkout**

```bash
python3 - <<'PY' > /tmp/widened-doc-links.sh
import pathlib
src = pathlib.Path("scripts/check-doc-links.sh").read_text()
old = '    files.extend(sorted(Path("decisions").rglob("*.md")))'
new = old + '''
    for extra in (Path(".claude/skills"), Path(".claude/rules")):
        if extra.is_dir():
            files.extend(sorted(extra.rglob("*.md")))'''
assert old in src
print(src.replace(old, new, 1))
PY
bash /tmp/widened-doc-links.sh 2>&1 | sort | uniq -c
```

Expected: 8 `FAIL:` lines, every one naming `.claude/skills/graphify/SKILL.md` and a `references/*.md` path. If anything else fails, stop and re-read this task's scope decision — a new failure outside `graphify/` is a fact this plan did not have.

- [ ] **Step 2: Apply the rules-only widening**

In `scripts/check-doc-links.sh`, immediately after line 86 (`files.extend(sorted(Path("decisions").rglob("*.md")))`), insert:

```python
    # .claude/rules/*.md carry path pointers into the doc tree and are not
    # reachable from any other gate's scan set. .claude/skills/**/*.md is
    # deliberately NOT here yet — see the plan for 2026-09-18-graph-lookup-skill,
    # which removes the eight dangling references/*.md pointers (inherited from
    # an upstream fork that copied SKILL.md without its references/ directory)
    # by deleting the file that holds them, and widens this list in the same
    # change.
    rules_dir = Path(".claude/rules")
    if rules_dir.is_dir():
        files.extend(sorted(rules_dir.rglob("*.md")))
```

- [ ] **Step 3: Run the real gate — must stay green**

```bash
bash scripts/check-doc-links.sh
```

Expected: `OK: doc links and path-like references resolve (N files scanned).` with the same `N` as before — `.claude/rules/` does not exist yet, so the count is unchanged. That is the point: the widening is inert today and live the moment plan 3 creates the directory.

- [ ] **Step 4: Prove the widening actually reaches a rules file**

```bash
mkdir -p .claude/rules
printf -- '---\npaths: ["**/*.nope"]\n---\n\nSee `docs/architecture/00-Does-Not-Exist.md`.\n' \
  > .claude/rules/fixture.md
bash scripts/check-doc-links.sh; echo "exit=$?"
```

Expected: `FAIL: .claude/rules/fixture.md: unresolved path-like reference \`docs/architecture/00-Does-Not-Exist.md\`` and `exit=1`. A gate not proven to bite is not a gate.

- [ ] **Step 5: Remove the fixture and confirm green**

```bash
rm -rf .claude/rules
bash scripts/check-doc-links.sh; echo "exit=$?"
```

Expected: the `OK:` line and `exit=0`.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-doc-links.sh
git commit -m "$(cat <<'EOF'
feat: scan .claude/rules/*.md for doc-link and path-ref integrity

Inert until the directory exists, live the moment it does — so the tree
the path-scoped-rules branch creates is born covered.

.claude/skills/** deliberately not widened here: measured 8 failures,
all dangling references/*.md pointers in graphify/SKILL.md, a file the
next branch deletes. Widening it there instead of fixing text twice.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire the new gate into all three enforcement paths

**Files:**
- Modify: `.claude/skills/run-all-gates/SKILL.md:12-19` (§Always run)
- Modify: `.github/workflows/quality.yml:15-52` (the `structure` job)
- Modify: `.husky/pre-commit:11-23` (the chained gate list)
- Modify: `app/CLAUDE.md:74` (the pre-commit gate count and list)

**Interfaces:**
- Consumes: `bash scripts/check-skill-pointers.sh` from Task 2.
- Produces: nothing later tasks depend on.

**Why all three:** a rule whose enforcement path does not run is indistinguishable from no rule. `run-all-gates` is what an agent invokes at claim time, `quality.yml` is what blocks the PR, `.husky/pre-commit` is what blocks the commit.

- [ ] **Step 1: Add it to `run-all-gates` §Always run**

In `.claude/skills/run-all-gates/SKILL.md`, the §Always run block becomes:

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-skill-pointers.sh
bash scripts/check-test-coverage.sh
```

Then add this paragraph directly below the existing `check-test-coverage.sh` paragraph:

```markdown
`check-skill-pointers.sh` asserts that every `.claude/skills/*/SKILL.md` and `.claude/rules/*.md` has a row in `00-File-Inventory.md`, and that every `superpowers:<name>` named in a live tracked Markdown file resolves under the installed plugin cache. That last check prints `SKIP` and passes when the cache is absent — CI installs no plugins, so it is a local-only check by design; the registration checks run everywhere.
```

- [ ] **Step 2: Add it to `quality.yml`'s `structure` job**

In `.github/workflows/quality.yml`, insert after the `AGENT.md mirror gate` step (line 19–20):

```yaml
      - name: Skill/rule pointer gate
        run: bash scripts/check-skill-pointers.sh
```

- [ ] **Step 3: Add it to `.husky/pre-commit`**

In `.husky/pre-commit`, extend the chain — insert after `&& bash scripts/check-agent-mirrors.sh \`:

```sh
       && bash scripts/check-skill-pointers.sh \
```

- [ ] **Step 4: Correct the gate count in `app/CLAUDE.md`**

`app/CLAUDE.md:74` currently says "then all 13 structural gates (file-locations, agent-mirrors, astro-class-composition, …)". It is now 14. Change `13` → `14` and insert `skill-pointers` into the parenthesised list directly after `agent-mirrors`. Append `; skill-pointers added 2026-09-18` to that line's existing trailing date list.

- [ ] **Step 5: Verify all three paths agree on the script list**

```bash
grep -c 'check-skill-pointers.sh' .claude/skills/run-all-gates/SKILL.md \
  .github/workflows/quality.yml .husky/pre-commit
grep -o '[0-9]* structural gates' app/CLAUDE.md
```

Expected: `1` (or more) for each of the three wiring files, and `14 structural gates`.

- [ ] **Step 6: Verify the local chain reaches it**

Running `.husky/pre-commit` directly would invoke `npx lint-staged`, which needs `app/node_modules`. Check the chain's shape instead, then let the real hook prove it on Step 7's commit.

```bash
grep -n 'check-skill-pointers.sh' .husky/pre-commit
sh -n .husky/pre-commit && echo "pre-commit parses"
```

Expected: the line appears inside the `&&` chain (not after the final `check-test-coverage.sh`, which would leave a dangling `\`), and `pre-commit parses`. Step 7's commit is the real proof — if the gate is misplaced, the commit fails.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/run-all-gates/SKILL.md .github/workflows/quality.yml .husky/pre-commit app/CLAUDE.md
git commit -m "$(cat <<'EOF'
chore: wire check-skill-pointers into gates, CI and pre-commit

All three paths: claim time, PR time, commit time. app/CLAUDE.md's
structural-gate count corrected 13 -> 14.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Context maintenance, D314, and the PR

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md` — one new row in §Cross-cutting mechanical guards; refresh the `.claude/settings.json` row
- Modify: `docs/architecture/00-Context-Map-History.md` — version entry + two Task Records rows
- Modify: `decisions/context-system.md` — append D314

**Interfaces:**
- Consumes: the files created and modified in Tasks 1–4.
- Produces: the registration rows `check-skill-pointers.sh` itself asserts. Note the ordering trap: this task adds the row that makes Task 2's gate pass for any *new* file — but no new skill or rule was added on this branch, so the gate is already green and stays green.

- [ ] **Step 1: Register the new script in the File Inventory**

In `docs/architecture/00-File-Inventory.md` §Cross-cutting mechanical guards (the 3-column `File | Answers | Status` table around line 203–218), add after the `scripts/check-agent-mirrors.sh` row:

```markdown
| `scripts/check-skill-pointers.sh` | Guard: every `.claude/skills/*/SKILL.md` and `.claude/rules/*.md` is registered in this file, and every `superpowers:<name>` in a live tracked Markdown file resolves under the installed plugin cache (skipped, not failed, when the cache is absent — CI installs no plugins). Closes D311's finding that no gate ever read the skill tree (2026-09-18, D314) | canonical |
```

This table has no `~Tokens` column, so `check-context-budget.sh`'s `FILE_ROW` regex does not match it and no token estimate is owed.

- [ ] **Step 2: Refresh the `.claude/settings.json` inventory row**

Replace that row's Answers cell (currently ends "…and the concision `UserPromptSubmit` hook (2026-09-18, D311)") with:

```markdown
| `.claude/settings.json` | Committed Claude Code project settings: declares the `superpowers@claude-plugins-official` marketplace + plugin (sole source of the Superpowers process skills), the Bash permission allow/deny lists, the `Read(...)` denies for the four whole-file loads nothing should read entire (`graphify-out/graph.json`, both worktree roots, `app/src/db/schema.ts`), `claudeMdExcludes` for worktree copies, and the concision `UserPromptSubmit` hook (2026-09-18, D311; guardrails D314) | canonical |
```

- [ ] **Step 3: Append the version entry to the history**

In `docs/architecture/00-Context-Map-History.md`, directly under `# Version History` and above the `1.83.0` entry, insert:

```markdown
> **Version:** 1.84.0 (2026-09-18 — context guardrails: `.claude/settings.json` gains four `Read(...)` denies (`graphify-out/graph.json` at ~1.9M tokens read whole, both worktree roots, the generated `app/src/db/schema.ts`) and `claudeMdExcludes` for worktree `CLAUDE.md` copies; new `scripts/check-skill-pointers.sh` asserts every `.claude/skills/*/SKILL.md` and `.claude/rules/*.md` carries a `00-File-Inventory.md` row and every live `superpowers:<name>` resolves under the plugin cache, skipping that last check rather than failing it where no cache exists. `check-doc-links.sh`'s scan set gains `.claude/rules/*.md`, inert until the directory exists. The gate lands before the rules tree so that tree is born covered rather than retrofitted. `.claude/skills/**/*.md` is deliberately not in the link gate yet: measured, it fails on 8 dangling `references/*.md` pointers inherited from the graphify fork, in the file the next branch deletes. D314.)
>
```

- [ ] **Step 4: Derive the decision id — do not trust D314 blindly**

```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Expected: `313`, so the next id is `D314`. If it returns anything higher, another branch landed a decision first — use `max + 1` and say so in the PR body.

- [ ] **Step 5: Append the decision block**

At the **end** of `decisions/context-system.md`, after the D312 block:

```markdown
### D314 — Accidental whole-file loads are denied at the tool boundary, and the skill tree is registered
Status: Accepted · Date: 2026-09-18
Decision: `.claude/settings.json` denies `Read` on the four paths nothing should ever load entire — `graphify-out/graph.json`, `.worktrees/**`, `.claude/worktrees/**`, and the `drizzle-kit`-generated `app/src/db/schema.ts` — and sets `claudeMdExcludes` so a `CLAUDE.md` inside a worktree copy is not auto-loaded beside the real one. A new gate, `scripts/check-skill-pointers.sh`, asserts that every `.claude/skills/*/SKILL.md` and every `.claude/rules/*.md` carries a row in `00-File-Inventory.md`, and that every `superpowers:<name>` named in a live tracked Markdown file resolves under the installed plugin cache. It is wired into `run-all-gates` §Always run, `quality.yml`'s structure job and `.husky/pre-commit`. `check-doc-links.sh`'s scan set gains `.claude/rules/*.md`.
Reason: D311 found that none of the eight vendored skill copies was registered in the inventory, so no gate script ever read them and every upstream drift landed unobserved; the registration assertions close that for the files the repo owns. The denies address a different failure — not drift but volume: `graphify-out/graph.json` is 7.7 MB, roughly 1.9M tokens read whole, while root `CLAUDE.md` invites exactly that read; a worktree is a second full copy of the repo; and `schema.ts` is regenerated output whose authority is `database/migrations/`. Grep over the graph is untouched, because grep is what the manual actually wants. The gate lands before the `.claude/rules/` tree exists so that tree is born covered — a gate landing after the tree it checks has nothing to say about how that tree was built.
Consequences: `superpowers:` pointer resolution is a local-only check. CI installs no plugins, so it prints `SKIP` and passes there; making it hard-fail would leave a permanently red check CI cannot fix, which is the "advisory gate" failure mode in a different costume. `claudeMdExcludes` is ships-and-hopes: `strings` on binary 2.1.236 confirms the identifier exists in the build, which is not confirmation that this key name and glob syntax are honoured — an unrecognised settings key is ignored, so the downside of being wrong is that it silently does nothing rather than that it breaks something. The same uncertainty is load-bearing for the path-scoped-rules branch, which is why that branch owes a live probe before it commits to six files. `.claude/skills/**/*.md` is not yet in the link gate's scan set: widening it today fails on 8 dangling `references/*.md` pointers in `graphify/SKILL.md` — inherited from a fork that copied the file without upstream's `references/` directory — and the next branch deletes that file, so the widening travels with the deletion rather than fixing text twice.
```

- [ ] **Step 6: Register this plan and the spec in Task Records**

In `00-Context-Map-History.md` §Task Records, append two rows:

```markdown
| `docs/superpowers/specs/2026-09-18-agent-context-hardening-implementation-design.md` | Implementation design for the agent-context-hardening report's F7, F9, F4, F2+F3 and F5 findings: four sequential branches, three trigger-shaped mechanisms (directory `CLAUDE.md`, `.claude/rules/` glob, hook), F6/F8 and the `PreToolUse` spike deferred. Rejects the report's nine `.claude/rules/` files — four duplicate existing directory `CLAUDE.md` files — and corrects its `app/CLAUDE.md` target from ~55–60 to ~85–90 lines (2026-09-18) | historical |
| `docs/superpowers/plans/2026-09-18-context-guardrails.md` | The 5-task plan for branch 1 (F7 + F9): `.claude/settings.json` denies and `claudeMdExcludes` (Task 1), `scripts/check-skill-pointers.sh` proven on three fixtures (Task 2), `check-doc-links.sh` widened to `.claude/rules/*.md` (Task 3), wiring into gates/CI/pre-commit (Task 4), context maintenance + D314 (Task 5) (2026-09-18) | historical |
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
```

Expected: eight `OK:` lines. `check-decision-ids.sh` is included because `decisions/**` changed. Do not summarise as "gates pass" — state each script's result.

- [ ] **Step 8: Commit**

```bash
git add docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map-History.md decisions/context-system.md
git commit -m "$(cat <<'EOF'
docs: register the guardrails — inventory, history 1.84.0, D314

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Finish the branch**

Invoke `superpowers:finishing-a-development-branch` together with the `finishing-a-dart-branch` skill. Step 4 is Option 2 — push and open a PR — every time, no menu.

PR body must name: the three fixtures Task 2 passed, the measured 8-failure reason `.claude/skills/**` is not in the link gate yet, and the `claudeMdExcludes` uncertainty stated as uncertainty.

---

## What this branch does not prove

No gate can assert that the denies changed what an agent actually loaded. The honest measure is `/context` in a live session before and after, which is an observation, not a test. Do not claim otherwise in the PR.
