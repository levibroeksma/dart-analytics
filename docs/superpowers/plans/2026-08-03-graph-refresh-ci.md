# CI-Owned Knowledge-Graph Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `graphify-out/graph.json` stay current without anyone having the `graphify` CLI installed locally, by moving the rebuild into CI.

**Architecture:** `scripts/refresh-graph.sh` gains an opt-in strict mode so a broken install fails loudly in CI instead of silently no-opping. A new `.github/workflows/graph.yml` carries two non-blocking jobs: on push to `main`, rebuild and open/update one long-lived PR from a reused branch (`main` is protected, so a direct push is impossible); on pull requests, post an edited-in-place comment reporting the node/link delta. A separate one-time commit corrects the graph's existing staleness so the workflow starts from a correct baseline.

**Tech Stack:** GitHub Actions, Bash, Python 3, `graphifyy[sql]` (PyPI).

## Global Constraints

- **AST-only, never an LLM key.** `app/CLAUDE.md`: "never configure an LLM API key for graphify (keeps it free/deterministic)". `graphify` prints a tip suggesting `GEMINI_API_KEY`/`GOOGLE_API_KEY` — ignore it; never set either in CI or locally.
- **The `[sql]` extra is mandatory.** Install `graphifyy[sql]`, never bare `graphifyy`. Without `tree_sitter_sql` every SQL node vanishes from the graph; `refresh-graph.sh` already refuses to rebuild in that state and must keep refusing.
- **The canonical command is `graphify update .`** — already in the script. Do **not** switch to `graphify extract . --update`; it demands an LLM API key the moment any doc file looks changed (empirically confirmed, recorded in the script's header).
- **`built_at_commit` is the only volatile field.** Two consecutive rebuilds are byte-identical once it is stripped and `nodes`/`links` are sorted (verified 2026-08-03). Any comparison must normalise it away; a raw `git diff --exit-code` would fail on every run.
- **IDs and counts measured on `main` @ `9aba1c7`:** committed graph 2,321 nodes / 2,762 links; rebuild 2,863 / 4,073. `built_at_commit` in the committed file is `391d2dd5a1f6d93d1a48159cb471afb19d5b83f3`, unreachable in history.
- **`main` is a protected branch** (verified via the branches API: `main` → `protected: true`, all others `false`). A bot cannot push to it. Job 1 opens a PR.
- **The next free decision ID is `D185`** (max in the tree is `D184`; `D185` confirmed unused). Derive it at implementation time anyway — if another decision lands first, `scripts/check-decision-ids.sh` will catch a collision, but deriving is cheaper than fixing.
- **Neither job may block a merge.** Both are advisory; `continue-on-error` where a failure would otherwise mark a run red.
- Every `CLAUDE.md` stays byte-identical to its `AGENT.md` sibling (`scripts/check-agent-mirrors.sh`).
- `docs/superpowers/**` is historical — status notes only, never rewrites (`docs/CLAUDE.md`).
- Decisions are append-only, domain-scoped: pick the file from `DECISIONS.md`'s routing table, append a block, never edit an existing decision. `DECISIONS.md` itself must stay free of decision rows (`scripts/check-decision-ids.sh`).
- Spec: `docs/superpowers/specs/2026-08-03-graph-refresh-ci-design.md`.

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `scripts/refresh-graph.sh` | Modified — `GRAPH_REFRESH_STRICT` opt-in; header notes CI is now the primary refresh path |
| `scripts/graph-delta.py` | New — normalise two graphs (strip `built_at_commit`, sort) and emit node/link counts + delta. One job: comparison. Used by both CI jobs and runnable locally |
| `.github/workflows/graph.yml` | New — `refresh` (push to `main`) and `delta` (pull_request) |
| `graphify-out/graph.json` | Refreshed once, in its own commit |
| Consumer docs | `app/CLAUDE.md`+`AGENT.md`, root `CLAUDE.md`+`AGENT.md`, `context-maintenance` skill, `00-Context-Map.md` |
| `decisions/context-system.md` | New decision block; clears the graph-staleness deferred entries |

---

### Task 1: Strict mode for `refresh-graph.sh` + the delta helper

Both CI jobs depend on these, so they come first and are independently testable without any workflow.

**Files:**
- Modify: `scripts/refresh-graph.sh`
- Create: `scripts/graph-delta.py`

**Interfaces:**
- Produces: `GRAPH_REFRESH_STRICT=1` env contract on `refresh-graph.sh` (unset = today's warn-and-exit-0 behaviour, unchanged); `scripts/graph-delta.py OLD.json NEW.json` printing counts and a delta, exit 0 always (it reports, it does not judge). Tasks 2 and 3 both consume these.

- [ ] **Step 1: Add strict mode to `refresh-graph.sh`**

The script currently has two soft exits (lines ~21–28):

```bash
if ! command -v graphify >/dev/null 2>&1; then
  echo "WARN: graphify CLI not installed — knowledge graph not refreshed (see app/CLAUDE.md setup)" >&2
  exit 0
fi
if ! python3 -c "import tree_sitter_sql" 2>/dev/null; then
  echo "WARN: graphifyy[sql] extra missing — refusing to rebuild (SQL files would vanish, see spec 2026-07-14)" >&2
  exit 0
fi
```

Make each honour `GRAPH_REFRESH_STRICT`. Introduce one helper so the two sites cannot drift:

```bash
STRICT="${GRAPH_REFRESH_STRICT:-0}"

# Warn and skip locally; fail loudly in CI. A silent no-op in CI would
# reproduce the exact staleness this mode exists to prevent, while looking
# like a passing job.
soft_or_fail() {
  echo "$1" >&2
  if [ "$STRICT" = "1" ]; then
    echo "FAIL: GRAPH_REFRESH_STRICT=1 — refusing to exit 0 without refreshing the graph." >&2
    exit 1
  fi
  exit 0
}
```

Then call `soft_or_fail "WARN: graphify CLI not installed …"` and
`soft_or_fail "WARN: graphifyy[sql] extra missing …"` at the two sites.

Update the header comment block to state: the default is warn-and-continue for local/agent runs; `GRAPH_REFRESH_STRICT=1` makes both conditions hard failures and is what CI sets; CI (`.github/workflows/graph.yml`) is now the primary refresh path and a local install is optional.

- [ ] **Step 2: Verify both modes**

```bash
cd /home/user/dart-analytics
# default: warns, exits 0, even with the CLI hidden
PATH=/usr/bin:/bin bash scripts/refresh-graph.sh; echo "default exit=$? (expect 0)"
# strict: same condition must now fail
PATH=/usr/bin:/bin GRAPH_REFRESH_STRICT=1 bash scripts/refresh-graph.sh; echo "strict exit=$? (expect 1)"
```

Expected: `default exit=0`, `strict exit=1`. If `graphify` happens to be on `/usr/bin`, hide it another way (e.g. `PATH=/nonexistent`) — the point is to exercise the missing-CLI branch, and you must actually observe both exit codes, not assume them.

- [ ] **Step 3: Write `scripts/graph-delta.py`**

A comparison helper with exactly one job. It must not rebuild anything, must not write anything, and must not decide whether a delta is acceptable.

```python
#!/usr/bin/env python3
"""Compare two graphify graph.json files and report the node/link delta.

`built_at_commit` records the HEAD a graph was built from, so it changes on
every commit and makes raw byte comparison useless. Stripping it and sorting
nodes/links makes two rebuilds of the same tree byte-identical (verified
2026-08-03). This script exists so both CI jobs and a human use the same
normalisation rather than three subtly different ones.

Usage: graph-delta.py OLD.json NEW.json
Exit code is always 0 — this reports, it does not judge.
"""
```

It should print, on stdout:

- old and new node/link counts
- the signed delta for each
- `identical` when the normalised forms match exactly
- a short sample of node ids added and removed (cap at ~5 each) so a reader can see *what* moved, not just how much

Handle a missing or unparseable old file gracefully (treat as empty and say so) — the first run in a fresh clone may not have one.

- [ ] **Step 4: Verify the helper against a real rebuild**

```bash
cd /home/user/dart-analytics
cp graphify-out/graph.json /tmp/graph-before.json
bash scripts/refresh-graph.sh >/dev/null 2>&1
python3 scripts/graph-delta.py /tmp/graph-before.json graphify-out/graph.json
# self-comparison must report identical
python3 scripts/graph-delta.py graphify-out/graph.json graphify-out/graph.json
git checkout -- graphify-out/graph.json
```

Expected: the first call reports roughly `+542 nodes / +1311 links` (the known staleness); the second reports `identical`. Confirm the tree is clean afterwards.

- [ ] **Step 5: Commit**

```bash
git add scripts/refresh-graph.sh scripts/graph-delta.py
git commit -m "Add graph-refresh strict mode and a normalising delta helper"
```

---

### Task 2: One-time staleness correction

Separate commit, before the workflow exists, so ~500 nodes do not land in an unreviewed bot commit later.

**Files:**
- Modify: `graphify-out/graph.json`

- [ ] **Step 1: Rebuild**

```bash
cd /home/user/dart-analytics
python3 -c "import json;d=json.load(open('graphify-out/graph.json'));print('before:',len(d['nodes']),'nodes',len(d['links']),'links, built_at',d.get('built_at_commit','')[:8])"
cp graphify-out/graph.json /tmp/graph-stale.json
bash scripts/refresh-graph.sh
python3 scripts/graph-delta.py /tmp/graph-stale.json graphify-out/graph.json
```

- [ ] **Step 2: Sanity-check what appeared**

The rebuild must now contain what the stale graph was missing. Confirm each of these resolves to at least one node:

```bash
python3 - <<'PY'
import json
d=json.load(open('graphify-out/graph.json'))
ids=" ".join(n['id'] for n in d['nodes'])
for probe in ["five_oh_one","checkout_path","decisions","check_decision_ids"]:
    print(f"  {probe}: {'present' if probe in ids else 'ABSENT'}")
print("built_at_commit:",d.get('built_at_commit'))
PY
git log --oneline -1 $(python3 -c "import json;print(json.load(open('graphify-out/graph.json'))['built_at_commit'])")
```

Expected: all four probes present, and `built_at_commit` resolving to a real commit on this branch (unlike the stale graph's dangling `391d2dd`). If any probe is ABSENT, stop and report — the rebuild is not capturing the tree.

- [ ] **Step 3: Commit with the counts in the message**

```bash
git add graphify-out/graph.json
git commit -m "$(cat <<'EOF'
Refresh the stale knowledge graph

The committed graph was built from 391d2dd, a commit no longer reachable in
history, and predated the 501 game, checkout-path module and decisions/ tree:
2321 nodes / 2762 links vs 2863 / 4073 on rebuild.

Done as its own commit so the CI workflow that follows starts from a correct
baseline instead of delivering a ~500-node diff in its first bot commit.
EOF
)"
```

Use the real counts your rebuild produced if they differ from the measured figures — do not copy numbers you did not observe.

---

### Task 3: The `graph.yml` workflow

**Files:**
- Create: `.github/workflows/graph.yml`

**Interfaces:**
- Consumes: `scripts/refresh-graph.sh` (with `GRAPH_REFRESH_STRICT=1`), `scripts/graph-delta.py` (both from Task 1).

Read `.github/workflows/pr-gates.yml` first — its `test-repointing-heuristic` job is the established pattern in this repo for a non-blocking PR comment via `actions/github-script@v7`, including `continue-on-error` and `pull-requests: write`. Mirror it rather than inventing a new shape.

- [ ] **Step 1: Write the `refresh` job**

```yaml
name: graph

on:
  push:
    branches: [main]
    paths-ignore:
      - 'graphify-out/**'
  pull_request:
    branches: [main]

concurrency:
  group: graph-${{ github.ref }}
  cancel-in-progress: true
```

`paths-ignore` is the loop guard: merging the graph PR touches only
`graphify-out/**`, so it cannot trigger another refresh. Do not use
`[skip ci]` (it would skip unrelated workflows) or an actor check (it silently
disables the job if the bot name changes).

The `refresh` job, gated on `if: github.event_name == 'push'`:

1. `actions/checkout@v4`
2. `actions/setup-python@v5`
3. `pip install 'graphifyy[sql]>=0.9.32,<0.10'` — pinned, because an unpinned minor bump could rewrite the whole graph and produce a large unexplained bot commit
4. Snapshot the committed graph to `/tmp/graph-before.json`
5. `GRAPH_REFRESH_STRICT=1 bash scripts/refresh-graph.sh`
6. `python3 scripts/graph-delta.py /tmp/graph-before.json graphify-out/graph.json` — capture output for the PR body
7. If `git diff --quiet graphify-out/graph.json`, log "graph already current" and stop
8. Otherwise: commit as `github-actions[bot]` onto a **reused** branch `chore/graph-refresh` (force-updated), and open the PR if none is open, else update the existing one

Permissions: `contents: write` and `pull-requests: write`.

One reused branch and one long-lived PR — not one per merge, or a busy day produces a dozen graph PRs. Title `chore(graph): refresh knowledge graph`; body carries the delta output and the `main` SHA it was built from.

If the repo permits auto-merge, enable it on the PR so a refresh does not wait on a human. If it does not, leave the PR open — the graph is still correct and visible, which is the improvement.

- [ ] **Step 2: Write the `delta` job**

Gated on `if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository` — a fork PR's token cannot comment, so it must skip rather than fail.

Same install steps, then rebuild and run `graph-delta.py`, then post **one** comment, edited in place on subsequent pushes (find an existing comment by a marker string in its body, update if found, create if not — the same find-or-create shape `pr-gates.yml` uses). `continue-on-error: true`; permissions `pull-requests: write` only.

Body shape:

```
<!-- graph-delta -->
**Knowledge graph delta:** +14 nodes, +22 links
Committed 2,863 / 4,073 → rebuilt 2,877 / 4,095
The graph is refreshed automatically after merge (`graph.yml`).
```

When the delta is zero, say so plainly rather than posting nothing — a reader should be able to tell the check ran.

- [ ] **Step 3: Validate the workflow syntax**

```bash
cd /home/user/dart-analytics
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/graph.yml')); print('YAML parses')"
command -v actionlint >/dev/null 2>&1 && actionlint .github/workflows/graph.yml || echo "actionlint not installed — YAML parse only"
```

- [ ] **Step 4: Dry-run the refresh logic locally**

The workflow cannot be executed here, so exercise its *logic* directly and report that this is what you did — do not claim the workflow ran:

```bash
cd /home/user/dart-analytics
cp graphify-out/graph.json /tmp/before.json
GRAPH_REFRESH_STRICT=1 bash scripts/refresh-graph.sh
python3 scripts/graph-delta.py /tmp/before.json graphify-out/graph.json
git diff --quiet graphify-out/graph.json && echo "no-op path: would skip commit" || echo "diff path: would open/update PR"
git checkout -- graphify-out/graph.json
```

After Task 2's refresh, expect the no-op path — which is the correct steady state.

- [ ] **Step 5: Confirm the loop guard by inspection**

State explicitly in your report that `paths-ignore: ['graphify-out/**']` means the bot's graph-only commit cannot retrigger `refresh`, and note that this is unverifiable until the workflow actually runs on GitHub.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/graph.yml
git commit -m "Add graph.yml: CI-owned graph refresh via PR, plus a PR delta comment"
```

---

### Task 4: Update consumers and record the decision

**Files:**
- Modify: `app/CLAUDE.md`, `app/AGENT.md`
- Modify: `CLAUDE.md`, `AGENT.md` (root)
- Modify: `.claude/skills/context-maintenance/SKILL.md`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `decisions/context-system.md`, `DECISIONS.md` (deferred list only)

- [ ] **Step 1: `app/CLAUDE.md` + `app/AGENT.md`**

The Knowledge Graph section presents the graphify install as required per clone and says to "Record graph-not-refreshed in the completion report when it warns." Rewrite: the install is now **optional** — useful for querying the graph locally (`graphify query/path/explain`), no longer needed for freshness, because `.github/workflows/graph.yml` rebuilds on every merge to `main`. Drop the record-a-warning instruction.

Apply the identical edit to both files; run `scripts/check-agent-mirrors.sh`.

- [ ] **Step 2: Root `CLAUDE.md` + `AGENT.md`**

The Knowledge Graph section says "Freshness is a completion-gate item… the gate step is the backstop when hooks are absent." Update: freshness is CI-owned; a local warn is no longer a completion-report item. Keep the "map, not authority" rule and the authority-order deference exactly as they are — this change touches freshness only, not how the graph is trusted.

Identical edit to both; re-run the mirror gate.

- [ ] **Step 3: `context-maintenance` skill**

Its knowledge-graph step currently expects a local refresh and a disclosure when it warns. Rewrite to: the graph is refreshed by CI on merge; no local action and no deferred-list entry is needed. This is the highest-leverage edit — it is what an agent actually reads at completion time, and it is why four branches produced staleness disclosures.

- [ ] **Step 4: `docs/architecture/00-Context-Map.md`**

Register `.github/workflows/graph.yml` and `scripts/graph-delta.py`; update the `graphify-out/graph.json` row to state it is CI-maintained (still `generated`, still never hand-edited). Bump the `> **Version:**` line per the file's convention, demoting the prior note.

- [ ] **Step 5: Record the decision**

Append a block to `decisions/context-system.md` — the next free ID (derive it, do not assume; `check-decision-ids.sh` will catch a collision). It must capture:

- **Decision:** graph freshness is CI-owned; `graph.yml` rebuilds on merge and opens a PR (`main` is protected); the local CLI is optional.
- **Reason:** `refresh-graph.sh` exited 0 when the CLI was absent, so any clone without the manual install silently skipped the rebuild — four consecutive branches shipped staleness disclosures, and the graph had drifted to 2,321 nodes against 2,863 on rebuild, with a `built_at_commit` unreachable in history.
- **Consequences:** `GRAPH_REFRESH_STRICT=1` makes a broken CI install fail loudly rather than no-op; comparison must normalise `built_at_commit` away (the sole volatile field) or every run would appear dirty; a blocking gate was rejected because it makes graphify a hard prerequisite for contributing, the very requirement that had not held.

Then **clear the graph-staleness entries** from `DECISIONS.md`'s Deferred list. There are **four**, all `·`-separated on a single line of that paragraph:

```
score-training configurable-duration · bottom-nav iPhone Home Screen fix ·
501-recreational-v1 · decision-ledger-split
```

All four are resolved by this change. Remove each entry and its trailing `·` separator cleanly, leaving the rest of the Deferred paragraph — which holds many unrelated items — intact.

Removing a *deferred* item is not editing a decision, so the append-only rule is untouched; say so explicitly in your report so a reviewer does not read it as a history rewrite.

- [ ] **Step 6: Verify**

```bash
cd /home/user/dart-analytics
for s in check-context-map check-doc-links check-context-budget check-decision-ids check-agent-mirrors; do printf "%-24s " "$s"; bash scripts/$s.sh >/dev/null 2>&1 && echo PASS || echo FAIL; done
echo "staleness entries remaining: $(grep -o 'knowledge graph not refreshed' DECISIONS.md | wc -l) (expect 0)"
cd app && npx vitest run 2>&1 | tail -3
```

All five gates PASS; zero staleness entries; app suite at its current baseline (a docs/CI change must not move it).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Point graph-freshness consumers at CI and record the decision"
```

---

### Task 5: Final verification

**Files:** none — verification only.

- [ ] **Step 1: Full gate sweep**

```bash
cd /home/user/dart-analytics
for s in check-context-map check-doc-links check-context-budget check-decision-ids check-agent-mirrors; do printf "%-24s " "$s"; bash scripts/$s.sh >/dev/null 2>&1 && echo PASS || echo FAIL; done
python3 -c "import yaml;yaml.safe_load(open('.github/workflows/graph.yml'));print('graph.yml parses')"
cd app && npm run format:check 2>&1 | tail -2 && npx vitest run 2>&1 | tail -3
```

- [ ] **Step 2: Confirm the graph is current and self-consistent**

```bash
cd /home/user/dart-analytics
cp graphify-out/graph.json /tmp/final-before.json
GRAPH_REFRESH_STRICT=1 bash scripts/refresh-graph.sh >/dev/null 2>&1
python3 scripts/graph-delta.py /tmp/final-before.json graphify-out/graph.json
git checkout -- graphify-out/graph.json
```

Expected: `identical`, or a delta explained solely by commits made during this plan. A non-trivial unexplained delta means Task 2's refresh did not stick.

- [ ] **Step 3: State what could not be verified here**

The workflow itself cannot run in this environment. Your report must say plainly which properties are **verified** (strict mode's two exit codes, the delta helper against a real rebuild, YAML parses, the refresh logic's no-op and diff paths) and which are **unverified until the first real run on GitHub** (the `paths-ignore` loop guard, the bot's PR creation and permissions, auto-merge availability, the fork-skip condition, comment find-or-create). Do not describe an unrun workflow as working.

- [ ] **Step 4: Context maintenance**

Invoke the `context-maintenance` skill for the items it owns. Note the irony to check: after Step 3 of Task 4 the skill should no longer ask for a graph-staleness disclosure — if it still does, that edit did not land.

- [ ] **Step 5: Commit anything outstanding**

```bash
git add -A && git commit -m "Final verification pass for CI-owned graph refresh" || echo "nothing to commit"
```

---

## Status note (2026-08-03, appended after execution — plan text above left as written)

**Task 3 Step 1 item 7 and Step 4 of this plan were wrong.** Both specified
`git diff --quiet graphify-out/graph.json` as the refresh job's commit gate.
`graphify update .` stamps `built_at_commit = HEAD` on every rebuild, so that
byte diff reports "changed" on every push to `main` even when no node or link
moved. The consequence was not cosmetic: the designed no-op path was
unreachable, and `chore/graph-refresh` would be force-pushed on every merge,
each force-push dismissing the PR's approvals so the PR carrying the real
graph could never hold a green approved state long enough to land — the same
silent staleness this plan exists to close, moved one hop downstream.

This plan contradicted its own spec, which recorded under "Facts established by
measurement" that a naive byte-diff gate "would fail on every CI run even when
the graph is semantically unchanged. Any comparison must normalise that field
away." D185's Consequences clause says the same. The implementer followed the
literal instruction; two review rounds on `graph.yml` caught a script-injection
vector and a `pipefail` abort but not this. The final whole-branch review
caught it.

Shipped instead (commit 8bfb8bc): the gate reads `grep -qx identical
/tmp/graph-delta.txt`, using the normalising helper the plan already required
for the PR body. A missing, empty, or substring-only delta file reads as
changed, erring toward committing a correct graph rather than skipping one.
