import { aimLabel } from "./aim-label";
import type { AimKey, HeatmapTargetOption } from "@lib/types";
import type { AimRows } from "./types";

const KIND_ORDER = [
  "TREBLE",
  "SINGLE",
  "DOUBLE",
  "INNER_BULL",
  "OUTER_BULL",
  "WIRE",
];

function rank(aim: string): [number, number] {
  const [kind, value = ""] = aim.split(":");
  const index = KIND_ORDER.indexOf(kind);
  return [
    index === -1 ? KIND_ORDER.length : index,
    Number(value.split("-")[0]),
  ];
}

function byRank(a: string, b: string): number {
  const [kindA, numberA] = rank(a);
  const [kindB, numberB] = rank(b);
  return kindA - kindB || numberA - numberB;
}

/** The heatmap picker's options over summed `aim-drift` rows: "All aims", then each distinct aim by kind and number. */
export function aimOptionsFromDrift(rows: AimRows): HeatmapTargetOption[] {
  const aims = new Set(Object.keys(rows).map((key) => key.split("|")[1]));
  aims.delete(undefined as unknown as string);
  return [
    { value: null, label: "All aims" },
    ...[...aims].sort(byRank).map((aim) => ({
      value: aim as AimKey,
      label: aimLabel(aim),
    })),
  ];
}
