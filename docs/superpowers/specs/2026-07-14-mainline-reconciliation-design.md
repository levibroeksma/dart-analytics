# Mainline Reconciliation & Release Governance Design

> **Date:** 2026-07-14
> **Status:** proposed design (autonomous architecture review — awaiting user approval)
> **Scope:** land the ~50-commit divergence on `main`, define a branch-integration rule so it cannot recur, and close the ADR-mechanism ambiguity.
> **Branch:** `claude/darts-analytics-arch-review-nvyboi`

---

## Problem

`main` is ~50 commits behind the active development line and there are **zero open pull requests**. Everything the project treats as "current state" exists only on `claude/darts-analytics-arch-review-nvyboi`:

- the context-router `CLAUDE.md`, `00-Context-Map.md`, `DECISIONS.md`, and `scripts/check-context-map.sh`
- migrations `0013`–`0016` and the reference-seed transaction fix
- the entire v1 API freeze (`06-API/00`–`04` amendments, D60–D78)
- the frontend handbook (`07-Frontend/01`–`05`, `10`) and D79–D93
- the graphify integration (skill, graph, CLAUDE.md wiring)

`main` still carries the pre-router `AGENT.md`-style `CLAUDE.md`, a migration chain ending at `0012`, and ~90k lines of raw conversation logs (`conversations/`, `original-conversation/`, `architecture/summarized-context/`) that the branch deleted.

Consequences: any session started from `main` loads an obsolete context system; the "never merge to `main` directly" invariant has silently become "never merge to `main` at all"; PR merges #5–#7 landed into the side line instead of `main`, so even reviewed work never reached the default branch.

This is the primary red-light finding of the 2026-07-14 review — the context system, quality gates, and graphify integration being evaluated do not exist on the branch the project calls authoritative.

---

## Decision 1 — Land the branch on `main` via a single reconciliation PR

**Decision:** open one PR from the current development line to `main` (after the review-fix specs in this batch are addressed or explicitly deferred), review it against the PR-template checklist, and merge it. No cherry-picking, no history rewrite: the line is linear ahead of `main` (`git merge-base --is-ancestor main HEAD` holds), so a plain merge fast-forwards conceptually and preserves the audit trail.

Alternatives considered:

- *Cherry-pick thematic slices into several PRs* — cleaner review units, but the slices are heavily interdependent (context map ↔ specs ↔ migrations ↔ ledger) and the work was already reviewed piecewise in PRs #5–#7 on the side line. Rejected: high effort, no added safety.
- *Reset `main` to the branch tip directly* — fastest, but violates the project's own "never merge to main directly" invariant and skips the PR checklist. Rejected.

---

## Decision 2 — Branch-integration rule in the operating manual

**Decision:** add one rule to the root `CLAUDE.md` Hard Invariants: *a task branch is integrated into `main` via PR when its task completes; long-lived divergence from `main` is a defect.* The Context Maintenance completion gate gains a final item: "confirm the work is on `main` or an open PR targets `main`."

This closes the loophole where "every task uses a dedicated branch; never merge to main directly" was satisfied by branches that never merged at all.

---

## Decision 3 — Retire the ADR ambiguity

**Decision:** `architecture/DECISIONS.md` **is** the ADR mechanism. Edit the three places that imply a separate future system:

- `architecture/docs/architecture/README.md`: remove `09-ADR/ (planned)` from the hierarchy or annotate it as "superseded by `DECISIONS.md` (D52)".
- `03-Engineering-Workflow.md` / `099-…-decision-framework.md`: replace "requires an ADR" with "requires a `DECISIONS.md` entry (one line, dated, with rationale)".
- `04-Architecture-patterns.md` Pattern Adoption Process item 5: same replacement.

Rationale: two coexisting decision-record mechanisms (one real, one planned) make "does this require an ADR?" unanswerable — a vague rule the review flagged. D52 already chose the ledger; the docs just never caught up.

---

## Out of scope

- Deleting `conversations/` / `original-conversation/` from `main` history (they disappear when the branch merges; git history retention is acceptable).
- Any change to the PR template or CODEOWNERS.

---

## Success criteria

1. `main` contains the full current line; a fresh clone of `main` passes `scripts/check-context-map.sh`.
2. Root `CLAUDE.md` states the integration rule; completion gate updated.
3. No doc references a "planned" ADR directory; "ADR" resolves unambiguously to `DECISIONS.md`.
