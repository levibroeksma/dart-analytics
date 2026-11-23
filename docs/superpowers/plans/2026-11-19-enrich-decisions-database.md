# Enrich `decisions/database/` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the 50 thin records in `decisions/database/` from their sources and remove each `<!-- backfill: pending -->` marker.

**Architecture:** Enrichment PR 6 of 10 (spec § 8). It reuses the pilot procedure of `docs/superpowers/plans/2026-11-19-enrich-decisions-testing.md`, with the lessons of the pilot's review added to the constraints.

**Tech Stack:** Markdown, `scripts/check-decision-ids.sh`.

**Spec:** `docs/superpowers/specs/2026-11-18-madr-decision-ledger-design.md` (§ 5 template and field rules, § 8 enrichment).

## Global Constraints

- Fill sections from sources only. A section with no source says `Rationale unknown — no source found.` (owner-confirmed wording, 2026-11-19).
- Never change the chosen option text, the `Decided:` line, the frontmatter or a file name (D564).
- Every heading stays, in template order (spec § 5).
- Never invent a cost. A `Bad, because` line needs a source.
- A record states only its own decision. A link to a reversing record goes in Evidence.
- Keep the source's modality: a proposal stays a proposal. Check that a named job, script or file exists before claiming it does.
- Evidence lists every source by path, commit hash or PR number, and names the sections each source rebuilt. Later specs that only apply the rule appear as "Applied in".
- Allowed sources: `docs/superpowers/specs/**`, `docs/superpowers/plans/**`, the commit and PR that added the record, and PRs or commits those sources name.

## Review Focus

- A later spec that only applies the rule, used as its origin. Expected: listed as "Applied in".
- A section filled with plausible but unsourced text. Expected: `Rationale unknown — no source found.`
- A benefit credited to the wrong option in Pros and Cons. Expected: each benefit sits under the option that produces it.
- A proposal stated as fact. Expected: the source's modality.
- A chosen option reworded. Expected: chosen option text byte-identical.

---

### Tasks 1–4: Enrich 1 batch of at most 16 records each

**Files:**
- Modify: the thin records in `decisions/database/`, split into 4 batches by file order.

- [ ] **Step 1:** For each record, find the originating source (the spec or plan dated on or just before `Decided:`) and the adding commit (`git log -S "D<id>" --oneline origin/main -- decisions/ DECISIONS.md`).
- [ ] **Step 2:** Fill Context, Decision Drivers, Considered Options, Consequences, Confidence, Revisit When, Confirmation and Pros and Cons from those sources.
- [ ] **Step 3:** Rewrite Evidence: keep `Decided:`, then 1 bullet per source with the sections it rebuilt.
- [ ] **Step 4:** Remove the backfill marker.
- [ ] **Step 5:** Run `bash scripts/check-decision-ids.sh`. Expected: `PASS`.
- [ ] **Step 6:** Run `git diff origin/main -- decisions/database | grep -E '^-(Chosen option|Decided)'`. Expected: no output.
- [ ] **Step 7:** An independent reviewer checks each added sentence against its source; fix its findings.
- [ ] **Step 8:** Commit `docs(decisions): enrich database records from specs and plans`.
