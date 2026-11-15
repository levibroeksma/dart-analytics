import { describe, expect, it } from "vitest";
import { sumBy, tallyRows } from "@lib/stats/x01/aim-tally";

describe("tallyRows", () => {
  const rows = {
    "A|x": { n: 1 },
    "A|y": { n: 2 },
    "B|x": { n: 4 },
    SOLO: { n: 8 },
  };

  it("groups rows by id in first-seen order and skips null ids", () => {
    const groups = tallyRows(
      rows,
      (parts) => (parts[1] === undefined ? null : parts[0]),
      (id) => ({ id, n: 0 }),
      (group, _parts, fields) => {
        group.n += fields.n;
      },
    );
    expect(groups).toEqual([
      { id: "A", n: 3 },
      { id: "B", n: 4 },
    ]);
  });

  it("sumBy adds the picked values", () => {
    expect(sumBy([{ n: 1 }, { n: 2 }], (item) => item.n)).toBe(3);
    expect(sumBy([], () => 1)).toBe(0);
  });
});
