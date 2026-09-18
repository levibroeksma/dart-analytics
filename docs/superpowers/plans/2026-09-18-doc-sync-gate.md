# Doc-Sync Gate (F5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "docs were not updated at task end" a condition that fails, instead of a rule nobody was reminded of.

**Architecture:** Two pieces on one branch. `scripts/check-doc-sync.sh` is the enforcement: a change under the calibrated trigger paths with no `docs/architecture/` or `decisions/` edit fails, hard, from day one. `.claude/hooks/context-drift.sh` on the `Stop` event is the reminder: it costs nothing on a clean turn and speaks only on drift — so the gate is not the first time anyone hears about it. Wired into `run-all-gates` and `quality.yml`, deliberately **not** `.husky/pre-commit`: it diffs against the merge base and would misfire mid-branch.

**Tech Stack:** Bash, Python 3, git, GitHub Actions, Claude Code hooks.

**Spec:** `docs/superpowers/specs/2026-09-18-agent-context-hardening-implementation-design.md` — Branch 4.

**Branch:** `feat/doc-sync-gate`, off latest `origin/main` after plan 3's PR has merged.

**Decision id:** D317 (reserved; re-derive at Task 5).

---

## Global Constraints

- **Branch first.** `git fetch origin && git switch -c feat/doc-sync-gate origin/main`. Never commit on `main`.
- **Never `--no-verify`.**
- **Extreme concision in commit messages.**
- **Every commit message ends with:** `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **PR body ends with:** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- **Decisions are append-only.**
- **Discovered work → GitHub issue**, never fixed in this pass.
- **No permanently-advisory mode.** D312's own finding was that a rule whose enforcement path does not run is indistinguishable from no rule. A gate that cannot fail would reproduce it. If the calibration says the threshold is wrong, change the threshold — do not add a warn-only flag.
- **The calibration is throwaway.** No script from Task 1 is committed. Its output goes in the PR body, where it is auditable, not into `scripts/`.
- **No runtime code, no migrations.**

---

## The calibration is already done — Task 1 confirms it, it does not start it

This plan was written against a calibration run over the last 80 first-parent merges on `origin/main`. Two results matter.

**The spec's candidate patterns are too broad.** With trigger = `database/migrations/` ∪ `app/src/services/` ∪ `app/src/modules/`, 20 merges touched a trigger path and 4 would have failed. Hand-labelled:

| Merge | Changed | Verdict |
| --- | --- | --- |
| `916f7a21` feat: build one summary card per completed routine exercise | `modules/training/routine-summary.module.ts`, `modules/training/types.ts`, its test | **docs genuinely owed** — a new domain module with no doc anywhere, not even a spec |
| `43d8b26f` fix: gate wake lock acquisition on first user gesture | `modules/ui/wake-lock.module.ts`, its test, a spec + plan | false positive |
| `6c4b528c` wake-lock iOS video fix | same shim, its test, a spec + plan | false positive |
| `c47a0260` wake-lock iOS standalone | same shim, its test, a spec + plan | false positive |

Three of four false positives, all the same subject: `app/src/modules/ui/` holds browser-API shims, not domain logic. A wake-lock fix owes no `docs/architecture/` entry, and all three did write a spec and a plan — just to `docs/superpowers/`, which is non-canonical and correctly does not count.

**The tuned trigger.** Narrowing `app/src/modules/` to its domain subdirectories — `game`, `training`, `dartbot`, `stats`, excluding `ui` — gives: 13 merges touched a trigger path, **exactly 1 would have failed, and that one genuinely owed docs. False positives: 0.**

That is the threshold this plan ships. Task 1 re-runs it because `main` moves.

---

## File Structure

| File | Created / modified | Responsibility |
| --- | --- | --- |
| `scripts/check-doc-sync.sh` | create | The gate: trigger-path change with no canonical-doc edit fails |
| `.claude/hooks/context-drift.sh` | create | `Stop`-event reminder, silent unless drifting |
| `.claude/settings.json` | modify | Register the `Stop` hook |
| `.claude/skills/run-all-gates/SKILL.md` | modify | Register the gate |
| `.github/workflows/quality.yml` | modify | Register the gate in the `structure` job |
| `docs/architecture/00-File-Inventory.md` | modify | Rows for both new files |
| `docs/architecture/00-Context-Map-History.md` | modify | Version entry + Task Records row |
| `decisions/context-system.md` | modify | D317 |

---

### Task 1: Confirm the calibration on the current `main`

**Files:** none committed. The script below lives in the scratchpad and is deleted.

**Interfaces:**
- Consumes: nothing.
- Produces: the trigger regex Task 2 hardcodes, and the table that goes in the PR body.

- [ ] **Step 1: Run the calibration**

```bash
git fetch origin
TRIG='^(database/migrations/|app/src/services/|app/src/modules/(game|training|dartbot|stats)/)'
DOCS='^(docs/architecture/|decisions/)'
tot=0; hits=0
for sha in $(git log --first-parent -n 80 --format=%H origin/main); do
  base=$(git rev-parse "$sha^1" 2>/dev/null) || continue
  files=$(git diff --name-only "$base" "$sha")
  printf '%s\n' "$files" | grep -qE "$TRIG" || continue
  tot=$((tot+1))
  if ! printf '%s\n' "$files" | grep -qE "$DOCS"; then
    hits=$((hits+1))
    printf 'HIT %s %s\n' "${sha:0:8}" "$(git log -1 --format=%s "$sha" | cut -c1-70)"
    git diff --name-only "$base" "$sha" | sed 's/^/      /'
  fi
done
echo "--- touched trigger paths: $tot | would have failed: $hits"
```

Expected, at the time of writing: `touched trigger paths: 13 | would have failed: 1`, the one hit being `916f7a21`.

- [ ] **Step 2: Hand-label every hit**

For each `HIT`, open the changed files and decide: did this change alter something `docs/architecture/**` or `decisions/**` describes? Record *docs genuinely owed* or *false positive*, with one line of reasoning. This is the judgement the gate automates; it cannot be skipped.

- [ ] **Step 3: Tune only if a false positive appears**

If any hit is a false positive, narrow the trigger — a directory that holds infrastructure shims rather than domain logic is the usual culprit, exactly as `app/src/modules/ui/` was. Re-run Step 1 with the narrowed regex until false positives are 0. Do **not** widen `DOCS` to include `docs/superpowers/`: specs and plans are non-canonical (D312) and counting them would let a gate pass on a doc that ranks below the code it describes.

- [ ] **Step 4: Confirm the gate would not be a no-op**

If the tuned trigger produces **zero** hits over 80 merges, stop and report that before building anything. A gate that would never have fired is a ratchet against future regression, not a fix for a measured defect — which is a legitimate thing to ship, but it is the user's call whether it is worth the maintenance surface, and it changes what the PR body can honestly claim.

- [ ] **Step 5: Record the table, commit nothing**

The labelled table goes in the PR body at Task 5. `git status --short` must be clean.

---

### Task 2: `scripts/check-doc-sync.sh`, proven to bite

**Files:**
- Create: `scripts/check-doc-sync.sh`

**Interfaces:**
- Consumes: the trigger regex confirmed in Task 1.
- Produces: `bash scripts/check-doc-sync.sh` — exit 0 with an `OK:`/`SKIP:` line, exit 1 with a `FAIL:` line naming the offending files. Takes an optional list of paths as arguments so it can be aimed at a fixture set. Task 3's hook and Task 4's wiring both call it.

**The change-set idiom is copied deliberately** from `scripts/check-test-coverage.sh:62-90` — staged files when a commit is in progress, otherwise the diff against the merge base with `$DOC_SYNC_BASE_REF` (default `origin/main`). Two gates deriving the same change set two different ways is a bug waiting to happen.

- [ ] **Step 1: Write the gate**

Create `scripts/check-doc-sync.sh`:

```bash
#!/usr/bin/env bash
# Doc-sync gate (D317).
#
# THE RULE: a change that touches domain logic the architecture docs
# describe must also touch those docs. Deliberately narrow — the paths below
# were calibrated against the last 80 first-parent merges on main, tuned
# until false positives reached zero. The calibration table is in the PR
# that introduced this file.
#
# TRIGGERS (what the docs describe):
#   database/migrations/          — every migration has a spec chapter
#   app/src/services/             — the layer 06-API/ contracts describe
#   app/src/modules/game/         — Pattern 18 engines
#   app/src/modules/training/     — 09-Training/
#   app/src/modules/dartbot/      — 08-DartBot.md
#   app/src/modules/stats/        — the read-model layer
#
# NOT a trigger, deliberately: app/src/modules/ui/. It holds browser-API
# shims (wake lock and friends), and three of the four false positives the
# calibration found were the same wake-lock file. A shim owes no
# architecture entry.
#
# SATISFIED BY: any edit under docs/architecture/ or decisions/.
# NOT satisfied by docs/superpowers/**: specs and plans are non-canonical
# (D312) and rank below the code they describe, so counting them would let
# the gate pass on a document that is not authority.
#
# STYLE TWEAKS AND TEST-ONLY CHANGES DO NOT TRIP IT: neither app/tests/ nor
# app/src/components/ nor app/src/styles/ is a trigger path.
#
# NOT wired into .husky/pre-commit, on purpose: it diffs against the merge
# base, so mid-branch it would fail every commit before the one that writes
# the docs. It runs at claim time (run-all-gates) and at PR time (CI), which
# are the two moments the question "are the docs owed?" can be answered.
#
# ARGUMENTS: an optional list of changed paths, purely so the gate can be
# aimed at a fixture set to prove it FAILS. A gate not proven to bite is not
# a gate.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

TRIGGER='^(database/migrations/|app/src/services/|app/src/modules/(game|training|dartbot|stats)/)'
SATISFIER='^(docs/architecture/|decisions/)'
BASE_REF="${DOC_SYNC_BASE_REF:-origin/main}"

if [ "$#" -gt 0 ]; then
  CHANGED=$(printf '%s\n' "$@")
elif ! git diff --cached --quiet 2>/dev/null; then
  CHANGED=$(git diff --cached --name-only --diff-filter=ACMR)
else
  if git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
    MERGE_BASE=$(git merge-base "$BASE_REF" HEAD 2>/dev/null || echo "")
  else
    MERGE_BASE=""
  fi
  if [ -z "$MERGE_BASE" ]; then
    echo "SKIP: doc-sync — no change set to check (no staged files, no merge base with $BASE_REF)."
    exit 0
  fi
  CHANGED=$(git diff --name-only --diff-filter=ACMR "$MERGE_BASE"..HEAD)
fi

TRIGGERED=$(printf '%s\n' "$CHANGED" | grep -E "$TRIGGER" || true)
if [ -z "$TRIGGERED" ]; then
  echo "OK: doc-sync — no change under a documented domain path."
  exit 0
fi

if printf '%s\n' "$CHANGED" | grep -qE "$SATISFIER"; then
  echo "OK: doc-sync — domain paths changed and canonical docs changed with them."
  exit 0
fi

echo "FAIL: doc-sync — these files changed with no edit under docs/architecture/ or decisions/:" >&2
printf '%s\n' "$TRIGGERED" | sed 's/^/  /' >&2
cat >&2 <<'MSG'

Update the doc that describes what you changed, or add the decision that
records why it changed. docs/superpowers/ does not satisfy this gate —
specs and plans are non-canonical (D312) and rank below the code.

If the change genuinely alters nothing any doc describes, that is a real
answer — say so in the PR and narrow this gate's TRIGGER in its own change,
with the calibration re-run. Do not add a silencer.
MSG
exit 1
```

```bash
chmod +x scripts/check-doc-sync.sh
```

- [ ] **Step 2: Run it on this branch as it stands**

```bash
bash scripts/check-doc-sync.sh
```

Expected: `OK: doc-sync — no change under a documented domain path.` — this branch touches only `scripts/`, `.claude/` and `docs/`.

- [ ] **Step 3: Negative fixture — a service change alone must fail**

```bash
bash scripts/check-doc-sync.sh app/src/services/rulesets/registry.ts; echo "exit=$?"
```

Expected: the `FAIL:` block naming `app/src/services/rulesets/registry.ts`, and `exit=1`.

- [ ] **Step 4: Positive fixture — the same change with a doc edit must pass**

```bash
bash scripts/check-doc-sync.sh app/src/services/rulesets/registry.ts docs/architecture/06-API/00-Overview.md; echo "exit=$?"
```

Expected: `OK: doc-sync — domain paths changed and canonical docs changed with them.` and `exit=0`.

- [ ] **Step 5: Confirm the three deliberate non-triggers**

```bash
bash scripts/check-doc-sync.sh app/tests/services/foo.test.ts; echo "tests exit=$?"
bash scripts/check-doc-sync.sh app/src/components/ui/Badge.astro; echo "components exit=$?"
bash scripts/check-doc-sync.sh app/src/modules/ui/wake-lock.module.ts; echo "ui-shim exit=$?"
```

Expected: `exit=0` for all three, each with the "no change under a documented domain path" line. If the wake-lock one fails, the `ui` exclusion was lost — that is three of the four calibration false positives coming straight back.

- [ ] **Step 6: Confirm `docs/superpowers/` does not satisfy it**

```bash
bash scripts/check-doc-sync.sh app/src/modules/game/five-oh-one.engine.module.ts docs/superpowers/specs/x-design.md; echo "exit=$?"
```

Expected: `FAIL:` and `exit=1`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-doc-sync.sh
git commit -m "$(cat <<'EOF'
feat: doc-sync gate — domain change with no canonical doc edit fails

Calibrated over the last 80 first-parent merges: 13 touched a trigger
path, 1 would have failed, and that one genuinely owed docs. False
positives 0.

app/src/modules/ui/ is deliberately excluded — three of the four FPs
under the untuned patterns were the same wake-lock shim, and all three
had written a spec and a plan. docs/superpowers/ does not satisfy the
gate: non-canonical (D312), ranks below the code it describes.

Proven to bite on six fixtures.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The `Stop` drift hook

**Files:**
- Create: `.claude/hooks/context-drift.sh`
- Modify: `.claude/settings.json` — add the `Stop` entry

**Interfaces:**
- Consumes: `scripts/check-doc-sync.sh` from Task 2 — the hook shells out to it rather than reimplementing the rule. One definition of drift, two callers.
- Produces: nothing later tasks depend on.

**Two things must be probed before this is written, not assumed.**

1. **Which output contract a `Stop` hook honours on this build.** `strings -a` on `2.1.236` shows `Stop`, `stopHookActive`, `additionalContext` and `hookSpecificOutput` are all present. That confirms the identifiers exist in the binary; it does not tell you that `Stop` accepts `hookSpecificOutput.additionalContext`. The contract I am confident about for `Stop` is `{"decision": "block", "reason": "..."}`, which feeds the reason back to the model. Probe, then write.
2. **The re-entrancy guard.** A `Stop` hook that returns blocking output causes the model to continue, which fires `Stop` again. The hook input carries `stop_hook_active`; the hook must no-op when it is true or it loops. This is not optional.

- [ ] **Step 1: Probe the output contract**

Write a throwaway hook that always speaks, register it on `Stop`, and see which form arrives:

```bash
mkdir -p .claude/hooks
cat > /tmp/probe-stop.sh <<'EOF'
#!/usr/bin/env bash
printf '%s' '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"PROBE-STOP-A1: additionalContext arrived."}}'
EOF
chmod +x /tmp/probe-stop.sh
```

Register it temporarily under `hooks.Stop` in `.claude/settings.json`, start a fresh session, finish a turn, and ask whether `PROBE-STOP-A1` is in context. Then repeat with the other form:

```bash
cat > /tmp/probe-stop.sh <<'EOF'
#!/usr/bin/env bash
printf '%s' '{"decision":"block","reason":"PROBE-STOP-B2: decision/reason arrived."}'
EOF
```

Record which one the model actually sees. Remove the probe registration before continuing — a hook that always blocks makes a session unusable.

- [ ] **Step 2: Write the hook using whichever contract the probe confirmed**

Create `.claude/hooks/context-drift.sh`. The body below uses `decision`/`reason`; if the probe showed `additionalContext` works on `Stop`, swap the `speak` function's payload and nothing else.

```bash
#!/usr/bin/env bash
# Stop-event context-drift reminder (D317).
#
# Silent on a clean turn — a turn that owes nothing costs nothing. Speaks
# only when scripts/check-doc-sync.sh says the branch has changed domain
# logic with no canonical-doc edit, so this is a reminder of the same rule
# the gate enforces, not a second rule. One definition of drift.
#
# Re-entrancy: a Stop hook that returns blocking output makes the model
# continue, which fires Stop again. stop_hook_active is true on that second
# firing; bail immediately or this loops.
set -u

INPUT=$(cat)

if printf '%s' "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ] && exit 0

DRIFT=$(bash scripts/check-doc-sync.sh 2>&1) && exit 0

printf '%s' "{\"decision\":\"block\",\"reason\":$(printf '%s' "This branch has changed domain logic with no canonical-doc edit. Update docs/architecture/ or add a decisions/ entry before finishing, or say plainly why none is owed. Detail:
$DRIFT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"
exit 0
```

```bash
chmod +x .claude/hooks/context-drift.sh
```

- [ ] **Step 3: Register it on `Stop`**

In `.claude/settings.json`, add to the `hooks` object, alongside the existing `PreToolUse` and `UserPromptSubmit` entries:

```json
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/context-drift.sh\"",
            "statusMessage": "Checking doc drift"
          }
        ]
      }
    ]
```

- [ ] **Step 4: Verify it is silent on a clean branch**

```bash
echo '{"stop_hook_active": false}' | bash .claude/hooks/context-drift.sh; echo "exit=$? (empty output above = clean)"
```

Expected: no output, `exit=0`. This branch changes no domain path, so the hook has nothing to say.

- [ ] **Step 5: Verify the re-entrancy guard**

```bash
echo '{"stop_hook_active": true}' | bash .claude/hooks/context-drift.sh; echo "exit=$? (must be silent even if drifting)"
```

Expected: no output, `exit=0`.

- [ ] **Step 6: Verify it speaks when there is drift**

The hook calls `check-doc-sync.sh` and speaks on its non-zero exit. Simulate that exit rather than building a throwaway repo — the gate's own detection is already proven by Task 2's six fixtures.

```bash
printf '%s' '{"stop_hook_active": false}' | \
  CLAUDE_PROJECT_DIR="$PWD" bash -c '
    sed "s|bash scripts/check-doc-sync.sh|bash -c \"echo FIXTURE-DRIFT; exit 1\"|" \
      .claude/hooks/context-drift.sh > /tmp/hook-fixture.sh
    bash /tmp/hook-fixture.sh'
echo "exit=$?"
```

Expected: one line of JSON containing `FIXTURE-DRIFT` inside the `reason` (or `additionalContext`) field, and `exit=0`. A hook that exits non-zero on drift would surface as a hook error rather than as a message — confirm the exit code is 0.

The hook's end-to-end behaviour on a real `Stop` is exercised in a live session, not here.

- [ ] **Step 7: Verify `settings.json` still parses**

```bash
python3 -c "import json;d=json.load(open('.claude/settings.json'));\
assert 'Stop' in d['hooks'] and 'PreToolUse' in d['hooks'] and 'UserPromptSubmit' in d['hooks'];\
print('OK: settings.json parses, all three hook events present')"
```

- [ ] **Step 8: Commit**

```bash
git add .claude/hooks/context-drift.sh .claude/settings.json
git commit -m "$(cat <<'EOF'
feat: Stop hook reminds about doc drift, silent on a clean turn

Shells out to check-doc-sync.sh rather than reimplementing the rule —
one definition of drift, two callers. Bails on stop_hook_active or it
loops; bails on main; bails outside a repo.

Output contract chosen by probe, not assumed: strings on 2.1.236 shows
the identifiers exist, which is not evidence Stop accepts them.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire the gate into the two paths that can answer the question

**Files:**
- Modify: `.claude/skills/run-all-gates/SKILL.md`
- Modify: `.github/workflows/quality.yml`

**Interfaces:**
- Consumes: `bash scripts/check-doc-sync.sh` from Task 2.
- Produces: nothing later tasks depend on.

**Not `.husky/pre-commit`.** The gate diffs against the merge base. Mid-branch — after the code commit, before the docs commit — it would fail every commit, and the only way through would be `--no-verify`, which is forbidden. Claim time and PR time are the two moments the question "are the docs owed?" has an answer.

- [ ] **Step 1: Add it to `run-all-gates` §Always run**

Append to the §Always run block:

```bash
bash scripts/check-doc-sync.sh
```

and add this paragraph below it:

```markdown
`check-doc-sync.sh` fails when the change set touches `database/migrations/`, `app/src/services/` or a domain subdirectory of `app/src/modules/` (`game`, `training`, `dartbot`, `stats`) with no edit under `docs/architecture/` or `decisions/`. It reads the change set the same way `check-test-coverage.sh` does — staged files mid-commit, otherwise the diff against the merge base with `origin/main` (override with `DOC_SYNC_BASE_REF`). `docs/superpowers/` does not satisfy it: specs and plans are non-canonical (D312). It is absent from `.husky/pre-commit` on purpose — mid-branch it would fail the code commit that precedes the docs commit.
```

- [ ] **Step 2: Add it to `quality.yml`'s `structure` job**

Insert after the `Test-coverage-of-changes gate` step, keeping the same env pattern:

```yaml
      - name: Doc-sync gate
        env:
          DOC_SYNC_BASE_REF: origin/${{ github.base_ref || github.event.repository.default_branch }}
        run: bash scripts/check-doc-sync.sh
```

The `structure` job already checks out with `fetch-depth: 0`, which this gate needs for the same reason `check-test-coverage.sh` does — a shallow clone has no merge base.

- [ ] **Step 3: Verify both wirings**

```bash
grep -c 'check-doc-sync.sh' .claude/skills/run-all-gates/SKILL.md .github/workflows/quality.yml
grep -c 'check-doc-sync.sh' .husky/pre-commit || echo "pre-commit: absent, as intended"
```

Expected: at least `1` for the first two; `pre-commit: absent, as intended`.

- [ ] **Step 4: Verify the CI env var is actually read**

```bash
DOC_SYNC_BASE_REF=origin/main bash scripts/check-doc-sync.sh; echo "exit=$?"
```

Expected: `OK: doc-sync — no change under a documented domain path.` and `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/run-all-gates/SKILL.md .github/workflows/quality.yml
git commit -m "$(cat <<'EOF'
chore: wire check-doc-sync into run-all-gates and CI

Not pre-commit: it diffs against the merge base, so mid-branch it would
fail the code commit that precedes the docs commit, and the only way
through would be --no-verify.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The synthetic end-to-end proof, registration, D317, and the PR

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md`, `docs/architecture/00-Context-Map-History.md`, `decisions/context-system.md`

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: The synthetic proof that must fail**

Task 2's fixture arguments prove the rule. This proves the derivation — that the gate finds a real change set on its own, with no arguments.

Stage the change rather than committing it. The gate's staged-files branch is what `.husky/pre-commit` would use, and committing here would trip `check-test-coverage.sh` (a source file with no touched test) for reasons unrelated to what is being proven.

```bash
git switch -c tmp/doc-sync-proof
printf '\n// doc-sync proof\n' >> app/src/services/rulesets/registry.ts
git add app/src/services/rulesets/registry.ts
bash scripts/check-doc-sync.sh; echo "exit=$?"
```

Expected: the `FAIL:` block naming `app/src/services/rulesets/registry.ts`, and `exit=1`.

- [ ] **Step 2: Prove it passes once the doc is touched**

```bash
printf '\n' >> docs/architecture/06-API/00-Overview.md
git add docs/architecture/06-API/00-Overview.md
bash scripts/check-doc-sync.sh; echo "exit=$?"
```

Expected: `OK: doc-sync — domain paths changed and canonical docs changed with them.` and `exit=0`.

- [ ] **Step 3: Clean up the proof completely**

```bash
git restore --staged app/src/services/rulesets/registry.ts docs/architecture/06-API/00-Overview.md
git restore app/src/services/rulesets/registry.ts docs/architecture/06-API/00-Overview.md
git switch feat/doc-sync-gate
git branch -D tmp/doc-sync-proof
git status --short
```

Expected: clean. Nothing from the proof may reach the PR.

- [ ] **Step 4: Register both new files**

In `docs/architecture/00-File-Inventory.md` §Cross-cutting mechanical guards:

```markdown
| `scripts/check-doc-sync.sh` | Guard: a change under `database/migrations/`, `app/src/services/` or a domain subdirectory of `app/src/modules/` (`game`, `training`, `dartbot`, `stats`) must also touch `docs/architecture/` or `decisions/`; `docs/superpowers/` does not satisfy it (D312). Paths calibrated over 80 first-parent merges to zero false positives; `app/src/modules/ui/` excluded as infrastructure shims. Absent from `.husky/pre-commit` by design — it diffs against the merge base (2026-09-18, D317) | canonical |
```

In §Context & history:

```markdown
| `.claude/hooks/context-drift.sh` | `Stop`-event reminder: shells out to `scripts/check-doc-sync.sh` and speaks only on drift, so a clean turn costs nothing; bails on `stop_hook_active` to avoid a re-entrancy loop (2026-09-18, D317) | canonical |
```

Update the `.claude/settings.json` row's parenthetical to note the `Stop` hook.

- [ ] **Step 5: Append the version entry**

```markdown
> **Version:** 1.87.0 (2026-09-18 — doc-sync: new `scripts/check-doc-sync.sh` fails a change under `database/migrations/`, `app/src/services/` or a domain subdirectory of `app/src/modules/` that touches no `docs/architecture/` or `decisions/` file, plus `.claude/hooks/context-drift.sh` on `Stop`, which shells out to the same script and stays silent on a clean turn. Trigger paths were calibrated over the last 80 first-parent merges, not asserted: the spec's candidate patterns produced 4 hits of which 3 were false positives, all the same `app/src/modules/ui/` wake-lock shim, which had in fact written a spec and a plan each time; excluding `ui` leaves 13 merges touching a trigger path and exactly 1 failing, and that one genuinely owed docs. `docs/superpowers/` deliberately does not satisfy the gate — non-canonical (D312), ranking below the code it describes. Wired into `run-all-gates` and `quality.yml`, not `.husky/pre-commit`, which would fail every mid-branch code commit. Hard-failing from day one; no advisory mode. D317.)
>
```

- [ ] **Step 6: Derive the id and append D317**

```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

```markdown
### D317 — Domain code that changes without its docs fails, on paths calibrated against history
Status: Accepted · Date: 2026-09-18
Decision: `scripts/check-doc-sync.sh` fails any change set that touches `database/migrations/`, `app/src/services/`, or `app/src/modules/{game,training,dartbot,stats}/` without also touching `docs/architecture/` or `decisions/`. `docs/superpowers/` does not satisfy it. It reads its change set exactly as `check-test-coverage.sh` does — staged files mid-commit, otherwise the diff against the merge base with `$DOC_SYNC_BASE_REF` — and is wired into `run-all-gates` §Always run and `quality.yml`'s structure job, but deliberately not `.husky/pre-commit`. `.claude/hooks/context-drift.sh` runs on `Stop`, shells out to the same script, and produces output only when it fails.
Reason: "a change that leaves the docs stale is incomplete" has been a root `CLAUDE.md` rule since the context system was built, and nothing ran it. The trigger paths are calibrated rather than asserted: over the last 80 first-parent merges on `main`, the research report's candidate patterns produced 4 hits of which 3 were false positives — all three the same `app/src/modules/ui/wake-lock.module.ts`, a browser-API shim that owes no architecture entry and had in fact written a spec and a plan on each occasion. Excluding `app/src/modules/ui/` leaves 13 merges touching a trigger path, exactly 1 failing, and that one — a new `modules/training/` summary module with no document anywhere — genuinely owed docs. A threshold nobody measured is a threshold nobody can defend when it fires.
Consequences: the gate hard-fails from day one, with no advisory mode. D312's own finding was that a rule whose enforcement path does not run is indistinguishable from no rule, and a gate that cannot fail would reproduce exactly that. The cost is that a genuine "this changed nothing any doc describes" case now has to be argued rather than assumed — the remedy is to narrow `TRIGGER` in its own change with the calibration re-run, never a per-change silencer, which would make the gate advisory on precisely the changes it exists to catch. Its absence from `.husky/pre-commit` is not an oversight: it diffs against the merge base, so mid-branch it would fail the code commit that precedes the docs commit, and the only way past would be `--no-verify`, which is forbidden. The `Stop` hook's output contract was chosen by live probe rather than from the identifiers `strings` shows in binary 2.1.236, and it bails on `stop_hook_active` — a `Stop` hook that speaks makes the model continue, which fires `Stop` again. What none of this proves is that anyone reads the doc they were forced to touch; the gate can only observe that a file changed, and no gate can do better.
```

- [ ] **Step 7: Register this plan in Task Records**

```markdown
| `docs/superpowers/plans/2026-09-18-doc-sync-gate.md` | The 5-task plan for branch 4 (F5): confirm the calibration (Task 1), `scripts/check-doc-sync.sh` proven on six fixtures (Task 2), the `Stop` drift hook with its output contract probed and its re-entrancy guard (Task 3), wiring into `run-all-gates` and CI but not pre-commit (Task 4), the synthetic end-to-end proof + D317 (Task 5). Ships the calibration pre-run: the spec's candidate trigger patterns give 3 false positives in 4 hits over 80 merges, all the same `modules/ui/` wake-lock shim; excluding `modules/ui/` gives 1 hit in 13 and zero false positives (2026-09-18) | historical |
```

- [ ] **Step 8: Run every applicable gate and report each result**

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-skill-pointers.sh
bash scripts/check-doc-sync.sh
bash scripts/check-test-coverage.sh
bash scripts/check-decision-ids.sh
```

Expected: nine `OK:` lines. State each result explicitly — including `check-doc-sync.sh` passing on its own branch, which it does because this branch touches no domain path.

- [ ] **Step 9: Commit**

```bash
git add docs/architecture decisions/context-system.md
git commit -m "$(cat <<'EOF'
docs: register the doc-sync gate — inventory, history 1.87.0, D317

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Finish the branch**

Invoke `superpowers:finishing-a-development-branch` with the `finishing-a-dart-branch` skill. Option 2, no menu.

PR body must carry the labelled calibration table from Task 1, the `Stop` contract the probe confirmed, and the synthetic proof's fail-then-pass output.

---

## What this branch does not prove

The gate observes that a file under `docs/architecture/` or `decisions/` changed. It cannot observe whether that edit says anything true about the code beside it, and no gate can. Touching a doc to clear a gate is a defeat this mechanism cannot detect — it is caught in review or not at all, and the PR body should not imply otherwise.
