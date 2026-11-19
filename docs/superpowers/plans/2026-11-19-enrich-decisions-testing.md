# Enrich `decisions/testing/` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the 10 thin records in `decisions/testing/` from their sources and remove each `<!-- backfill: pending -->` marker.

**Architecture:** Enrichment PR 1 of 10 (spec § 8). It is the pilot: the other 9 domain PRs reuse this procedure.

**Tech Stack:** Markdown, `scripts/check-decision-ids.sh`.

**Spec:** `docs/superpowers/specs/2026-11-18-madr-decision-ledger-design.md` (§ 5 template and field rules, § 8 enrichment).

## Global Constraints

- Fill sections "from those sources only". Write `Rationale unknown` where no source holds the answer (spec § 8).
- Never change the chosen option text in Decision Outcome, or the `Decided:` line in Evidence (D564).
- Never change `id`, `status`, `date`, `supersedes` or `superseded-by`. Never rename a file.
- Every heading stays, in template order (spec § 5).
- Never invent a cost. A `Bad, because` line needs a source.
- Evidence lists every source used, by repo path, commit hash or PR number, and names the sections each source rebuilt.
- Remove `<!-- backfill: pending -->` from each record the task touches.
- Allowed sources: `docs/superpowers/specs/**`, `docs/superpowers/plans/**`, the commit and PR that added the record to the old domain file, and PRs or commits those sources name.

## Review Focus

- A record whose citers are later specs that only *apply* the rule. Expected: Context comes from the originating source; later citers appear in Evidence as "applied in".
- A section filled with plausible but unsourced text. Expected: `Rationale unknown`.
- A reversal pair (D99 → D101). Expected: each record states only its own decision.
- A record with no spec or plan (D303, D345). Expected: sourced from the adding commit only, the rest `Rationale unknown`.
- A chosen option reworded. Expected: chosen option text byte-identical.

---

### Task 1: Enrich the 10 testing records

**Files:**
- Modify: the 10 files `decisions/testing/D*.md` (D0099, D0101, D0104, D0148, D0166, D0224, D0294, D0303, D0304, D0345)

- [ ] **Step 1:** For each record, find the originating source: the spec or plan dated on or just before the `Decided:` date that introduces the rule, and the adding commit (`git log -S "D<id>" --oneline origin/main -- decisions/testing.md DECISIONS.md`).
- [ ] **Step 2:** Fill Context, Decision Drivers, Considered Options, Consequences, Confidence, Revisit When, Confirmation and Pros and Cons from those sources.
- [ ] **Step 3:** Rewrite Evidence: keep `Decided:`, then 1 bullet per source with its path and the sections it rebuilt.
- [ ] **Step 4:** Remove the backfill marker.
- [ ] **Step 5:** Run `bash scripts/check-decision-ids.sh`. Expected: `OK`.
- [ ] **Step 6:** Run `git diff origin/main -- decisions/testing | grep -E '^-(Chosen option|Decided)'`. Expected: no output.
- [ ] **Step 7:** Commit `docs(decisions): enrich testing records from specs and plans`.
