#!/usr/bin/env node
/**
 * Smoke test: verifies the *built* app actually renders (no white page).
 *
 * Background: on 2026-08-14 a deploy shipped a page that built fine but
 * crashed at runtime (missing React import) → completely white start page.
 * A successful Vite build is NOT enough; this script renders the built
 * bundle in headless Chromium and fails if:
 *   - #root stays empty (white page)
 *   - the expected hero content never appears
 *   - any uncaught page error or console error occurs
 *
 * Usage: pnpm --filter @workspace/bewerbungski run smoke
 * (assumes `pnpm run build` already produced dist/public — the "smoke"
 *  package script chains build + this file)
 */
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const PORT = 4173 + Math.floor(Math.random() * 1000); // avoid collisions
const URL = `http://127.0.0.1:${PORT}/`;
const TIMEOUT_MS = 30_000;

function resolveChromium() {
  const envPath = process.env.CHROMIUM_PATH;
  if (envPath && existsSync(envPath)) return envPath;
  try {
    const p = execSync(
      "which chromium 2>/dev/null || which chromium-browser 2>/dev/null",
      { encoding: "utf-8", timeout: 3000 },
    ).trim();
    if (p && existsSync(p)) return p;
  } catch {}
  for (const p of [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ]) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "Chromium not found. Set CHROMIUM_PATH or install chromium.",
  );
}

function fail(msg) {
  console.error(`\n✖ SMOKE TEST FAILED: ${msg}\n`);
  process.exitCode = 1;
}

async function main() {
  const distIndex = path.join(appDir, "dist/public/index.html");
  if (!existsSync(distIndex)) {
    throw new Error(`Build output missing (${distIndex}). Run the build first.`);
  }

  // Serve the built app with vite preview
  const preview = spawn(
    "pnpm",
    ["exec", "vite", "preview", "--config", "vite.config.ts", "--host", "127.0.0.1"],
    {
      cwd: appDir,
      env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  preview.stderr.on("data", (d) => process.stderr.write(`[preview] ${d}`));

  const killPreview = () => {
    try { preview.kill("SIGTERM"); } catch {}
  };
  process.on("exit", killPreview);

  // Wait until the preview server responds
  const deadline = Date.now() + TIMEOUT_MS;
  let up = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(URL, { signal: AbortSignal.timeout(2000) });
      if (res.ok) { up = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!up) throw new Error(`Preview server did not come up on ${URL}`);

  const browser = await puppeteer.launch({
    executablePath: resolveChromium(),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const problems = [];
  try {
    const page = await browser.newPage();

    page.on("pageerror", (err) => {
      problems.push(`Uncaught page error: ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore network noise from optional third-party calls (e.g. blocked analytics)
        if (/net::ERR_|Failed to load resource/i.test(text)) return;
        problems.push(`Console error: ${text}`);
      }
    });

    await page.goto(URL, { waitUntil: "networkidle0", timeout: TIMEOUT_MS });

    // 1. #root must contain real rendered content (not a white page)
    const rootInfo = await page.evaluate(() => {
      const root = document.getElementById("root");
      return {
        exists: !!root,
        childCount: root ? root.children.length : 0,
        textLength: root ? (root.innerText || "").trim().length : 0,
      };
    });
    if (!rootInfo.exists) {
      problems.push("#root element not found in the page");
    } else if (rootInfo.childCount === 0 || rootInfo.textLength < 50) {
      problems.push(
        `#root looks empty (children: ${rootInfo.childCount}, visible text length: ${rootInfo.textLength}) — white page`,
      );
    }

    // 2. Meaningful hero content must be visible (brand appears in header/hero)
    const bodyText = await page.evaluate(() => document.body.innerText || "");
    if (!/BewerbungsKI/i.test(bodyText)) {
      problems.push('Expected visible text "BewerbungsKI" not found on the start page');
    }
  } finally {
    await browser.close();
    killPreview();
  }

  if (problems.length > 0) {
    for (const p of problems) fail(p);
    process.exit(1);
  }
  console.log("✔ Smoke test passed: start page renders real content with no runtime errors.");
}

main().catch((err) => {
  fail(err.message);
  process.exit(1);
});
