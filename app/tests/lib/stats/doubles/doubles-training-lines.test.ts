import { describe, expect, it } from "vitest";
import {
  doublesTrainingCaption,
  doublesTrainingHeadline,
  doublesTrainingTable,
} from "@lib/stats/doubles/doubles-training-lines";
import type { DoublesTrainingCard, DoublesTrainingRow } from "@lib/types";

const row: DoublesTrainingRow = {
  aim: "DOUBLE:16",
  label: "D16",
  darts: 40,
  hits: 20,
  rate: 0.5,
  left: 6,
  right: 4,
  high: 5,
  low: 5,
  inside: 6,
  within: 10,
  outside: 4,
  nearMiss: 12,
  loose: 6,
};

describe("doubles training lines", () => {
  it("names the favourite in the caption and headline", () => {
    const card: DoublesTrainingCard = {
      favourite: row,
      darts: 40,
      rows: [row],
    };
    expect(doublesTrainingHeadline(card)).toBe("50.0%");
    expect(doublesTrainingCaption(card)).toBe("Favourite D16, 40 darts");
  });

  it("shows a dash and a waiting caption without a favourite", () => {
    const card: DoublesTrainingCard = { favourite: null, darts: 0, rows: [] };
    expect(doublesTrainingHeadline(card)).toBe("—");
    expect(doublesTrainingCaption(card)).toBe("Not enough darts yet");
  });

  it("formats one overlay line per row, with a dash under ten darts", () => {
    const small = {
      ...row,
      aim: "DOUBLE:2",
      label: "D2",
      darts: 4,
      rate: null,
    };
    const card: DoublesTrainingCard = {
      favourite: row,
      darts: 44,
      rows: [small, row],
    };
    expect(doublesTrainingTable(card)).toEqual([
      {
        label: "D2",
        count: 4,
        cells: ["—", "6/4", "5/5", "6/10/4", "12/6"],
      },
      {
        label: "D16",
        count: 40,
        cells: ["50.0%", "6/4", "5/5", "6/10/4", "12/6"],
      },
    ]);
  });
});
