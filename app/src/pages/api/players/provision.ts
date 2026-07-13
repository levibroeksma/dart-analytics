import type { APIRoute } from "astro";
import { provisionPlayer } from "../../../services/player.service";

const JSON_HEADERS = { "Content-Type": "application/json" };

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.auth?.authUserId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          retryable: false,
          details: {},
        },
        requestId: locals.requestId,
      }),
      { status: 401, headers: JSON_HEADERS },
    );
  }

  const provisioned = await provisionPlayer(locals.auth.authUserId);

  return new Response(
    JSON.stringify({
      ok: true,
      data: provisioned, // { playerId, authUserId, created } — matches ProvisionPlayerResponse
      requestId: locals.requestId,
    }),
    { status: 200, headers: JSON_HEADERS },
  );
};
