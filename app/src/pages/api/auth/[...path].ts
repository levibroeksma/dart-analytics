import type { APIRoute } from "astro";
import { env } from "@lib/env";

const STRIPPED_REQUEST_HEADERS = ["connection", "keep-alive", "host"];

/**
 * Copies the browser's headers for the upstream call. `host` is dropped rather
 * than rewritten — it is a forbidden header name that `fetch` sets from the
 * target URL regardless. `origin` is deliberately forwarded unchanged: Better
 * Auth origin-checks it against its trustedOrigins list (Task 0), and
 * rewriting it here would defeat that CSRF protection.
 */
function buildForwardHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  for (const name of STRIPPED_REQUEST_HEADERS) headers.delete(name);
  return headers;
}

/**
 * Rebinds one upstream cookie to the app's own host: drops `Domain` so it
 * binds to whatever host served the request, and forces `SameSite=Lax`,
 * appending the attribute when upstream omitted it entirely.
 */
function rebindCookie(cookie: string): string {
  const withoutDomain = cookie.replace(/;\s*Domain=[^;]+/i, "");
  return /SameSite=/i.test(withoutDomain)
    ? withoutDomain.replace(/SameSite=[^;]+/i, "SameSite=Lax")
    : `${withoutDomain}; SameSite=Lax`;
}

function rewriteSetCookieHeaders(upstreamHeaders: Headers): Headers {
  const rewritten = new Headers(upstreamHeaders);
  const setCookies = upstreamHeaders.getSetCookie();
  if (setCookies.length === 0) return rewritten;
  rewritten.delete("set-cookie");
  for (const cookie of setCookies)
    rewritten.append("set-cookie", rebindCookie(cookie));
  return rewritten;
}

/**
 * Same-origin transport for Neon Auth (Better Auth) traffic (D172). Forwards
 * every `/api/auth/*` request verbatim to `NEON_AUTH_BASE_URL` and rewrites
 * `Set-Cookie` so the session cookie binds first-party to whatever host
 * served the request, instead of cross-site to Neon Auth's own domain —
 * the fix for iOS standalone web app login. Not a domain endpoint: the
 * upstream response passes through untouched, never wrapped in the
 * `ok/data/requestId` envelope.
 */
export const ALL: APIRoute = async ({ request, params }) => {
  let authBaseUrl: string;
  try {
    authBaseUrl = env.auth.baseUrl;
  } catch {
    return new Response("NEON_AUTH_BASE_URL is not configured", {
      status: 500,
    });
  }

  const forwardPath = params.path ?? "";
  const requestUrl = new URL(request.url);
  const target = new URL(`${authBaseUrl}/${forwardPath}${requestUrl.search}`);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(target, {
      method: request.method,
      headers: buildForwardHeaders(request),
      body: hasBody ? await request.blob() : undefined,
      redirect: "manual",
    });
  } catch {
    return new Response("Neon Auth unreachable", { status: 502 });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: rewriteSetCookieHeaders(upstreamResponse.headers),
  });
};
