import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  apiRequest: vi.fn(),
}));
import { apiRequest } from "@client/api/client";
import { fetchCatalogTags } from "@client/api/catalog";

beforeEach(() => vi.clearAllMocks());

describe("client catalog api", () => {
  it("fetchCatalogTags GETs /api/catalog-tags and unwraps data", async () => {
    const data = { games: {}, exercises: {} };
    vi.mocked(apiRequest).mockResolvedValue({ ok: true, data, requestId: "r" });
    expect(await fetchCatalogTags()).toEqual(data);
    expect(apiRequest).toHaveBeenCalledWith("/api/catalog-tags", {
      method: "GET",
    });
  });
});
