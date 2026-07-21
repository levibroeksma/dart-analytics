import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/session.service", () => ({
  listConfigurationPresets: vi.fn(),
}));

import { listConfigurationPresets } from "@services/session.service";
import { GET } from "@routes/configuration-templates/index";

function makeContext(gameType: string | null) {
  const url = new URL("http://localhost/api/configuration-templates");
  if (gameType) url.searchParams.set("gameType", gameType);
  return {
    locals: {
      requestId: "req-1",
      auth: { authUserId: "auth-1", playerId: "player-1" },
    },
    url,
  } as never;
}

describe("GET /api/configuration-templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns presets for a known gameType", async () => {
    vi.mocked(listConfigurationPresets).mockResolvedValue([
      { configurationTemplateId: "c1" } as never,
    ]);
    const response = await GET(makeContext("SCORE_TRAINING"));
    expect(response.status).toBe(200);
  });

  it("returns 422 when gameType is missing", async () => {
    const response = await GET(makeContext(null));
    expect(response.status).toBe(422);
    expect(listConfigurationPresets).not.toHaveBeenCalled();
  });
});
