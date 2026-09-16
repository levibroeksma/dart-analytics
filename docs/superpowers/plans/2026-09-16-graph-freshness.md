# Knowledge-Graph Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `CLAUDE.md`'s claim that knowledge-graph freshness is CI-owned true, and make its failure mode visible instead of silent.

**Architecture:** Three moving parts, deliberately sequenced. The already-rebuilt `chore/graph-refresh` head lands first and clears the staleness on its own. Then `.github/workflows/graph.yml` gains an `issues: write` permission and replaces its run-summary-only 403 fallback with an open-or-update tracking issue, merged *while the blocking repo setting is still off* so the fallback proves itself on the next push to `main`. Only then are the settings flipped and the docs rewritten to describe measured behaviour.

**Tech Stack:** GitHub Actions, `actions/github-script@v7` (Octokit REST), Markdown docs, the repo's append-only `decisions/**` ledger.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-16-graph-freshness-design.md`. Issue: #345.
- Branch already checked out for this work: `fix/issue-345-graph-freshness`. Task 4 uses a second branch off `main`.
- This repo forbids git worktrees per root `CLAUDE.md`; the user explicitly authorised one for this task only. Do not generalise it.
- Never modify applied migrations. No `app/` or `database/` code changes in this plan, so `validate:app` does not apply.
- `decisions/**` is append-only: never edit or delete an existing block. The new decision is `D286` (highest existing is `D285`).
- Do not commit unless the step says to. Every PR targets `main`; at most one open task branch may target another.
- Exact label strings, all of which already exist: `discovered-work`, `type:infrastructure`, `severity:high`.
- Exact tracking-issue marker: `<!-- graph-refresh-blocked -->`. Exact title: `graph: refresh PR could not be opened`.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. PR bodies end with the Claude Code generation line.

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `.github/workflows/graph.yml` | Rebuild the graph on push to `main`; land it via PR; when it cannot, file a tracking issue. Only the `refresh` job's `permissions` block and its `Open or update the refresh PR` step change. The `delta` job is untouched. | 2 |
| `CLAUDE.md` | Root agent manual — the freshness bullet at line 51. | 4 |
| `decisions/context-system.md` | Append-only ledger; gains `D286`. | 4 |
| `app/CLAUDE.md` | App manual — the `D185` citation at line 33. | 4 |
| `.claude/skills/validate-app/SKILL.md` | Validation skill — the `D185` citation at line 14. | 4 |

No new files. No source code changes.

## A Note On Testing

This plan has no unit tests, and that is a deliberate call rather than an omission. The subject is a
GitHub Actions job that only runs on `push` to `main`, whose entire behaviour is API calls made with a
token whose permissions are the thing under test. A local harness could only assert against a mock of
the exact API semantics that are in question, which is precisely the assumption that must not be
assumed. Verification is therefore empirical and staged: Task 2 merges the fallback while the blocking
setting is still off so the 403 path *must* execute, and Task 3 flips the setting so the success path
*must* execute. Each has a concrete observable named below. Do not claim either task complete on the
strength of a green workflow run alone — a green run is exactly what the bug looked like.

---

### Task 1: Land the pending graph refresh

Independent of everything else. Clears the 692-commit staleness using the rebuild CI already produced.

**Files:**
- Modify: none. This lands the existing `origin/chore/graph-refresh` head.

**Interfaces:**
- Consumes: nothing.
- Produces: `main` carrying `graphify-out/graph.json` at `built_at_commit e1465cb` or later. No later task depends on this.

- [ ] **Step 1: Confirm the pending head is still current and ahead by exactly one commit**

```bash
git fetch origin --prune
git rev-list --left-right --count origin/main...origin/chore/graph-refresh
git show origin/chore/graph-refresh:graphify-out/graph.json \
  | python3 -c "import sys,json; g=json.load(sys.stdin); print(g['built_at_commit'], len(g['nodes']), len(g['links']))"
```

Expected: `0	1` from the count, and a `built_at_commit` equal to current `origin/main`. If the count's
left number is not `0`, the branch has fallen behind `main`; do not rebase it by hand — push an empty
commit to `main` to let `graph.yml` rebuild it, then restart this task.

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base main --head chore/graph-refresh \
  --title "chore(graph): refresh knowledge graph" \
  --body "Lands the knowledge-graph rebuild CI has been force-pushing to chore/graph-refresh since August. The committed graph on main is stamped built_at_commit 13377e0 (2026-08-03), 692 commits behind; this head is built from current main and indexes 798 files / 5412 nodes. Refs #345. Mechanism fix follows in a separate PR."
```

Append the Claude Code generation line to the body per the repo's PR convention.

- [ ] **Step 3: Ask the owner to approve, then squash-merge**

The ruleset requires 1 approving review and code-owner review; the merge must be a squash (required
linear history plus required signatures — a rebase merge would replay unsigned bot commits and be
rejected).

```bash
gh pr merge --squash --delete-branch=false
```

Do **not** pass `--delete-branch`: `graph.yml` reuses `chore/graph-refresh` by force-push.

- [ ] **Step 4: Verify `main` now carries the fresh graph**

```bash
git fetch origin
git show origin/main:graphify-out/graph.json \
  | python3 -c "import sys,json; g=json.load(sys.stdin); print(g['built_at_commit'], len(g['nodes']))"
```

Expected: a `built_at_commit` reachable in recent history and a node count in the 5000s, not 2000s.

---

### Task 2: Replace the silent 403 fallback with a tracking issue

**Files:**
- Modify: `.github/workflows/graph.yml:19-21` (the `refresh` job's `permissions` block)
- Modify: `.github/workflows/graph.yml:91-187` (the `Open or update the refresh PR` step)
- Test: none — see "A Note On Testing" above. The observable is in Step 6.

**Interfaces:**
- Consumes: `/tmp/graph-pr-body.md` written by the existing `Write PR body` step; `MAIN_SHA` from the step env.
- Produces: a tracking issue identified by the literal marker `<!-- graph-refresh-blocked -->` in its body, labelled `discovered-work`, `type:infrastructure`, `severity:high`. Task 4's documentation describes this issue by that title and those labels.

- [ ] **Step 1: Confirm you are on the task branch and up to date with `main`**

```bash
git checkout fix/issue-345-graph-freshness
git fetch origin
git rebase origin/main
git log --oneline -3
```

Expected: the spec and plan commits for #345 on top of current `main`.

- [ ] **Step 2: Add `issues: write` to the `refresh` job permissions**

Replace lines 19-21 of `.github/workflows/graph.yml`:

```yaml
    permissions:
      contents: write
      pull-requests: write
```

with:

```yaml
    permissions:
      contents: write
      pull-requests: write
      # The 403 fallback below files a tracking issue. Issue creation is granted by
      # this scope alone and is NOT gated by the "Allow GitHub Actions to create and
      # approve pull requests" setting that blocks pulls.create -- which is the whole
      # reason the fallback uses an issue rather than, say, a draft PR.
      issues: write
```

- [ ] **Step 3: Pass `MAIN_SHA` to the PR step and replace its script**

The step currently at line 91 has no `env:` block; the tracking-issue body needs the commit. Replace
the whole `- name: Open or update the refresh PR` step (lines 91-187, through the end of the
`enablePullRequestAutoMerge` catch) with:

```yaml
      - name: Open or update the refresh PR
        if: steps.check.outputs.changed == 'true'
        env:
          MAIN_SHA: ${{ github.sha }}
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require("fs");
            const body = fs.readFileSync("/tmp/graph-pr-body.md", "utf8");
            const title = "chore(graph): refresh knowledge graph";
            const branch = "chore/graph-refresh";
            const { owner, repo } = context.repo;
            const compare =
              `https://github.com/${owner}/${repo}/compare/main...${branch}?expand=1`;

            // Idempotency key for the fallback issue. Kept in the body rather than
            // the title so a human can retitle the issue without the workflow losing
            // track of it and opening a duplicate on the next push.
            const MARKER = "<!-- graph-refresh-blocked -->";
            const BLOCKED_TITLE = "graph: refresh PR could not be opened";
            const BLOCKED_LABELS = ["discovered-work", "type:infrastructure", "severity:high"];

            // Scoped to the label the fallback itself applies: an unfiltered listing
            // would page past every open issue in a repo that routinely carries many.
            // An issue whose labels are stripped by hand is therefore invisible here
            // and yields one duplicate -- the acceptable end of that trade.
            async function findBlockedIssue() {
              const issues = await github.paginate(github.rest.issues.listForRepo, {
                owner,
                repo,
                state: "open",
                labels: "discovered-work",
                per_page: 100,
              });
              return issues.find((i) => !i.pull_request && i.body && i.body.includes(MARKER));
            }

            const { data: existing } = await github.rest.pulls.list({
              owner,
              repo,
              state: "open",
              head: `${owner}:${branch}`,
              base: "main",
            });

            let pr;
            if (existing.length > 0) {
              pr = existing[0];
              await github.rest.pulls.update({
                owner,
                repo,
                pull_number: pr.number,
                title,
                body,
              });
              core.notice(`Updated existing graph refresh PR #${pr.number}`);
            } else {
              try {
                const { data: created } = await github.rest.pulls.create({
                  owner,
                  repo,
                  title,
                  head: branch,
                  base: "main",
                  body,
                });
                pr = created;
                core.notice(`Opened graph refresh PR #${pr.number}`);
              } catch (err) {
                // The repo setting "Allow GitHub Actions to create and approve pull
                // requests" is off, so GITHUB_TOKEN gets a 403 on POST /pulls. The
                // refreshed graph is already pushed to the branch, so the work is not
                // lost, and failing the run would paint main red on every merge --
                // noise that gets ignored, which is how staleness crept in the first
                // place (D186). But a run-summary notice is read by nobody, which is
                // how it stayed crept in for 692 commits. File an issue instead: it
                // survives the run, it is visible where work is tracked, and it costs
                // main nothing. Any other error still fails the job.
                const forbidden =
                  err.status === 403 &&
                  /not permitted to create or approve pull requests/i.test(err.message);
                if (!forbidden) throw err;

                const issueBody = [
                  MARKER,
                  `The knowledge graph was rebuilt from \`main\` @ ${process.env.MAIN_SHA} and ` +
                    `pushed to \`${branch}\`, but GitHub Actions is not permitted to open pull ` +
                    `requests in this repository, so no refresh PR was created.`,
                  "",
                  `**Land it now:** [compare main...${branch}](${compare})`,
                  "",
                  `**Stop this recurring:** enable *Settings -> Actions -> General -> Workflow ` +
                    `permissions -> "Allow GitHub Actions to create and approve pull requests"*.`,
                  "",
                  `This issue is opened and updated automatically by \`.github/workflows/graph.yml\` ` +
                    `and closes itself once a refresh PR opens successfully.`,
                  "",
                  body,
                ].join("\n");

                const blocked = await findBlockedIssue();
                if (blocked) {
                  await github.rest.issues.update({
                    owner,
                    repo,
                    issue_number: blocked.number,
                    body: issueBody,
                  });
                  core.warning(
                    `Graph refreshed and pushed to ${branch}; PR creation is still blocked. ` +
                    `Updated tracking issue #${blocked.number}.`
                  );
                } else {
                  const { data: opened } = await github.rest.issues.create({
                    owner,
                    repo,
                    title: BLOCKED_TITLE,
                    body: issueBody,
                    labels: BLOCKED_LABELS,
                  });
                  core.warning(
                    `Graph refreshed and pushed to ${branch}, but this repo does not allow ` +
                    `GitHub Actions to open pull requests. Filed tracking issue #${opened.number}.`
                  );
                }

                await core.summary
                  .addHeading("Knowledge graph refreshed — PR not opened", 3)
                  .addRaw(
                    `The rebuilt graph is pushed to \`${branch}\`, but GitHub Actions is not ` +
                    `permitted to create pull requests in this repository. A tracking issue ` +
                    `carries the details.`
                  )
                  .addBreak()
                  .addRaw(`**Open it manually:** [compare main...${branch}](${compare})`)
                  .addCodeBlock(body, "text")
                  .write();
                return;
              }
            }

            // Reaching here means a PR exists, so the blocked condition has cleared.
            const blocked = await findBlockedIssue();
            if (blocked) {
              await github.rest.issues.createComment({
                owner,
                repo,
                issue_number: blocked.number,
                body: `Refresh PR #${pr.number} opened successfully — closing.`,
              });
              await github.rest.issues.update({
                owner,
                repo,
                issue_number: blocked.number,
                state: "closed",
              });
              core.notice(`Closed stale tracking issue #${blocked.number}`);
            }

            try {
              await github.graphql(
                `mutation($id: ID!) {
                  enablePullRequestAutoMerge(input: { pullRequestId: $id }) {
                    clientMutationId
                  }
                }`,
                { id: pr.node_id }
              );
              core.notice("Auto-merge enabled on the refresh PR.");
            } catch (err) {
              core.notice(
                `Auto-merge not enabled (repo setting off, or branch protection ` +
                `requirements unmet): ${err.message}`
              );
            }
```

- [ ] **Step 4: Verify the workflow still parses and the inlined script is valid JS**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/graph.yml')); print('yaml ok')"
python3 -c "
import yaml
w = yaml.safe_load(open('.github/workflows/graph.yml'))
step = [s for s in w['jobs']['refresh']['steps'] if s.get('name') == 'Open or update the refresh PR'][0]
open('/tmp/graph-script.js','w').write(step['with']['script'])
"
node --check /tmp/graph-script.js && echo "script ok"
```

Expected: `yaml ok`, then `script ok`. A syntax error in the inlined script would otherwise only
surface on a push to `main`, where the cost of a bad run is a missed refresh.

- [ ] **Step 5: Commit and open the PR**

```bash
git add .github/workflows/graph.yml
git commit -m "ci: file a tracking issue when the graph refresh PR cannot be opened

The 403 fallback wrote a run-summary notice and finished green, so six
weeks of graph staleness produced no signal anyone read. Swap the notice
for an open-or-update issue; issues:write is not gated by the setting
that blocks pulls.create. The success path closes the issue.

Refs #345.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin fix/issue-345-graph-freshness
```

Then open the PR with `gh pr create --base main`, titled
`ci: file a tracking issue when the graph refresh PR cannot be opened`, with a body covering: the
rebuild works and only `pulls.create` 403s; D186 documented the degradation as a run-summary notice
that nothing reads; this swaps it for an open-or-update tracking issue that self-closes; the run still
finishes green and non-403 errors still fail; and that it is **merged deliberately while the blocking
setting is still off** so the next push to `main` proves the fallback. Reference `#345` and end with
the Claude Code generation line.

- [ ] **Step 6: Merge, then observe the fallback fire — this is the test**

Ask the owner to approve, then squash-merge. The merge is itself a push to `main`, which triggers
`graph.yml`. Wait for the `refresh` job, then:

```bash
gh run list --workflow=graph.yml --limit 1
gh issue list --label discovered-work --state open --search "refresh PR could not be opened"
```

Expected: the run concludes **success**, and an open issue titled `graph: refresh PR could not be
opened` exists, carrying the compare link and the delta block.

If the run is green but no issue appears, the `issues: write` assumption is wrong — stop, read the run
log for the `refresh` job, and report before proceeding to Task 3. Do not flip the settings to make the
symptom disappear; that would destroy the only chance to observe this path.

- [ ] **Step 7: Confirm idempotency on a second push**

Push any trivial commit to `main` — the next merged PR will do; do not manufacture one solely for
this — and re-check:

```bash
gh issue list --label discovered-work --state open --search "refresh PR could not be opened" --json number \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)), 'matching issues')"
```

Expected: `1 matching issues`. Two means `findBlockedIssue` is not matching the marker; fix before Task 3.

---

### Task 3: Flip the two repo settings and observe the success path

**Files:**
- Modify: none. This task changes repository configuration, performed by the owner.

**Interfaces:**
- Consumes: the tracking issue opened in Task 2.
- Produces: an open refresh PR, and that tracking issue closed. Task 4 documents this as the steady state.

- [ ] **Step 1: Record the before state**

```bash
gh api repos/levibroeksma/dart-analytics/actions/permissions/workflow
gh api repos/levibroeksma/dart-analytics --jq '{allow_auto_merge}'
```

Expected, unchanged from discovery: `"can_approve_pull_request_reviews": false` and
`"allow_auto_merge": false`.

- [ ] **Step 2: Owner flips both settings manually**

The owner chose to make these changes by hand rather than have them applied via `gh api` from an agent
session. Do not flip them yourself even though the token has admin.

1. Settings -> Actions -> General -> Workflow permissions -> tick **Allow GitHub Actions to create and approve pull requests**. Leave the radio on *Read repository contents and packages permissions*; the `refresh` job declares its own scopes.
2. Settings -> General -> Pull Requests -> tick **Allow auto-merge**.

- [ ] **Step 3: Verify the settings took**

```bash
gh api repos/levibroeksma/dart-analytics/actions/permissions/workflow
gh api repos/levibroeksma/dart-analytics --jq '{allow_auto_merge}'
```

Expected: `"can_approve_pull_request_reviews": true`, `"default_workflow_permissions": "read"`,
`"allow_auto_merge": true`.

- [ ] **Step 4: Trigger a rebuild and observe the success path — this is the test**

The next merge to `main` suffices; if none is pending, the owner can re-run the latest `graph.yml`
workflow run. Then:

```bash
gh pr list --head chore/graph-refresh --state open
gh issue list --label discovered-work --state all --search "refresh PR could not be opened" --json number,state
```

Expected: one open PR titled `chore(graph): refresh knowledge graph`, and the tracking issue now
`CLOSED` with an automated closing comment naming that PR.

- [ ] **Step 5: Confirm auto-merge is actually armed**

```bash
gh pr view chore/graph-refresh --json autoMergeRequest,number
```

Expected: `autoMergeRequest` is non-null. If it is null, read the `Auto-merge enabled` / `Auto-merge not
enabled` notice in the run log — the ruleset's code-owner requirement can block arming, in which case
Task 4's wording must say the owner merges manually rather than approves-and-it-lands. **The docs
follow the observation, not the other way round.**

- [ ] **Step 6: Approve and let it land**

Owner approves the refresh PR. With auto-merge armed it squash-merges itself; that is the steady state
the documentation will describe.

---

### Task 4: Rewrite the documentation to match measured behaviour

Runs only after Tasks 2 and 3 have produced their observations. The wording depends on what Task 3
Step 5 actually showed.

**Files:**
- Modify: `CLAUDE.md:51`
- Modify: `decisions/context-system.md` (append `D286` after the last block)
- Modify: `app/CLAUDE.md:33`
- Modify: `.claude/skills/validate-app/SKILL.md:14`

**Interfaces:**
- Consumes: the observed behaviour from Tasks 2 and 3.
- Produces: nothing downstream.

- [ ] **Step 1: Branch from current `main`**

```bash
git fetch origin
git checkout -b docs/issue-345-graph-freshness-model origin/main
```

A fresh branch off `main`, not a stack on `fix/issue-345-graph-freshness` — that branch has already
merged by now.

- [ ] **Step 2: Rewrite the root `CLAUDE.md` freshness bullet**

Replace line 51:

```markdown
- **Freshness is CI-owned**: `.github/workflows/graph.yml` rebuilds the graph on every merge to `main` and opens a PR; it is no longer a local completion-report item.
```

with:

```markdown
- **Freshness is CI-owned, and landing it needs one approval**: `.github/workflows/graph.yml` rebuilds the graph on every merge to `main`, pushes it to `chore/graph-refresh`, opens a PR and arms auto-merge; the repo ruleset still requires a human approval, which a bot cannot give itself. If the PR cannot be opened at all, the workflow files a `graph: refresh PR could not be opened` issue rather than passing silently (D286). Either way it is not a local completion-report item.
```

- [ ] **Step 3: Append `D286` to `decisions/context-system.md`**

Append after the file's last decision block. `D285` is the highest id in use; confirm with
`grep -rhoE "^### D[0-9]+" decisions/ | grep -oE "[0-9]+" | sort -n | tail -1` before writing.

```markdown
### D286 — A degradation nobody can see is an outage; the graph fallback files an issue
Status: Accepted · Date: 2026-09-16 · Supersedes: D186 · Refines: D185
Decision: `graph.yml`'s 403 fallback opens or updates a tracking issue (`graph: refresh PR could not be opened`, labelled `discovered-work`/`type:infrastructure`/`severity:high`, keyed on a `<!-- graph-refresh-blocked -->` body marker) instead of only writing a run summary, and closes that issue on the next run that does open a PR. `issues: write` is added to the `refresh` job. The repo settings *Allow GitHub Actions to create and approve pull requests* and *Allow auto-merge* are both enabled, so the documented path is: CI rebuilds, opens the PR and arms auto-merge; the owner approves; it squash-merges. The ruleset's approval requirement is not waived and the graph refresh is not exempted from it.
Reason: D186's fallback was correct about not painting `main` red and wrong about where the signal goes. A `core.warning` plus a run summary is read by nobody: the committed graph reached 692 commits and six weeks of staleness — every subsystem in `app/src/modules/exercise/`, `training/`, `dartbot/` and migrations 0024–0032 missing from the map agents are told to consult *first* — while every graph run reported success. Absence from the graph reads as absence from the repo, so the failure mode was agents confidently answering from a map of a codebase that no longer existed.
Consequences: the blocked state is now visible in the issue list, where work is already tracked, and costs `main` nothing — the run still finishes green and any non-403 error still fails the job, both per D186. The fallback's issue lookup is scoped to the `discovered-work` label, so an issue whose labels are stripped by hand goes unmatched and the next run opens a duplicate. With both settings on this path should stay dormant; it was nonetheless merged *before* the settings were flipped, so the 403 branch executed at least once against the real API rather than being assumed correct from the docs. One human approval per refresh remains, which is the price of not making a bot a ruleset bypass actor — direct-commit-to-`main` was the considered alternative and was rejected on least privilege.
```

- [ ] **Step 4: Re-point the two `D185` citations**

In `app/CLAUDE.md` line 33, replace `CI owns it (D185)` with `CI owns it (D185, D286)`.

In `.claude/skills/validate-app/SKILL.md` line 14, replace `graph freshness is CI-owned per D185` with
`graph freshness is CI-owned per D185 and D286`.

Both sentences otherwise stay as they are — "do not stage `graphify-out/graph.json` yourself" is still
correct and still for the same reason.

- [ ] **Step 5: Reconcile the wording with what Task 3 measured**

Re-read the three edits against the Task 3 Step 5 result. If auto-merge did **not** arm, change
"opens a PR and arms auto-merge; the owner approves; it squash-merges" to "opens a PR; the owner
approves and squash-merges it" in both `CLAUDE.md` and `D286`. A decision block that overstates
automation is the defect this task exists to remove.

- [ ] **Step 6: Run the documentation gates**

```bash
bash scripts/check-context-map.sh
bash scripts/check-decision-ids.sh
bash scripts/check-doc-links.sh
```

Expected: all three exit 0. `check-decision-ids.sh` hashes migrated decision rows — if it objects to
`Supersedes: D186 · Refines: D185` on one line, read the script for the accepted header shape and match
it rather than inventing one.

Then run the `run-all-gates` skill for the docs area to catch any gate not listed here.

- [ ] **Step 7: Commit and open the PR**

```bash
git add CLAUDE.md decisions/context-system.md app/CLAUDE.md .claude/skills/validate-app/SKILL.md
git commit -m "docs: state the real graph-freshness model (D286)

CLAUDE.md claimed CI opened a refresh PR. It could not, for six weeks,
and said so only in a run summary. Record what the mechanism now does
and what it still needs from a human.

Closes #345.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin docs/issue-345-graph-freshness-model
```

Then open the PR with `gh pr create --base main`, titled `docs: state the real graph-freshness model
(D286)`, with a body stating that the mechanism changed in the previous PR and the settings were
flipped by hand, and that this makes the docs describe the behaviour actually observed: CI rebuilds,
opens the refresh PR and arms auto-merge, the owner approves and it squash-merges; a blocked open files
a `graph: refresh PR could not be opened` issue instead of a silent green run; `D286` records it,
superseding D186 and refining D185. Use `Closes #345` and end with the Claude Code generation line.

- [ ] **Step 8: Run the `context-maintenance` skill before claiming done**

Mandatory per root `CLAUDE.md`. It covers the CLAUDE.md sync, context-map registration, decisions
entry, gate scripts, branch/PR check and discovered-work capture for this change.

- [ ] **Step 9: Exit the worktree**

This task ran in a git worktree by explicit one-off authorisation, against the repo's standing rule.
Once the PRs are open, leave it so the main working copy is the default again.

---

## Discovered-work watch

Anything noticed while executing this plan that the plan does not name — a stale doc, a broken gate, a
second workflow with the same silent-degradation shape — is captured as a GitHub issue via the
`capturing-discovered-work` skill and named in the completion report. It is not fixed in this pass.

One is already known and deliberately unfixed here: `ARCHITECTURE-AUDIT-2026-09-16.md` sits untracked
in the working copy and carries findings beyond D1. Its disposition is not this task's call.
