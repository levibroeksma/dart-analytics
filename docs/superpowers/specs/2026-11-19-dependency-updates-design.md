# Automated dependency updates — design

This design describes an automated dependency update workflow for Dart Analytics. Its reader is the person who writes the plan and builds the workflow. Size: a small change. It adds 1 config file, 1 workflow and 1 decision record.

## Intent

The owner wants dependencies patched without manual tracking. Updates arrive as PRs on a fixed weekly schedule. A release younger than 48 hours does not reach a PR. A breaking update carries an impact review before the owner looks at it.

## Goals

- Dependabot opens update PRs every week for the `app/` npm packages and for the GitHub Actions in `.github/workflows/`.
- A release younger than 48 hours waits (cooldown of 2 days).
- A CVE fix skips the cooldown and the weekly schedule.
- Patch and minor updates arrive grouped: 1 PR per ecosystem.
- Each major update arrives as its own PR.
- On a major update, Claude reads the changelog and the repo's use of the package, then posts the impact as a PR comment.
- Everything runs on free tiers.

## Non-goals

- Auto-merge. The owner merges every PR.
- Updating packages outside `app/` and `.github/workflows/`.

## Anti-goals

- A pay-per-use API cost for the Claude review.
- A Claude job that can push code, approve or merge a PR.
- Several CI runs per day caused by update PRs.

## Constraints

- The repo is public, so GitHub Actions minutes on standard runners are free.
- `main` requires verified commit signatures (D289). GitHub signs Dependabot commits.
- Workflows triggered by Dependabot can read only Dependabot secrets. The Claude credential must be stored as a Dependabot secret.
- Changelog text is untrusted third-party input. The review job gets `contents: read` and `pull-requests: write` only.
- The Claude credential is a token from the owner's existing Claude Pro or Max plan (`CLAUDE_CODE_OAUTH_TOKEN`), not an API key.
- Storing that token in the repo needs confirmation from the co-one Security Officer before setup (human validation required).

## Approaches

| Approach | Trade-off | Outcome |
| --- | --- | --- |
| A. Dependabot + a Claude review workflow | Native to GitHub, signed commits, no extra vendor. Rules are less fine-grained than Renovate's. | Picked by the owner. |
| B. Renovate app + the same Claude review workflow | Finer rules and a dashboard issue. Needs a third-party app with write access, and signature behaviour is unconfirmed. | Not picked. |
| C. A scheduled Claude job that finds and applies updates | Uses the Claude plan every week and rebuilds what the bots already do. | Dropped. |

## Design as decided

1. `.github/dependabot.yml` declares 2 ecosystems: `npm` in `/app` and `github-actions` in `/`.
2. Both run on a weekly schedule.
3. Both set `cooldown.default-days: 2`.
4. A group per ecosystem collects `minor` and `patch` updates. Major updates stay ungrouped.
5. Dependabot security updates stay enabled in the repo settings. They run outside the schedule and skip the cooldown.
6. A new workflow, `.github/workflows/dependency-review.yml`, runs on `pull_request` when the author is `dependabot[bot]`.
7. That workflow reads the update type with `dependabot/fetch-metadata`.
8. On a major update, or a minor bump of a package below 1.0, it runs `anthropics/claude-code-action` with the OAuth token.
9. Claude posts 1 comment: breaking changes from the changelog, the repo files that use the package, and a verdict (safe, needs changes, or unclear).
10. Claude's tools are limited to reading the repo and posting the comment.

## Calls made by Claude (owner may correct)

- Schedule: Monday 06:00, Europe/Amsterdam. Reason: 1 batch per week, reviewed at the start of the week.
- `open-pull-requests-limit: 5` per ecosystem. Reason: caps CI load if many majors land at once.
- A minor bump below 1.0 counts as breaking. Reason: on 0.x versions, a minor bump can change the API (for example `drizzle-orm 0.45`).
- If the token secret is missing, the review job fails visibly. Reason: a silent skip would look like a clean review.
- Third-party actions are pinned by commit SHA.

## Left to the builder

- How to detect a 0.x minor bump inside a grouped PR, where `fetch-metadata` reports several dependencies.
- The exact Claude prompt and its tool allow-list.
- The decision record (`decisions/<domain>/pending-<slug>.md`) and the context-map and File Inventory rows.
- Checking that existing PR workflows pass on a Dependabot PR without Actions secrets. `db-rehearsal` reads `NEON_API_KEY` but runs only when its gate says so.
- Verifying `cooldown` and security-update behaviour against GitHub's current docs.
