import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

const STORAGE_STATE_PATH = resolve("auth/storage-state.json");

async function main(): Promise<void> {
  mkdirSync(resolve("auth"), { recursive: true });

  console.log("Launching browser for X login...");
  console.log("Log in to your X account, then press Enter in this terminal.\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://x.com/login");

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
    console.log("Waiting for you to log in... Press Enter when done.");
  });

  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`Session saved to ${STORAGE_STATE_PATH}`);

  await browser.close();
}

main();
