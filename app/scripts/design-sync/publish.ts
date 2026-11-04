/**
 * After merge (code → design): sort the tokens and assets that changed on
 * `main` since the lock into what to publish to the artifact and what the
 * owner decides. Components are design → code only and never appear.
 * Spec: docs/superpowers/specs/2026-11-04-design-system-artifact-sync-design.md
 */
import type { DiffReport } from "./cli";

export interface PublishPlan {
  publish: string[];
  conflicts: string[];
  newOnMain: string[];
}

const PUBLISHED_AREAS = new Set(["tokens", "assets"]);

/**
 * Build the after-merge work list.
 *
 * @param reports - Diff reports, compared against `main`'s code.
 * @param marks - The artifact's ready marks.
 * @param reports - Accepted divergences already left out by the caller.
 * @param lockedIds - Ids the lock has an entry for.
 * @returns Ids to publish, conflicts for the owner, and new items on main.
 */
export function publishPlan(
  reports: DiffReport[],
  marks: { id: string }[],
  lockedIds: Iterable<string>,
): PublishPlan {
  const plan: PublishPlan = { publish: [], conflicts: [], newOnMain: [] };
  const marked = new Set(marks.map((m) => m.id));
  const locked = new Set(lockedIds);
  for (const report of reports) {
    if (!PUBLISHED_AREAS.has(report.area)) continue;
    for (const item of report.items) {
      if (item.status !== "mismatch") continue;
      if (!locked.has(item.id)) {
        if (item.code && !item.design) plan.newOnMain.push(item.id);
        continue;
      }
      if (item.proposal === "owner") {
        plan.conflicts.push(item.id);
      } else if (item.proposal === "code-to-design") {
        const deleted = !item.code;
        const isMarked =
          marked.has(item.id) || marked.has(`area:${report.area}`);
        plan[isMarked || deleted ? "conflicts" : "publish"].push(item.id);
      }
    }
  }
  return plan;
}
