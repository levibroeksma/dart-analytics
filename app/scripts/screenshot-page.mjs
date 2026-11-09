#!/usr/bin/env node
/**
 * Screenshot one route of the dev server for a visual check.
 *
 *   node scripts/screenshot-page.mjs /games/bobs27/setup [out.png] [--click "text"]...
 *
 * Starts `astro dev` when nothing answers on the port, stubs `/api/auth/get-session`
 * with a signed-in session and every other `/api/**` call with `{ data: [] }`
 * (no database or login needed), and shoots
 * a 390px phone viewport at 2x. Each `--click` presses the element with that
 * text before the shot (a fold, a toggle option). Layout and markup only: API
 * data is empty, so a setup page may show its "Could not load setup" alert.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const PORT = Number(process.env.SCREENSHOT_PORT ?? 4399);
const BASE = `http://localhost:${PORT}`;
const argv = process.argv.slice(2);
const clicks = [];
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--click") clicks.push(argv[++i]);
  else positional.push(argv[i]);
}
const [route, out = "screenshot.png"] = positional;
if (!route) {
  console.error(
    "usage: screenshot-page.mjs <route> [out.png] [--click text]...",
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
  await page.route(/^https?:\/\/[^/]+\/api\//, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        r.request().url().includes("/api/auth/get-session")
          ? session
          : { data: [] },
      ),
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
