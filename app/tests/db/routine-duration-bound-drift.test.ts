import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MAX_ROUTINE_MINUTES,
  MIN_USER_ROUTINE_MINUTES,
} from "@modules/training/routines/routine-duration.module";

/**
 * The 30-60 minute bound is stated twice -- once in TypeScript as the shared
 * pre-validation both the builder and the service run, once in `0038`'s
 * trigger as the commit-time authority -- and the service only turns that
 * trigger's failure into `VALIDATION_FAILED` because it matches the trigger's
 * *name* out of the raised error (D334). Neither coupling is visible to the
 * compiler and no live database proves them here, so both are pinned against
 * the migration text, the way `schema-view-drift.test.ts` pins view bodies.
 */
const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../database/migrations/0038_custom_routines.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const service = readFileSync(
  fileURLToPath(
    new URL("../../src/services/routine.service.ts", import.meta.url),
  ),
  "utf8",
);

describe("0038's user-routine duration bound", () => {
  it("raises on the same minutes routine-duration.module.ts declares", () => {
    const bound = /IF v_total < (\d+) OR v_total > (\d+) THEN/.exec(migration);
    expect(bound, "0038 no longer bounds v_total as a numeric range").not.toBe(
      null,
    );
    expect(Number(bound![1])).toBe(MIN_USER_ROUTINE_MINUTES);
    expect(Number(bound![2])).toBe(MAX_ROUTINE_MINUTES);
  });

  it("raises with the trigger name routine.service.ts matches on", () => {
    const raised = /CONSTRAINT = '(\w+)'/.exec(migration);
    const matched = /const DURATION_BOUND_TRIGGER = "(\w+)";/.exec(service);
    expect(raised, "0038 no longer raises with a CONSTRAINT name").not.toBe(
      null,
    );
    expect(
      matched,
      "routine.service.ts no longer declares DURATION_BOUND_TRIGGER",
    ).not.toBe(null);
    expect(raised![1]).toBe(matched![1]);
  });
});
