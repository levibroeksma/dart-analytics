---
id: D0564
status: accepted
date: 2026-11-19
origin: contemporaneous
original-date:
tags: [context-system, docs, gate, workflow, CI]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0184
superseded-by:
---

# Decision records are MADR files; the choice is fixed, the record is not

## Context and Problem Statement
538 decisions lived in 10 domain files under `decisions/**` (D184). Every branch that added a decision appended to one of those files. It reserved the next id with `scripts/next-decision-id.sh`. Parallel branches conflicted on both. The append-only rule also froze each record in its first, often terse, form. A migrated row could never gain the context, options or evidence a later reader needs.

## Decision Drivers
* The ledger follows MADR 4.0 practice, with the owner's template.
* Parallel worktrees never collide: no 2 branches edit the same ledger file, and no 2 branches take the same id.
* No hand-edited file that every decision PR touches; a script generates the index.
* Existing ids `D1`–`D564` keep their numbers, so the files that cite them stay valid.
* No invented rationale: a section without a source says `Rationale unknown`.

## Considered Options
* A. Bot before merge: the PR holds `id: pending`; a `ready-to-merge` label starts a workflow that takes the next id from `main` and commits to the PR branch.
* B. Bot after merge: a post-merge workflow opens a numbering PR.
* C. Date-slug ids, such as `2026-11-18-madr-ledger`.
* Status quo: append to the 10 domain files and reserve ids by hand.

## Decision Outcome
Chosen option: "A. Bot before merge, with 1 MADR file per decision under `decisions/<domain>/D####-<slug>.md`, split first and enriched later", because only A removes both the shared-file conflict and the id race. It also keeps short `D####` citations and leaves `main` free of unnumbered decisions.

This decision replaces the append-only rule of D184. The chosen option and the `Decided:` date in Evidence never change; a reversal is still a new record with `supersedes`. A later PR may fill in context, drivers, options, evidence, and `status`/`superseded-by`.

### Consequences
* Good, because a new decision is a new file, so 2 branches never edit the same ledger file.
* Good, because the id comes from the bot at merge time, from `origin/main`, so authors no longer reserve ids.
* Good, because an enrichment PR can fill a record from its sources without breaking a rule.
* Bad, because the 538 split records stay thin (`<!-- backfill: pending -->`) until their domain's enrichment PR lands; until then most sections say `Rationale unknown — backfill pending.`
* Bad, because old paths such as `decisions/api.md` stay dead in `docs/superpowers/**` and in copied decision text; `check-doc-links.sh` must ignore them there.
* Bad, because the bot depends on GitHub settings the owner sets by hand: squash merge only, up-to-date branches, required `decision-ledger` status. It also depends on a dispatched `checks.yml` run to satisfy the required checks on the bot's own commit. Nobody can test this until after this PR merges.
* Bad, because a branch that appended to an old domain file or reserved an id must convert its block to `pending-<slug>.md` when it rebases; a reserved id is not kept.
* Neutral, because the index is no longer a file: `scripts/decision-index.sh` prints it on demand.

### Confidence
Medium — the split and the checker are tested against the 10 old files; the bot flow is untested until it runs on a real PR after merge.

### Revisit When
* The bot fails to number a PR, or its dispatched checks do not satisfy the required checks.
* 2 labeled PRs race and the uniqueness check does not catch it.
* The owner changes the repo's merge method or branch protection.

### Confirmation
`scripts/check-decision-ids.sh` validates every record's frontmatter and headings, id uniqueness, file name against id, two-way `supersedes`/`superseded-by` links, and that every id in `scripts/decisions/baseline-ids.txt` still exists. `scripts/check-decision-pending.sh` fails while any `pending-*.md` file or pending-slug citation exists, so a PR with an unnumbered decision cannot merge.

## Pros and Cons of the Options
### A. Bot before merge
* Good, because `main` never holds an unnumbered decision.
* Good, because citations keep the short `D####` form.
* Bad, because it needs squash merge and a dispatched checks run, since a `GITHUB_TOKEN` commit starts no `pull_request` run.
* Bad, because 2 PRs labeled at once can race; the uniqueness gate catches it and the owner re-adds the label.

### B. Bot after merge
* Good, because no PR waits on a bot before merge.
* Bad, because `main` holds unnumbered decisions between merges.
* Bad, because it needs a bypass actor, like the graph refresh PR (D289).

### C. Date-slug ids
* Good, because no bot is needed.
* Bad, because it loses short `D565`-style citations.

### Status quo
* Good, because nothing changes.
* Bad, because parallel branches keep conflicting on the domain files and on ids.

## Evidence / More Information
Decided: 2026-11-19

* Spec: `docs/superpowers/specs/2026-11-18-madr-decision-ledger-design.md` (§ 1 drivers, § 4 options, § 6 rule change, § 7 tooling, § 10 repo settings).
* Plan: `docs/superpowers/plans/2026-11-18-madr-decision-ledger.md`.
* Branch: `docs/madr-adr-ledger`.
* Rollout picked with the owner: mechanical split first, then 1 enrichment PR per domain (spec § 4, § 8).
