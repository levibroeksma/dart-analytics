#!/usr/bin/env node
/**
 * Screenshot one route of the dev server for a visual check.
 *
 *   node scripts/screenshot-page.mjs /games/bobs27/setup [out.png] [--click "text"]...
 *     [--fixture "<url substring>=<file.json>"]...
 *
 * Starts `astro dev` when nothing answers on the port, stubs `/api/auth/get-session`
 * with a signed-in session and every other `/api/**` call with `{ data: [] }`
 * (no database or login needed), and shoots
 * a 390px phone viewport at 2x. Each `--click` presses the element with that
 * text before the shot (a fold, a toggle option). Without fixtures API data is
 * empty, so a setup page may show its "Could not load setup" alert and a
 * statistics section its error state (the stub lacks the client's `ok`
 * envelope). Each `--fixture` answers every `/api/**` request whose URL
 * contains the substring with a success envelope around that file's JSON
 * (the route's `data` payload); the first matching fixture wins, e.g.
 * `--fixture "sections/elimination=elimination.json"`. With any fixture given,
 * each unmatched API URL is printed to stderr.
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const PORT = Number(process.env.SCREENSHOT_PORT ?? 4399);
const BASE = `http://localhost:${PORT}`;
const argv = process.argv.slice(2);
const clicks = [];
const fixtures = [];
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--click") clicks.push(argv[++i]);
  else if (argv[i] === "--fixture") {
    const spec = argv[++i] ?? "";
    const at = spec.lastIndexOf("=");
    if (at <= 0) {
      console.error(`--fixture wants "<url substring>=<file>", got "${spec}"`);
      process.exit(2);
    }
    fixtures.push({
      match: spec.slice(0, at),
      body: JSON.stringify({
        ok: true,
        requestId: "fixture",
        data: JSON.parse(readFileSync(spec.slice(at + 1), "utf8")),
      }),
    });
  } else positional.push(argv[i]);
}
const [route, out = "screenshot.png"] = positional;
if (!route) {
  console.error(
    "usage: screenshot-page.mjs <route> [out.png] [--click text]... [--fixture substring=file]...",
  );
  process.exit(2);
}

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ?? "playwright",
);

async function up() {
  try {
    return (await fetch(BASE)).status < 500;
  } catch {
    return false;
  }
}

let server = null;
if (!(await up())) {
  server = spawn("npx", ["astro", "dev", "--port", String(PORT)], {
    stdio: "ignore",
  });
  for (let i = 0; i < 60 && !(await up()); i++) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!(await up())) {
    server.kill();
    console.error("dev server did not start");
    process.exit(1);
  }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const session = {
    session: {
      id: "s",
      token: "t",
      userId: "u",
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
    user: { id: "u", name: "Test Player", email: "test@example.com" },
  };
  const bodyFor = (url) => {
    if (url.includes("/api/auth/get-session")) return JSON.stringify(session);
    const fixture = fixtures.find((f) => url.includes(f.match));
    if (fixture) return fixture.body;
    if (fixtures.length > 0) console.error(`no fixture: ${url}`);
    return JSON.stringify({ data: [] });
  };
  await page.route(/^https?:\/\/[^/]+\/api\//, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: bodyFor(r.request().url()),
    }),
  );
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  for (const text of clicks) {
    await page.getByText(text, { exact: true }).first().click();
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: out, fullPage: true });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
  server?.kill();
}
