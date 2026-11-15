import { tallyRows } from "./aim-tally";
import type { AimRows, SetupGroup } from "./types";

/** Attempts and hits per basis and aim kind from `setup-success` rows. */
export function tallySetup(rows: AimRows): SetupGroup[] {
  return tallyRows(
    rows,
    ([basis, kind]) => (kind === undefined ? null : `${basis}|${kind}`),
    (id) => {
      const [basis, kind] = id.split("|");
      return { basis, kind, attempts: 0, hits: 0, rate: null };
    },
    (group, _parts, fields) => {
      group.attempts += fields.attempts ?? 0;
      group.hits += fields.hits ?? 0;
    },
  );
}
