/**
 * After merge (code → design): sort the tokens and assets that changed on
 * `main` since the lock into what to publish to the artifact and what the
 * owner decides. Components are design → code only and never appear.
 * Spec: docs/superpowers/specs/2026-11-04-design-system-artifact-sync-design.md
 */
import type { DiffReport } from "./cli";
import type { Classified } from "./lock";

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
    const areaMarked = marked.has(`area:${report.area}`);
    for (const item of report.items) {
      const key = bucket(
        item,
        locked.has(item.id),
        areaMarked || marked.has(item.id),
      );
      if (key) plan[key].push(item.id);
    }
  }
  return plan;
}

/** The list an item belongs in, or null when it needs nothing after a merge. */
function bucket(
  item: Classified,
  isLocked: boolean,
  isMarked: boolean,
): keyof PublishPlan | null {
  if (item.status !== "mismatch") return null;
  if (!isLocked) return item.code && !item.design ? "newOnMain" : null;
  if (item.proposal === "owner") return "conflicts";
  if (item.proposal !== "code-to-design") return null;
  return isMarked || !item.code ? "conflicts" : "publish";
}
