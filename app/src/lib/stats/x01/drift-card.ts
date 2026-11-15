import { MIN_ROW_SAMPLE, MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { ambiguousDarts, poolRows } from "./aim-rows";
import type { AimRows, DriftCard, DriftRow } from "./types";

const DARTS: DriftRow["dart"][] = [1, 2, 3];

function words(mm: number, negative: string, positive: string): string | null {
  const rounded = Math.round(Math.abs(mm));
  if (rounded === 0) return null;
  return `${rounded} mm ${mm < 0 ? negative : positive}`;
}

/** "4 mm left, 2 mm low"; an axis that rounds to zero is omitted, both zero reads "on target". Board y grows downward, so positive dy is low. */
export function describeDrift(meanDx: number, meanDy: number): string {
  const parts = [words(meanDx, "left", "right"), words(meanDy, "high", "low")];
  const text = parts.filter((part) => part !== null).join(", ");
  return text === "" ? "on target" : text;
}

function driftRow(dart: DriftRow["dart"], f: Record<string, number>): DriftRow {
  const n = f.n ?? 0;
  if (n < MIN_ROW_SAMPLE)
    return { dart, n, meanDx: null, meanDy: null, spread: null };
  const meanDx = f.sumDx / n;
  const meanDy = f.sumDy / n;
  const varX = Math.max(0, f.sumDxDx / n - meanDx ** 2);
  const varY = Math.max(0, f.sumDyDy / n - meanDy ** 2);
  return { dart, n, meanDx, meanDy, spread: Math.sqrt(varX + varY) };
}

function parts(key: string): { basis: string; dart: string } {
  const [basis = "", , dart = ""] = key.split("|");
  return { basis, dart };
}

function basisRows(rows: AimRows): (DriftRow & { basis: string })[] {
  const bases = [...new Set(Object.keys(rows).map((k) => parts(k).basis))]
    .filter((basis) => basis !== "AMBIGUOUS" && basis !== "")
    .sort();
  return bases.flatMap((basis) =>
    DARTS.map((dart) => ({
      basis,
      ...driftRow(
        dart,
        poolRows(rows, (k) => {
          const p = parts(k);
          return p.basis === basis && p.dart === String(dart);
        }),
      ),
    })).filter((row) => row.n > 0),
  );
}

/** The aim drift card over summed `aim-drift` rows, pooled over aim and resolution. */
export function driftCard(rows: AimRows): DriftCard {
  const byDart = DARTS.map((dart) =>
    driftRow(
      dart,
      poolRows(rows, (k) => parts(k).dart === String(dart)),
    ),
  );
  const first = byDart[0];
  const headline =
    first.n < MIN_TARGET_SAMPLE ||
    first.meanDx === null ||
    first.meanDy === null
      ? null
      : describeDrift(first.meanDx, first.meanDy);
  return {
    headline,
    n: first.n,
    byDart,
    byBasis: basisRows(rows),
    ambiguous: ambiguousDarts(rows),
  };
}
