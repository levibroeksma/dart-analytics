import { describe, it, expect, vi } from "vitest";
import { renderingDb } from "./render-sql";

const rendered = renderingDb([["cm1"], ["im1"]]);

vi.mock("@db/client", () => ({
  getDb: () => rendered.db,
  withTransaction: (fn: (tx: unknown) => unknown) => fn(rendered.db),
}));

/**
 * `upsertSettings` opens its own transaction, so it cannot be handed a mocked
 * builder from the outside — `@db/client` is mocked to hand it the rendering
 * client instead. Without this the statements it emits are never seen at all
 * (issue #397).
 */
describe("upsertSettings rendered SQL", () => {
  it("resolves both lookup ids, then upserts on the player id", async () => {
    const { upsertSettings } =
      await import("@repositories/settings.repository");
    await upsertSettings("p1", {
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    } as never);

    expect(rendered.statements.map((statement) => statement.sql)).toEqual([
      'select "id" from "capture_modes" where "capture_modes"."implementation_key" = $1 limit $2',
      'select "id" from "input_modes" where "input_modes"."implementation_key" = $1 limit $2',
      'insert into "player_settings" ("player_id", "default_capture_mode_id", "default_input_mode_id", "created_at", "updated_at") values ($1, $2, $3, $4, $5) on conflict ("player_id") do update set "default_capture_mode_id" = $6, "default_input_mode_id" = $7, "updated_at" = $8',
    ]);
  });
});
