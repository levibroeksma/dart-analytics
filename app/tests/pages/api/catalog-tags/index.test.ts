import { describe, it, expect, vi } from "vitest";

vi.mock("@services/catalog.service", () => ({
  getCatalogTags: vi.fn(),
}));
import * as service from "@services/catalog.service";

const context = {
  locals: { auth: { playerId: "p1" }, requestId: "r" },
} as any;

describe("GET /api/catalog-tags", () => {
  it("returns the grouped tags in the standard envelope", async () => {
    const data = { games: {}, exercises: {} };
    vi.mocked(service.getCatalogTags).mockResolvedValue({ ok: true, data });
    const { GET } = await import("@pages/api/catalog-tags/index");
    const response = await GET(context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data });
  });

  it("maps a service failure to the failure envelope", async () => {
    vi.mocked(service.getCatalogTags).mockResolvedValue({
      ok: false,
      code: "INTERNAL_ERROR",
    });
    const { GET } = await import("@pages/api/catalog-tags/index");
    const response = await GET(context);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await response.json()).toMatchObject({ ok: false });
  });
});
