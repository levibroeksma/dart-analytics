/**
 * The owner's ready mark (design → code): read `project/sync-ready.json`
 * from the mirror and sort the marked items into a work list. A mark applies
 * only to items present on both sides whose design side alone changed.
 * Spec: docs/superpowers/specs/2026-11-04-design-system-artifact-sync-design.md
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DiffReport } from "./cli";
import type { Classified } from "./lock";

export const READY_FILE = "sync-ready.json";

export interface Mark {
  id: string;
  note?: string;
}

export interface ReadyPlan {
  apply: string[];
  conflicts: string[];
  oneSided: string[];
  inSync: string[];
  unknown: string[];
}

/**
 * Read the ready marks from the mirror.
 *
 * @param mirror - The mirror's `project/` folder.
 * @returns The marks; a missing or malformed file means no marks.
 */
export function readMarks(mirror: string): Mark[] {
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(join(mirror, READY_FILE), "utf8"));
  } catch {
    return [];
  }
  const items = (doc as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw): Mark[] => {
    const m = raw as { id?: unknown; note?: unknown };
    if (typeof m.id !== "string") return [];
    return [
      typeof m.note === "string" ? { id: m.id, note: m.note } : { id: m.id },
    ];
  });
}

function bucket(item: Classified): keyof ReadyPlan {
  if (item.status === "in-sync" || item.status === "accepted") return "inSync";
  if (!item.design || !item.code) return "oneSided";
  if (item.status === "mismatch" && item.proposal === "design-to-code") {
    return "apply";
  }
  return "conflicts";
}

/**
 * Sort marked items into what to apply and what the owner decides.
 *
 * @param marks - Ready marks; `area:<area>` stands for every item of that area.
 * @param reports - One diff report per area.
 * @returns Ids per bucket, each id once, in mark order.
 */
export function readyPlan(
  marks: { id: string }[],
  reports: DiffReport[],
): ReadyPlan {
  const plan: ReadyPlan = {
    apply: [],
    conflicts: [],
    oneSided: [],
    inSync: [],
    unknown: [],
  };
  const byId = new Map(reports.flatMap((r) => r.items.map((i) => [i.id, i])));
  const seen = new Set<string>();
  const add = (key: keyof ReadyPlan, id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    plan[key].push(id);
  };
  for (const { id } of marks) {
    if (id.startsWith("area:")) {
      const report = reports.find((r) => `area:${r.area}` === id);
      if (!report) add("unknown", id);
      for (const item of report?.items ?? []) add(bucket(item), item.id);
      continue;
    }
    const item = byId.get(id);
    add(item ? bucket(item) : "unknown", id);
  }
  return plan;
}
