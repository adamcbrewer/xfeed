import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdirSync, chmodSync } from "node:fs";

const STORAGE_STATE_PATH = resolve("auth/storage-state.json");

async function main(): Promise<void> {
  mkdirSync(resolve("auth"), { recursive: true });

  console.log("Launching browser for X login...");
  console.log("Log in to your X account, then press Enter in this terminal.\n");

  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  await page.goto("https://x.com/login");

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
    console.log("Waiting for you to log in... Press Enter when done.");
  });

  await context.storageState({ path: STORAGE_STATE_PATH });
  chmodSync(STORAGE_STATE_PATH, 0o600);
  console.log(`Session saved to ${STORAGE_STATE_PATH}`);

  await browser.close();
  process.exit(0);
}

main();
