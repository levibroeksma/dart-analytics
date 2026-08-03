# Knowledge-Graph Refresh in CI — Design

> status: canonical (until superseded)
> scope: `.github/workflows/`, `scripts/refresh-graph.sh`, knowledge-graph freshness
> updated: 2026-08-03

---

## Problem

`graphify-out/graph.json` is committed and consulted before broad codebase
exploration (root `CLAUDE.md`: "Consult before broad grep/exploration"). It is
refreshed by `scripts/refresh-graph.sh`, wired into `npm run validate:app` and
a local git hook.

That script **warns and exits 0** when the `graphify` CLI is absent:

```bash
if ! command -v graphify >/dev/null 2>&1; then
  echo "WARN: graphify CLI not installed — knowledge graph not refreshed" >&2
  exit 0
fi
```

The CLI is a per-clone manual install (`app/CLAUDE.md`), so in any environment
that skipped it the refresh silently no-ops. Four consecutive branches shipped
with a "graph not refreshed" disclosure in `DECISIONS.md`'s deferred list.

**Measured consequence (2026-08-03).** Installing `graphifyy[sql]` 0.9.32 and
rebuilding on `main` @ `9aba1c7`:

| | nodes | links |
| --- | --- | --- |
| committed `graph.json` | 2,321 | 2,762 |
| rebuilt from the same tree | 2,863 | 4,073 |

542 nodes and 1,311 links missing — the graph does not contain the 501 modules,
`checkout-path.module.ts`, or the `decisions/**` tree. Its `built_at_commit` is
`391d2dd5a1f6d93d1a48159cb471afb19d5b83f3`, **a commit no longer reachable in
history**. An agent consulting it is reading a map of a codebase that stopped
existing several features ago — worse than no map, because it is confidently
wrong.

## Goal

Make graph freshness structural rather than dependent on each clone having a
manually-installed CLI. After this change, no contributor or agent needs
`graphify` locally for the committed graph to stay current.

## Non-goals

- **No LLM/semantic extraction.** The graph is AST-only by deliberate decision
  (`app/CLAUDE.md`: "never configure an LLM API key for graphify"). `graphify`
  prints a tip suggesting `GEMINI_API_KEY`; it is ignored, and no key is ever
  set in CI.
- **No change to how the graph is consumed.** Query patterns, the
  `graphify` skill, and the "map, not authority" rule are untouched.
- **Not a blocking gate.** See "Why not enforce" below.

---

## Facts established by measurement

These drove the design; each was verified, not assumed.

### 1. `graphifyy[sql]` installs and runs in a clean environment, no key needed

`pip install 'graphifyy[sql]'` → `graphify 0.9.32`; `python3 -c "import
tree_sitter_sql"` succeeds; `bash scripts/refresh-graph.sh` completes and
writes a graph. So CI can do this with no secrets.

### 2. The graph is deterministic except for exactly one field

Two consecutive rebuilds of the same tree, with `built_at_commit` removed and
`nodes`/`links` sorted, are **byte-identical**. Verified by running the rebuild
twice and comparing normalised JSON.

`built_at_commit` records the HEAD the graph was built from, so it changes on
every commit. **Consequence:** a naive `git diff --exit-code graphify-out/`
gate would fail on every CI run even when the graph is semantically unchanged.
Any comparison must normalise that field away.

### 3. The `[sql]` extra is load-bearing

`refresh-graph.sh` refuses to rebuild without `tree_sitter_sql`, because a
rebuild without it silently drops every SQL node (recorded in the script's
header, spec 2026-07-14). CI must install the extra, not bare `graphifyy`.

### 4. `refresh-graph.sh`'s warn-and-continue is wrong for CI

Exiting 0 on a missing CLI is correct for a local agent run — it degrades
rather than blocking unrelated work. In CI it is exactly the failure mode being
fixed: a broken install would make the job pass while refreshing nothing,
forever, silently. CI needs the opposite behaviour.

---

## Design

Two jobs in a new `.github/workflows/graph.yml`. Neither blocks a merge.

### Job 1 — `refresh` (the actual fix)

**Trigger:** `push` to `main`.

**`main` is a protected branch** (verified 2026-08-03 via the branches API:
`main` → `protected: true`; every other branch is unprotected). A bot therefore
**cannot push to it directly**, so this job opens a pull request instead of
pushing. That is the design, not a fallback.

**Behaviour:** install `graphifyy[sql]`, run `scripts/refresh-graph.sh` in
strict mode, and if `graphify-out/graph.json` changed, commit it to a
fixed-name branch and open (or update) a PR against `main`.

This makes CI the **only** place the graph is built. Local installs become
optional rather than a silent-failure dependency, which removes the root cause
instead of policing it.

- **Permissions:** `contents: write` (to push the graph branch) and
  `pull-requests: write` (to open the PR). `pr-gates.yml` already establishes
  the elevated-permission precedent with `pull-requests: write`.
- **Branch:** a single reused branch, `chore/graph-refresh`, force-updated on
  each run. One long-lived PR that always carries the latest graph, rather
  than a new PR per merge — otherwise a busy day produces a dozen graph PRs.
- **PR title:** `chore(graph): refresh knowledge graph`; body reports the
  node/link delta and the `main` commit it was built from.
- **Commit identity:** `github-actions[bot]`.
- **Loop guard:** the push trigger carries
  `paths-ignore: ['graphify-out/**']`, so merging the graph PR does not
  retrigger the job. This is preferred over `[skip ci]` in the message (which
  would also skip unrelated workflows) or an actor check (which silently
  disables the job if the bot name ever changes). Note the guard matters even
  in the PR flow: without it, merging a graph PR would immediately open
  another one.
- **Concurrency:** `group: graph-refresh-${{ github.ref }}`,
  `cancel-in-progress: true` — two merges in quick succession must not race on
  force-updating the branch.
- **No-op path:** if the rebuild produces no diff, the job succeeds without
  touching the branch or the PR. Expected to be the common case for docs-only
  merges.
- **Auto-merge:** enable it on the PR if the repo's settings permit, so a
  graph refresh does not sit waiting for a human. If auto-merge is unavailable,
  the PR simply waits — the graph is still correct and current in the PR, and
  the deferred-list entries stop accumulating either way.

**Simpler alternative, if you want it:** grant `github-actions[bot]` a
branch-protection bypass for `graphify-out/**` (a GitHub ruleset can scope a
bypass actor). Job 1 then pushes directly and the PR machinery disappears.
That is a repo-settings change only you can make; the spec assumes the
PR route because it needs no settings change and works today.

### Job 2 — `delta` (visibility, non-blocking)

**Trigger:** `pull_request` targeting `main`.

**Behaviour:** rebuild the graph in the PR's checkout, compare normalised
against the committed graph, and post (or update) a single PR comment
reporting the node/link delta:

```
Knowledge graph delta: +14 nodes, +22 links
Committed 2,863 / 4,073 → rebuilt 2,877 / 4,095
The graph will be refreshed automatically on merge (graph.yml).
```

- **Permissions:** `pull-requests: write`.
- **Never fails the PR.** Its purpose is to make graph impact visible at review
  time, not to gate.
- **Skips forks:** guarded on
  `github.event.pull_request.head.repo.full_name == github.repository`, since a
  fork PR's token cannot comment.
- **Updates rather than appends** — one comment per PR, edited on each push, so
  a long-running PR doesn't accumulate a dozen delta comments.

### Strict mode for `scripts/refresh-graph.sh`

Add an opt-in `GRAPH_REFRESH_STRICT=1` env var. When set, the two soft exits
(missing CLI, missing `[sql]` extra) become hard failures with exit 1. Default
behaviour is unchanged, so local and agent runs keep degrading gracefully.

Both CI jobs set `GRAPH_REFRESH_STRICT=1`. Without it a broken install
reproduces today's silent no-op inside CI, which would be a worse outcome than
the status quo because it would *look* solved.

### Version pinning

Pin to a compatible range — `graphifyy[sql]>=0.9.32,<0.10` — in the workflow.
Node counts are a function of the extractor's behaviour; an unpinned minor
bump could rewrite the whole graph and produce a large unexplained bot commit.
A deliberate pin bump is then a reviewable change.

---

## One-time stale-graph correction

The 2,321 → 2,863 node gap is **pre-existing** and must not be delivered as a
side effect of the workflow's first auto-run — that would land a ~500-node diff
in an unreviewed bot commit.

Refresh the graph once, explicitly, in this same change, as its own commit with
the before/after counts in the message. The workflow then starts from a correct
baseline and its first real run should be a no-op or a small delta.

---

## Why not enforce (option B, considered and rejected)

A blocking `verify` gate — rebuild, normalise, fail on drift — is more
consistent with how this repo treats its other 15 invariants, and it would
have correctly failed all four recent branches.

Rejected because it makes `graphify` a **hard prerequisite for contributing**:
any PR touching code would fail until the author installed `graphifyy[sql]`
locally and committed a rebuilt graph. That requirement is exactly what has not
held in practice, and a gate whose only remedy is an install step people skip
produces blocked PRs, not fresh graphs.

Option A inverts it: the graph is always fresh *because* no human is in the
loop. If graph staleness later proves to matter enough to block on, B can be
layered on top once A has made local installs unnecessary — the normalised
comparison this spec specifies for Job 2 is the same logic a gate would need.

---

## Risks and mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Bot push retriggers the workflow (infinite loop) | `paths-ignore: ['graphify-out/**']` on the push trigger; the bot commit touches nothing else |
| Two merges race on pushing `graph.json` | `concurrency` group per ref, `cancel-in-progress` |
| A broken install silently refreshes nothing | `GRAPH_REFRESH_STRICT=1` turns both soft exits into failures |
| An extractor version bump rewrites the graph | Version pinned to `>=0.9.32,<0.10`; bumps are reviewed |
| SQL nodes vanish from the graph | The `[sql]` extra is installed explicitly and `refresh-graph.sh` already refuses without it |
| Bot commit on a protected `main` | **Confirmed protected** — Job 1 opens a PR from a reused `chore/graph-refresh` branch instead of pushing. Resolved in the design above, not left to implementation |
| Graph PRs pile up | One reused branch, force-updated; a single long-lived PR, never one per merge |
| Graph PR sits unmerged | Auto-merge if permitted. Unmerged is still an improvement on the status quo: the refresh exists and is visible instead of being silently skipped |
| CI cost per merge | The rebuild takes well under a minute on this repo's size; the `delta` job runs only on same-repo PRs |

---

## Resolved before implementation

The one open question — whether `main` forbids a direct bot push — was
**checked, not deferred**: `main` is `protected: true` (branches API,
2026-08-03), every other branch is unprotected. Hence the PR-based Job 1 above.
Had this been left for the implementer, the first run would have failed on a
permissions error that looks like a token problem rather than a policy one.

---

## Consumers to update

| File | Change |
| ---- | ------ |
| `.github/workflows/graph.yml` | New — both jobs |
| `scripts/refresh-graph.sh` | `GRAPH_REFRESH_STRICT` support; header note that CI is now the primary refresh path |
| `app/CLAUDE.md` + `app/AGENT.md` | The graphify install becomes **optional** (useful for local querying, no longer required for freshness). Both must stay byte-identical |
| Root `CLAUDE.md` + `AGENT.md` | Context Maintenance: graph refresh is CI-owned; a local warn is no longer a completion-report item |
| `.claude/skills/context-maintenance/SKILL.md` | Drop the "record graph-not-refreshed" step; note CI ownership |
| `docs/architecture/00-Context-Map.md` | Register `graph.yml`; update the `graphify-out/graph.json` row to say CI-maintained |
| `DECISIONS.md` → `decisions/context-system.md` | New decision recording CI-owned graph refresh, why enforcement was rejected, and the measured staleness that motivated it. Clear the four graph-staleness entries from the Deferred list |

---

## Verification

- `graph.yml` passes `actionlint` (or equivalent syntax check).
- The one-time refresh commit moves the graph to 2,863/4,073 and
  `built_at_commit` to a reachable commit.
- Job 1 dry-run: force a code change on a scratch branch, confirm the rebuild
  produces a diff and the commit step is reached (guarded so it does not
  actually push from a scratch branch).
- Job 1 loop guard: confirm a `graphify-out/**`-only push does not trigger the
  workflow.
- Job 2 on a real PR: confirm the delta comment posts, and that a second push
  edits rather than duplicates it.
- Strict mode: with `graphify` removed from `PATH` and
  `GRAPH_REFRESH_STRICT=1`, `refresh-graph.sh` exits non-zero; without the var,
  it still exits 0 with a warning.
- All 5 context gates and the app suite unaffected.

## Success criteria

A merge to `main` that changes code leaves `graphify-out/graph.json` current
without anyone having `graphify` installed, and `DECISIONS.md`'s deferred list
no longer accumulates graph-staleness entries.
