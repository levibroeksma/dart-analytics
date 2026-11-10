---
name: auditing-the-codebase
description: Use when asked to audit, review or assess this repository and turn the result into plans — code quality, duplication, complexity, hooks, gate scripts, CI. Pairs with superpowers:brainstorming and superpowers:writing-plans; the owner decides open questions before any plan is written.
---

# Auditing The Codebase

An audit is measure → findings → owner decisions → plans. The plans come last, because one owner answer can change every plan.

## Steps

1. **Load the pack.** Context Map row "Tooling / quality audit". For fallow numbers read `.claude/skills/validate-app/references/fallow-scoring.md` first: it says what each number means and what can move it.
2. **Measure.** Run the tools; record each number with the command that printed it. Run every `scripts/check-*.sh` and `scripts/test-*.sh` once with exit code and wall time. Done when every claim you will make has a command behind it.
3. **Write the findings** to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`: baseline table, findings table (where, what, severity), and a section "Owner decisions" listing each choice the plans would otherwise assume, with your recommendation.
4. **Ask the owner.** One `AskUserQuestion` call holding every open decision (at most 4; fold the rest into the recommended default and say so). Each question stands alone and names the numbers. This replaces `superpowers:brainstorming`'s one-question-at-a-time dialogue for an audit; the spec is still its output.
5. **Record the answers** in the spec, then write the plans with `superpowers:writing-plans`: one plan per PR, each with a hard check (a command and its expected output).

Step 4 has no answer yet and the owner is away: write the plans on the recommended defaults, and put the open decisions first in the completion report and the PR body.

## What counts as an owner decision

- What a target number measures, when two metrics could carry the name.
- Excluding code from a score or a gate (`health.ignore`, an allow-list, a baseline row).
- Deleting a script, check or doc that something still mentions.
- A refactor shape that will be repeated across more than ten files.

Everything else — order of work, helper names, where a test lives — you decide.
