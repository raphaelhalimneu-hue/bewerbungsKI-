#!/usr/bin/env node
/**
 * Smoke test: verifies the *built* app actually renders (no white page).
 *
 * Background: on 2026-08-14 a deploy shipped a page that built fine but
 * crashed at runtime (missing React import) → completely white start page.
 * A successful Vite build is NOT enough; this script renders the built
 * bundle in headless Chromium and fails if:
 *   - #root stays empty (white page)
 *   - the expected page content never appears
 *   - any uncaught page error or console error occurs
 *
 * Covered surfaces:
 *   / (Home/Start)  →  visible hero content + brand name
 *   /wizard         →  Erstellen page renders real content
 *   /pricing        →  Preise section of Home renders real content
 *   Login modal     →  clicking sign-in opens dialog with email+password fields
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
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TIMEOUT_MS = 30_000;
const NAV_TIMEOUT = 20_000;

/**
 * Routes to smoke-test.
 * Each entry:
 *   path      – URL path (appended to BASE_URL)
 *   label     – human-readable name for error messages
 *   mustMatch – regex that must match the visible page text
 *   minText   – minimum visible-text length (default 50)
 */
const ROUTES = [
  {
    path: "/",
    label: "Start page",
    mustMatch: /BewerbungsKI/i,
  },
  {
    path: "/wizard",
    label: "Erstellen page (/wizard)",
    mustMatch: /BewerbungsKI/i,
  },
  {
    path: "/pricing",
    label: "Preise page (/pricing)",
    // /pricing renders the same Home component scrolled to the pricing
    // section, so the brand name is always present.
    mustMatch: /BewerbungsKI/i,
  },
];

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

/**
 * Seeds localStorage before each navigation so the i18n language detector
 * picks German (de) instead of the browser navigator language. Without this,
 * headless Chromium reports "en" → the app calls window.location.replace()
 * to redirect to /en/ → React renders null → #root stays empty.
 *
 * NOTE: evaluateOnNewDocument fires for every new document including
 * sandboxed iframes. Those iframes may deny localStorage access. The
 * try-catch prevents the SecurityError from propagating as a pageerror
 * that would fail the test.
 */
async function seedGermanLocale(page) {
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem("i18nextLng", "de");
    } catch {
      // Sandboxed sub-frame without storage access — safe to ignore.
    }
  });
}

async function checkRoute(page, route, baseUrl) {
  const url = `${baseUrl}${route.path}`;
  const label = route.label;
  const minText = route.minText ?? 50;
  const routeProblems = [];

  const pageErrors = [];
  const consoleErrors = [];
  const onPageError = (err) => pageErrors.push(`Uncaught page error: ${err.message}`);
  const onConsole = (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore network noise from optional third-party calls (e.g. blocked analytics)
      if (/net::ERR_|Failed to load resource/i.test(text)) return;
      consoleErrors.push(`Console error: ${text}`);
    }
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: NAV_TIMEOUT });

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
      routeProblems.push(`[${label}] #root element not found in the page`);
    } else if (rootInfo.childCount === 0 || rootInfo.textLength < minText) {
      routeProblems.push(
        `[${label}] #root looks empty (children: ${rootInfo.childCount}, visible text length: ${rootInfo.textLength}) — white page`,
      );
    }

    // 2. Meaningful content must be visible
    const bodyText = await page.evaluate(() => document.body.innerText || "");
    if (!route.mustMatch.test(bodyText)) {
      routeProblems.push(
        `[${label}] Expected content matching ${route.mustMatch} not found`,
      );
    }

    // 3. No uncaught errors
    for (const e of pageErrors) routeProblems.push(`[${label}] ${e}`);
    for (const e of consoleErrors) routeProblems.push(`[${label}] ${e}`);
  } finally {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
  }

  return routeProblems;
}

/**
 * Verifies the login modal: navigates to the start page, clicks the
 * sign-in button, and asserts the auth dialog opens with email + password
 * inputs visible. There is no /login route — login is an AuthModal.
 */
async function checkLoginModal(page, baseUrl) {
  const label = "Login modal";
  const problems = [];

  const pageErrors = [];
  const consoleErrors = [];
  const onPageError = (err) => pageErrors.push(`Uncaught page error: ${err.message}`);
  const onConsole = (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (/net::ERR_|Failed to load resource/i.test(text)) return;
      consoleErrors.push(`Console error: ${text}`);
    }
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  try {
    // Navigate to root (German locale already seeded via evaluateOnNewDocument)
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: NAV_TIMEOUT });

    // The sign-in button lives in the header; in German locale its title is "Anmelden".
    // Selector: button[title="Anmelden"] — layout-independent and locale-stable
    // (since we force de above).
    let signInBtn;
    try {
      signInBtn = await page.waitForSelector('button[title="Anmelden"]', { timeout: 8000 });
    } catch {
      problems.push(`[${label}] Sign-in button (button[title="Anmelden"]) not found in header`);
    }

    if (signInBtn) {
      await signInBtn.click();

      // Wait for the Radix Dialog to mount
      let dialog;
      try {
        dialog = await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      } catch {
        problems.push(`[${label}] Auth dialog ([role="dialog"]) did not open after clicking sign-in`);
      }

      if (dialog) {
        // Email and password inputs must be present inside the dialog
        const formOk = await page.evaluate(() => {
          const dlg = document.querySelector('[role="dialog"]');
          if (!dlg) return false;
          return !!(
            dlg.querySelector('input[type="email"]') &&
            dlg.querySelector('input[type="password"]')
          );
        });
        if (!formOk) {
          problems.push(
            `[${label}] Email or password input not found inside the auth dialog`,
          );
        } else {
          // Also verify no console/page errors occurred while opening the modal
          for (const e of pageErrors) problems.push(`[${label}] ${e}`);
          for (const e of consoleErrors) problems.push(`[${label}] ${e}`);
        }
      }
    }
  } finally {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
  }

  return problems;
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
      const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) { up = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!up) throw new Error(`Preview server did not come up on ${BASE_URL}`);

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

  const allProblems = [];
  try {
    const page = await browser.newPage();

    // Seed German locale before the very first navigation so i18n never
    // triggers a window.location.replace() redirect that leaves #root empty.
    // evaluateOnNewDocument runs on every navigation (including page.goto calls).
    await seedGermanLocale(page);

    for (const route of ROUTES) {
      console.log(`  → Checking ${route.label} …`);
      const problems = await checkRoute(page, route, BASE_URL);
      allProblems.push(...problems);
    }

    // Login modal: not a route, but a critical UI surface
    console.log("  → Checking Login modal …");
    const loginProblems = await checkLoginModal(page, BASE_URL);
    allProblems.push(...loginProblems);
  } finally {
    await browser.close();
    killPreview();
  }

  if (allProblems.length > 0) {
    for (const p of allProblems) fail(p);
    process.exit(1);
  }

  const checked = ROUTES.length + 1; // routes + login modal
  console.log(
    `✔ Smoke test passed: ${checked} surfaces checked — all render real content with no runtime errors.`,
  );
}

main().catch((err) => {
  fail(err.message);
  process.exit(1);
});
