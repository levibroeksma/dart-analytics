import type { APIRoute } from "astro";
import { env } from "@lib/env";

const STRIPPED_REQUEST_HEADERS = [
  "connection",
  "keep-alive",
  "host",
  "x-forwarded-host",
  "x-forwarded-proto",
  "forwarded",
];

/**
 * Copies the browser's headers for the upstream call. `host` is dropped rather
 * than rewritten — it is a forbidden header name that `fetch` sets from the
 * target URL regardless. Hop-by-hop forwarded headers (`x-forwarded-host`,
 * `x-forwarded-proto`, `forwarded`) are also stripped: Vite/Workers inject
 * the app's hostname there, and Neon Auth treats that as the auth host —
 * rejecting with `INVALID_HOSTNAME` when it is `localhost` or a Worker
 * origin. `origin` is deliberately forwarded unchanged: Better Auth
 * origin-checks it against its trustedOrigins list (Task 0), and rewriting
 * it here would defeat that CSRF protection.
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

const STRIPPED_RESPONSE_HEADERS = ["content-encoding", "content-length"];

/**
 * Rewrites `Set-Cookie` per `rebindCookie()` and drops `Content-Encoding` /
 * `Content-Length`. Both describe the upstream's original compressed byte
 * stream, but `fetch` already transparently decompresses the body before
 * this handler ever sees it — forwarding the stale headers alongside the
 * decoded body would tell the browser it received gzip bytes of a length
 * the real body doesn't match, breaking every `authClient` call.
 */
function buildResponseHeaders(upstreamHeaders: Headers): Headers {
  const built = new Headers(upstreamHeaders);
  for (const name of STRIPPED_RESPONSE_HEADERS) built.delete(name);
  const setCookies = upstreamHeaders.getSetCookie();
  if (setCookies.length === 0) return built;
  built.delete("set-cookie");
  for (const cookie of setCookies)
    built.append("set-cookie", rebindCookie(cookie));
  return built;
}

/**
 * True when `forwardPath` contains a `..` path segment, literal or
 * percent-encoded (`%2e`/`%2E` for the dot, `%2f`/`%2F` for a slash hiding
 * a segment boundary from the URL parser). Neon Auth is trusted (spec
 * decision B1), but its own stack may decode `%2f` before routing, so a
 * segment that only looks opaque here must still be rejected before it is
 * forwarded byte-for-byte.
 */
function hasTraversalSegment(forwardPath: string): boolean {
  const decoded = forwardPath.replace(/%2e/gi, ".").replace(/%2f/gi, "/");
  return decoded.split("/").some((segment) => segment === "..");
}

/**
 * Same-origin transport for Neon Auth (Better Auth) traffic (D172). Forwards
 * every `/api/auth/*` request verbatim to `NEON_AUTH_BASE_URL` and rewrites
 * `Set-Cookie` so the session cookie binds first-party to whatever host
 * served the request, instead of cross-site to Neon Auth's own domain —
 * the fix for iOS standalone web app login. Not a domain endpoint: the
 * upstream response passes through untouched, never wrapped in the
 * `ok/data/requestId` envelope. Trailing slash(es) on `NEON_AUTH_BASE_URL`
 * are stripped before joining with the forwarded path, so a misconfigured
 * base URL never produces a double slash in the upstream target.
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
  if (hasTraversalSegment(forwardPath)) {
    return new Response("Invalid path segment", { status: 400 });
  }
  const requestUrl = new URL(request.url);
  const normalizedBaseUrl = authBaseUrl.replace(/\/+$/, "");
  const target = new URL(
    `${normalizedBaseUrl}/${forwardPath}${requestUrl.search}`,
  );
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
    headers: buildResponseHeaders(upstreamResponse.headers),
  });
};
