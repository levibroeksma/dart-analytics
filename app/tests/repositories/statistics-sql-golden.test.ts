import { describe, it, expect } from "vitest";
import { renderingDb } from "./render-sql";
import {
  countGameSessions,
  findBucketedSessionAggregates,
  findDartFoldRows,
  findGameSessionsPage,
  findHeatmapCells,
  findHitNumberCells,
  findHomeHeatmapCells,
  findHomeScoring,
  findIntentCells,
  findIntentMoments,
  findRoutineRunBuckets,
  findStepBuckets,
  findStepFoldRows,
  findStepSessionPage,
  findVisitScoring,
  findX01CheckoutDarts,
  findX01FoldRows,
} from "@repositories/statistics.repository";

const PLAYER = "0190a000-0000-7000-8000-000000000001";
const FROM = "2026-01-01T00:00:00.000Z";
const TO = "2026-02-01T00:00:00.000Z";
const AFTER = {
  completedAt: "2026-01-15T12:00:00.000Z",
  sessionId: "0190a000-0000-7000-8000-000000000002",
};
const TZ = "Europe/Amsterdam";
const BANDS = [60, 100, 140] as const;

const scope = {
  playerId: PLAYER,
  gameTypeKey: "X01" as const,
  from: FROM,
  to: TO,
  statuses: ["COMPLETED"],
  context: "all" as const,
};
const routineScope = {
  playerId: PLAYER,
  routineKey: "warmup",
  from: FROM,
  to: TO,
  statuses: ["COMPLETED"],
};
const stepScope = { ...routineScope, stepKey: "step-1" };
const homeScope = {
  playerId: PLAYER,
  gameTypeKeys: ["X01" as const],
  from: FROM,
  to: TO,
};

const bucketings = [
  ["none", { bucket: "none" as const, tz: undefined }],
  ["week", { bucket: "week" as const, tz: TZ }],
] as const;

async function render(call: (db: never) => Promise<unknown>) {
  const { db, statements } = renderingDb([]);
  await call(db);
  return statements;
}

describe("statistics readers rendered SQL", () => {
  describe.each(bucketings)("bucket %s", (_name, b) => {
    it("findX01FoldRows", async () => {
      expect(
        await render((db) => findX01FoldRows(db, { ...scope, ...b })),
      ).toMatchSnapshot();
    });
    it("findDartFoldRows", async () => {
      expect(
        await render((db) => findDartFoldRows(db, { ...scope, ...b })),
      ).toMatchSnapshot();
    });
    it("findVisitScoring", async () => {
      expect(
        await render((db) =>
          findVisitScoring(db, { ...scope, ...b, bands: BANDS }),
        ),
      ).toMatchSnapshot();
    });
    it("findHitNumberCells", async () => {
      expect(
        await render((db) => findHitNumberCells(db, { ...scope, ...b })),
      ).toMatchSnapshot();
    });
    it("findIntentCells", async () => {
      expect(
        await render((db) => findIntentCells(db, { ...scope, ...b })),
      ).toMatchSnapshot();
    });
    it("findIntentMoments", async () => {
      expect(
        await render((db) => findIntentMoments(db, { ...scope, ...b })),
      ).toMatchSnapshot();
    });
    it("findBucketedSessionAggregates", async () => {
      expect(
        await render((db) =>
          findBucketedSessionAggregates(db, { ...scope, ...b }),
        ),
      ).toMatchSnapshot();
    });
    it("findRoutineRunBuckets", async () => {
      expect(
        await render((db) =>
          findRoutineRunBuckets(db, { ...routineScope, ...b }),
        ),
      ).toMatchSnapshot();
    });
    it("findStepBuckets", async () => {
      expect(
        await render((db) => findStepBuckets(db, { ...stepScope, ...b })),
      ).toMatchSnapshot();
    });
    it("findStepFoldRows", async () => {
      expect(
        await render((db) => findStepFoldRows(db, { ...stepScope, ...b })),
      ).toMatchSnapshot();
    });
  });

  it("findHomeScoring", async () => {
    expect(
      await render((db) =>
        findHomeScoring(db, { ...homeScope, tz: TZ, bands: BANDS }),
      ),
    ).toMatchSnapshot();
  });

  it.each([
    ["null target", null],
    ["set target", { number: 20, zone: "TREBLE" }],
  ])("findHeatmapCells with %s", async (_name, target) => {
    expect(
      await render((db) =>
        findHeatmapCells(db, { ...scope, cellMm: 10, target }),
      ),
    ).toMatchSnapshot();
  });

  it("findHomeHeatmapCells", async () => {
    expect(
      await render((db) =>
        findHomeHeatmapCells(db, { ...homeScope, cellMm: 10 }),
      ),
    ).toMatchSnapshot();
  });

  it.each([
    ["without after", undefined],
    ["with after", AFTER],
  ])("findGameSessionsPage %s", async (_name, after) => {
    expect(
      await render((db) =>
        findGameSessionsPage(db, { ...scope, limit: 25, after }),
      ),
    ).toMatchSnapshot();
  });

  it("countGameSessions", async () => {
    expect(
      await render((db) => countGameSessions(db, scope)),
    ).toMatchSnapshot();
  });

  it.each([
    ["without after", undefined],
    ["with after", AFTER],
  ])("findStepSessionPage %s", async (_name, after) => {
    expect(
      await render((db) =>
        findStepSessionPage(db, { ...stepScope, limit: 25, after }),
      ),
    ).toMatchSnapshot();
  });

  it("findX01CheckoutDarts", async () => {
    expect(
      await render((db) => findX01CheckoutDarts(db, PLAYER)),
    ).toMatchSnapshot();
  });

  describe.each(["standalone", "routine"] as const)("context %s", (context) => {
    const ctx = { ...scope, context };
    const none = { bucket: "none" as const, tz: undefined };
    it("findX01FoldRows", async () => {
      expect(
        await render((db) => findX01FoldRows(db, { ...ctx, ...none })),
      ).toMatchSnapshot();
    });
    it("findBucketedSessionAggregates", async () => {
      expect(
        await render((db) =>
          findBucketedSessionAggregates(db, { ...ctx, ...none }),
        ),
      ).toMatchSnapshot();
    });
    it("findGameSessionsPage", async () => {
      expect(
        await render((db) => findGameSessionsPage(db, { ...ctx, limit: 25 })),
      ).toMatchSnapshot();
    });
    it("countGameSessions", async () => {
      expect(
        await render((db) => countGameSessions(db, ctx)),
      ).toMatchSnapshot();
    });
  });

  it("findGameSessionsPage with several statuses", async () => {
    expect(
      await render((db) =>
        findGameSessionsPage(db, {
          ...scope,
          statuses: ["COMPLETED", "ABANDONED"],
          limit: 25,
        }),
      ),
    ).toMatchSnapshot();
  });

  describe("routineStep scope", () => {
    const routineStep = { routineKey: "warmup", stepKey: "step-1" };
    const none = { bucket: "none" as const, tz: undefined };
    it("findX01FoldRows", async () => {
      expect(
        await render((db) =>
          findX01FoldRows(db, { ...scope, ...none, routineStep }),
        ),
      ).toMatchSnapshot();
    });
    it("findBucketedSessionAggregates", async () => {
      expect(
        await render((db) =>
          findBucketedSessionAggregates(db, { ...scope, ...none, routineStep }),
        ),
      ).toMatchSnapshot();
    });
  });
});
