---
name: capturing-discovered-work
description: Use whenever you notice actionable work the current task didn't ask for — a bug, missing test, stale doc, architecture violation, technical debt, UI/UX gap, infra gap — while doing something else. Captures it as a GitHub issue and returns to the task. This is the mandatory replacement for the retired FINDINGS.md mechanism (D273, supersedes D214).
---

# Capturing Discovered Work

Core rule: if the discovered problem is not required to correctly complete the
current task, capture it as a GitHub issue and return to the task. Never fix
it in the same pass. Never leave it as a chat aside or a memory item — both
die with the session.

## Scope test

Ask: "If I leave this unchanged, can I still correctly complete the task I
was asked to do?"

- Yes → discovered work. Capture it.
- No → part of the current task. Fix it.

Proximity, ease, or relatedness never move something into scope. "I'm
already in this file" and "it would be faster to fix" are not scope tests.

## Procedure

1. Stop pursuing the discovery.
2. Lightweight duplicate check: search open issues for the `discovered-work`
   label on distinctive terms (`search_issues`/`list_issues`). A match found
   fast → add a comment only if it materially adds context, then move on.
   Don't spend real time hunting for a vaguely-related issue.
3. Classify one Type and one Severity (below).
4. Create the issue with the GitHub MCP tools (`issue_write`, method
   `create`) using the format below. Where MCP tools aren't available,
   `gh issue create` with equivalent title/body/labels.
5. Record the issue number/URL.
6. Return to the current task. Do not implement the fix.

Creating the issue is the deliverable. It ends the interruption — it is not
a description of a fix still to come.

## Type (pick exactly one)

`bug` · `architecture` · `backend` · `frontend` · `ui` · `ux` · `testing` ·
`documentation` · `infrastructure` · `security` · `performance` ·
`developer-experience` · `technical-debt`

## Severity (pick exactly one)

`critical` — major failure, security issue, data loss, or core functionality
blocked · `high` — significant functional/architectural problem · `medium` —
real problem, not currently blocking · `low` — minor defect, cleanup,
polish · `trivial` — very small improvement

Severity describes the problem itself, never how urgently it happened to
surface. Finding a `trivial` doc typo mid-crisis is still `trivial`.

## Issue format

Title: `[Discovered] <one-line problem statement>`
Labels: `discovered-work`, `type:<type>`, `severity:<severity>`

Body:

```markdown
## Summary
<one-line statement of what was found>

## Type
<type>

## Severity
<severity>

## Discovery Context
**Found during task:** `<branch or task name>`
**Found:** YYYY-MM-DD

## Problem
**Claim:** <what the repo/code/doc asserts or assumes>
**Evidence:** <file:line-cited proof the claim doesn't hold>

## Why It Matters
<concrete consequence — who/what this actually costs>

## Proposed Fix

> Initial hypothesis from time of discovery, not a validated design.

<the smallest fix that would resolve it — a proposal, not a plan>

## Notes
<optional — anything else useful to whoever picks this up>
```

`Proposed Fix` is explicitly a hypothesis: the discovering agent has partial
context, and a future task may choose a different fix once it looks closer.
Never let a five-day-old guess read as a settled design.

## Rationalizations to reject

| You're thinking | Reality |
| ---------------- | ------- |
| "It's only one line." | Size doesn't decide scope; necessity does. |
| "I'm already in this file." | Proximity isn't scope. |
| "Fixing it now is faster than filing it." | Optimize the task's completion, not the interruption's. |
| "I'll remember it." | Memory isn't tracking. File it now. |
| "It's obviously related." | Related isn't required. |
| "I'll just clean this up while I'm here." | Cleanup is discovered work unless the task named it. |
| "Filing would take longer than the fix." | File it anyway — the task's scope doesn't bend to that trade. |

Mid-task red flags — any of these means stop and file, not fix: "while I'm
here…", "I'll just fix…", "it's only…", "I might as well…", "this is
obviously wrong so I'll correct it".

## If issue creation fails

Don't discard the discovery, and don't fall back to fixing it instead.
Report the failure plus the full intended issue content (title, body,
labels) in the completion report, so the user or a later session can file
it by hand. Return to the current task unless the discovery blocks it.

## Relation to the completion report

Every issue filed during a task is named in that task's completion report
(number + one-line summary). This is the load-bearing half of the retired
FINDINGS.md invariant: the record moved from a repo file to GitHub, but
"never fixed silently, always surfaced" did not change.
