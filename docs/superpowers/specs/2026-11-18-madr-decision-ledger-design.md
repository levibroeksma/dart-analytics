# MADR decision ledger — design

This design moves the decision ledger to 1 MADR 4.0 file per decision. It also adds a merge-time id bot. The reader is the builder who writes the plan and the scripts.

## 1. Intent

The owner wants 2 outcomes:

- The ledger follows MADR 4.0 practice, with the owner's template (§ 5).
- Parallel worktrees never collide. No 2 branches edit the same ledger file, and no 2 branches take the same id.

Today, 538 decisions live in 10 domain files under `decisions/**`. Every branch that adds a decision appends to one of those files and reserves the next id with `scripts/next-decision-id.sh`. Parallel branches conflict on both.

## 2. Goals, non-goals, anti-goals

Goals:

- 1 file per decision, in the owner's template.
- A new decision gets its id at merge time, from a bot, not from the author.
- No hand-edited file that every decision PR touches. The index is generated.
- Existing ids `D1`–`D564` keep their numbers. The 780 files that cite them stay valid.

Non-goals:

- Enriching the records in PR 1. Enrichment comes in later PRs, 1 per domain (§ 8).
- Changing what any decision decided.
- Renumbering or closing the 20 unissued ids.

Anti-goals (a failure even if the scripts work):

- Invented rationale. A section without a source says `Rationale unknown`. It never holds a plausible guess.
- A merged PR on `main` that still holds a pending decision.
- A new shared file that brings the merge conflicts back.

## 3. Constraints

- `main` requires signed commits (D289). A bot cannot push to `main`.
- The repo allows both squash and merge commits today (`main` history shows both). The bot commits to the PR branch, so the final squash commit carries GitHub's signature. The owner must confirm the repo settings (§ 10).
- Pushes made with the default `GITHUB_TOKEN` do not start new workflow runs. Required checks on the bot's commit therefore never run unless the bot uses another token (§ 10).
- Root `CLAUDE.md` and `DECISIONS.md` say decisions are append-only. This design needs a new decision that supersedes that rule (§ 6).
- `scripts/check-decision-ids.sh` hashes the 163 migrated table rows. The split retires that check.
- The org forbids speculation. Backfilled text cites its source or says `Rationale unknown`.

## 4. Approaches

Id assignment. The owner picked **A**.

| Option | How | Trade-off |
| ------ | --- | --------- |
| A. Bot before merge (picked) | The PR holds `id: pending`. A `ready-to-merge` label starts a workflow that takes the next id from `main` and commits to the PR branch. | Needs squash merge and a token that re-runs checks. 2 PRs labeled at once can race; the gate catches it. |
| B. Bot after merge | A post-merge workflow opens a numbering PR. | `main` holds unnumbered decisions between merges. Needs a bypass actor, like the graph refresh PR. |
| C. Date-slug ids | New ids look like `2026-11-18-madr-ledger`. | No bot. Loses short `D565` citations. |

Rollout. The owner picked **split first, enrich later**:

| Option | Trade-off |
| ------ | --------- |
| 1. Mechanical split, then 1 enrichment PR per domain (picked) | Every PR is reviewable against its sources. Records stay thin until their domain PR lands. |
| 2. Split and enrich in 1 PR | Too large to review. Raises the risk of invented rationale. |
| 3. Enrich only records with a linked spec or plan | Cheaper. The ledger stays uneven for good. |

## 5. File layout and format

Layout:

- 1 directory per current domain: `decisions/architecture/`, `decisions/database/`, `decisions/api/`, `decisions/game-engine/`, `decisions/testing/`, `decisions/context-system/`, `decisions/frontend/{architecture,astro,alpine,style}/`.
- File name: `D<4-digit id>-<slug>.md`, for example `decisions/database/D0532-migrations-closed-to-edits.md`. The slug comes from the title, in lower case, at most 6 words.
- A pending decision lives at `decisions/<domain>/pending-<slug>.md` until the bot numbers it.
- The 10 old domain files are deleted.

Each file uses the owner's template, given here in full. The template becomes `decisions/TEMPLATE.md` in PR 1. It adds 1 key, `id`, at the top.

````markdown
---
id: pending               # D0532, or pending before the bot runs
status: proposed          # proposed | accepted | rejected | deprecated | superseded
date: YYYY-MM-DD          # date of last status change
origin: contemporaneous   # contemporaneous | backfilled
original-date:            # backfilled only: approximate date the decision took effect
tags: [backend, data]     # free-form subjects; drive the generated index
scope: repository         # repository | package:<name> | organisation
decision-makers: [team-or-role]   # prefer roles/team handles over personal names
consulted: []
informed: []
supersedes:               # e.g. D0007
superseded-by:
---

# {Short title stating problem and chosen solution}

## Context and Problem Statement
{2–4 sentences. What forces are at play? Link to issues/RFCs rather than copying them.}

## Decision Drivers
* {driver}

## Considered Options
* {Option A}
* {Option B}
* {Do nothing / status quo}

## Decision Outcome
Chosen option: "{Option A}", because {justification tied to the drivers}.

### Consequences
* Good, because {…}
* Bad, because {…}   <!-- mandatory: at least one real cost -->
* Neutral, because {…}

### Confidence
{High | Medium | Low} — {why}

### Revisit When
{Concrete triggers}

### Confirmation
{How compliance is checked: code review rule, architecture test, lint rule, dashboard.}

## Pros and Cons of the Options
### {Option A}
* Good, because {…}
* Bad, because {…}

## Evidence / More Information
{Links to design docs, benchmarks, PRs, commits. For backfilled ADRs: the artefacts
the record was reconstructed from, plus "Rationale unknown" where it cannot be verified.}
````

Every heading is required, in this order, in every file. The frontmatter keys follow this order. A section without a source holds the line `Rationale unknown — backfill pending.` Nothing is omitted, so the validator checks 1 fixed shape.

Field rules:

| Field | Rule |
| ----- | ---- |
| `id` | `D0532`, or `pending` before the bot runs. |
| `title` | Not a field. The level-1 heading holds it. |
| `status` | MADR value. `Accepted` maps to `accepted`. A record that another record supersedes gets `superseded`. |
| `date` | Date of the last status change. For a superseded record, this is the date of the record that supersedes it. If the source has no date (20 table rows cite only `P21–30`-style ranges), `date` stays empty. The validator allows an empty `date` only on ids up to D564. |
| `origin` | `contemporaneous` for every existing record. They were written when decided. |
| `original-date` | Empty for existing records. |
| `tags` | The domain name, plus each `load-when` keyword from the old file's header that appears in that record's own text. |
| `scope` | `repository`. |
| `decision-makers` | `[owner]`. |
| `supersedes`, `superseded-by` | Ids, from the old `Supersedes:` lines. The split fills `superseded-by` on the older record. `Supersedes: none.` is dropped. |

The original decision date never moves. Evidence holds it as `Decided: YYYY-MM-DD` (or the `P`-range source), so a later status change does not lose it.

Mapping in the split:

| Old part | New section |
| -------- | ----------- |
| Table row "Decision" or block `Decision:` | Decision Outcome, "Chosen option" |
| Table row "Rationale" or block `Reason:` | Context and Problem Statement, plus the "because" clause |
| Block `Consequences:` | Consequences, as written. No good/bad split is invented. |
| Table row "Source" (`P21–30`, a date) | Evidence |
| A `Supersedes:` line with another relation ("Extends D41", "Refines D86", about 30 of them) | Evidence, as written. No new frontmatter key. |
| Missing parts | `Rationale unknown — backfill pending.` |

A record that the split leaves thin carries the marker `<!-- backfill: pending -->`. The enrichment PR for its domain removes the marker.

The split copies text as it is. It changes no wording beyond the mapping above.

## 6. Rule changes

1 new decision, numbered by hand in PR 1, because the bot does not exist yet:

- **Decision records are files; the choice is fixed, the record is not.** It supersedes the append-only rule in the decision that set it (the builder finds that id in `decisions/context-system.md`). The chosen option and the `Decided:` date in Evidence never change. A reversal is still a new record with `supersedes`. Context, drivers, options, evidence, and `status`/`superseded-by` may be filled in later.

The PR updates these to match:

- Root `CLAUDE.md`: § Context Maintenance and the Hard Invariants line on decisions.
- `docs/CLAUDE.md`: the "Why a decision was made" routing line.
- `DECISIONS.md`: the routing table points to directories. The "How to add a decision" section describes `pending-<slug>.md`, the template and the label. The Deferred list stays.
- `docs/architecture/00-Context-Map.md`, `00-File-Inventory.md`, and the other docs in § 7 that name the old files.
- Skills: `context-maintenance`, `run-all-gates`, `syncing-design-system`, `authoring-game-rules/references/amending.md`.

## 7. Tooling

New or changed:

| Item | Job |
| ---- | --- |
| `scripts/split-decisions.mjs` | One-shot. Reads the 10 domain files, writes 1 file per record. Deleted after PR 1 merges, as D550 did with the last split scripts. |
| `scripts/check-decision-ids.sh` (rewrite) | Every file has valid frontmatter. Ids are unique. The file name matches the id. `supersedes` and `superseded-by` point both ways. The 538 ids present at the split still exist. No old hash check. |
| `scripts/check-decision-pending.sh` | Fails if any `pending-*.md` file or `[pending:<slug>]` citation exists. Runs in the `decision-ledger` job of `quality.yml`, a required check on every PR, so a pending PR cannot merge. |
| `scripts/decision-index.sh` | Prints the index on demand, filtered by tag, status or domain. Its output is never committed. |
| `scripts/number-decisions.sh` | Run by the bot. Takes the next id from `origin/main`, renames each pending file, sets `id`, rewrites `[pending:<slug>]` citations in files the PR changed. |
| `.github/workflows/decision-ids.yml` | Runs on the `ready-to-merge` label. Runs `number-decisions.sh`, commits through the API, dispatches `checks.yml`, removes the label. |

Retired: `next-decision-id.sh`, `renumber-decision.sh`, `decision-row-hashes.tsv`, `decision-map.txt`. Plans that reserve ids stop doing so.

Also touched, because they parse the old layout: `.claude/hooks/context-drift.sh`, `scripts/check-{skill-pointers,context-map,context-budget,doc-links,doc-sync,gate-wiring}.sh`, `.github/workflows/quality.yml`, `app/tests/scripts/erasure.test.ts`, and a comment in `app/src/modules/stats/sections/heatmap-density.module.ts`.

Bot flow:

1. The author writes `decisions/<domain>/pending-<slug>.md` and cites it as `[pending:<slug>]`.
2. The author adds the `ready-to-merge` label.
3. The workflow numbers the decisions, commits to the PR branch through the GraphQL `createCommitOnBranch` API (GitHub signs the commit), dispatches `checks.yml` on the new commit and removes the label.
4. The checks run on the new commit. `check-decision-pending.sh` passes.
5. The owner squash-merges.

A race between 2 PRs ends with 2 equal ids. The uniqueness check fails on whichever PR is checked against the newer `main`. The owner re-adds the label to that PR; the bot renumbers the branch's own colliding ids and rewrites their citations in the files the PR changed.

### Loading decisions (designer's call)

An agent no longer loads a whole domain file. It runs `scripts/decision-index.sh --domain <name>` (or `--tag`), reads the 1-line index, and then reads only the files it needs. The context map's packs and line 47 change to say this.

- `00-File-Inventory.md` gets 1 row per domain directory, not 1 per file. The `~Tokens` value prices the index output.
- `check-context-map.sh` and `check-context-budget.sh` treat a domain directory as 1 unit. They accept YAML frontmatter in place of the HTML `status` header for `decisions/**`.

### Old file paths (designer's call)

245 files cite paths like `decisions/api.md`.

- Canonical docs (`docs/architecture/**`, skills, `CLAUDE.md` files, `docs/game-rules/**`) get rewritten to the directory path.
- `docs/superpowers/**` is historical, so it stays as is.
- Decision text is copied as is, so old paths inside it stay too.
- `check-doc-links.sh` ignores the 10 retired paths in those 2 places only, from a fixed list in the script.

### Cutover (designer's call)

After PR 1 merges, a branch that appended a block to an old domain file, or reserved an id, converts that block to `pending-<slug>.md` when it rebases. The bot then numbers it. A reserved id is not kept. The rule that rejected a hand-numbered new id above D564 was dropped: it is unenforceable, and the bot and the pending gate cover the case. The PR 1 description tells the owner to check open PRs for this before merging.

## 8. Enrichment PRs (after PR 1)

1 PR per domain, 10 in all. Each PR:

- Reads the specs in `docs/superpowers/specs/` and the plans in `docs/superpowers/plans/` that cite the domain's ids, plus the PRs and commits they name.
- Fills Context, Decision Drivers, Considered Options, Pros and Cons, Confidence, Revisit When and Confirmation from those sources only.
- Writes `Rationale unknown` where no source holds the answer.
- Lists every source in Evidence, and marks which sections it rebuilt.
- Removes the `backfill: pending` marker.

The plan for PR 1 does not cover these. Each enrichment PR gets its own short plan.

## 9. Left to the builder

- How the split script parses the 2 old formats.
- The exact slug rule for long titles.
- Which existing workflow job runs the new checks.
- The fixtures and tests for the scripts.

## 10. Repo settings (owner's answers, 2026-11-18)

- **Race guard.** `main`'s branch protection requires branches to be up to date before merge. The uniqueness check then runs against the newest `main`.
- **Merge method.** The repo allows squash merge only. Merge commits and rebase merge are switched off.
- **Bot token.** The bot uses the default `GITHUB_TOKEN`. It commits through the API, so the commit is signed and passes the verified-signature rule; a CLI push would be unsigned. A push by `GITHUB_TOKEN` starts no `pull_request` run, so the bot dispatches `checks.yml` (which has `workflow_dispatch`) on the branch. It runs `check-decision-ids.sh` and `check-decision-pending.sh` itself and posts the result as the informational `decision-numbering` commit status on its own commit, on failure paths too. The required check is the `decision-ledger` job in `quality.yml` (called by `checks.yml`), which runs both gates on every PR and on the bot's dispatched run.

The owner changes these settings by hand in GitHub. The plan lists them as a manual step before PR 1 merges. A human must check them: branch protection is a security setting.
