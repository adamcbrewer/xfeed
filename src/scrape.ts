import { chromium, type Page, type Response } from "playwright";
import { writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "./config.js";

const STORAGE_STATE_PATH = resolve("auth/storage-state.json");

export interface CapturedData {
  tweets: unknown[];
  trends: unknown[];
}

function randomDelay(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function sleep(seconds: number): Promise<void> {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

async function autoScroll(page: Page, config: Config): Promise<void> {
  const { scrollCount, scrollDelayMin, scrollDelayMax } = config.scrape;

  for (let i = 0; i < scrollCount; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    const delay = randomDelay(scrollDelayMin, scrollDelayMax);
    await sleep(delay);
  }
}

export async function scrape(config: Config, outDir: string): Promise<CapturedData> {
  if (!existsSync(STORAGE_STATE_PATH)) {
    console.error("Session not found. Run `pnpm auth` to authenticate.");
    process.exit(1);
  }

  const captured: CapturedData = { tweets: [], trends: [] };
  let gotFirstTimeline = false;

  const browser = await chromium.launch({
    headless: config.scrape.headless,
    channel: "chrome",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const context = await browser.newContext({
    storageState: STORAGE_STATE_PATH,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  async function onResponse(response: Response): Promise<void> {
    const url = response.url();
    if (!url.includes("/graphql/") || response.status() !== 200) return;

    try {
      const body = await response.json();
      if (/HomeTimeline|HomeLatestTimeline/.test(url)) {
        captured.tweets.push(body);
        gotFirstTimeline = true;
      } else if (/GenericTimeline|Trending|ExploreTrending/.test(url)) {
        captured.trends.push(body);
      }
    } catch {
      // non-JSON response, skip
    }
  }

  page.on("response", onResponse);

  try {
    console.error("Navigating to timeline...");
    await page.goto("https://x.com/home", {
      waitUntil: "domcontentloaded",
      timeout: config.scrape.timeout * 1000,
    });

    const currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl.includes("/i/flow/login")) {
      console.error("Session expired. Run `pnpm auth` to re-authenticate.");
      await browser.close();
      process.exit(1);
    }

    // Wait for first timeline GraphQL response before scrolling
    const deadline = Date.now() + config.scrape.timeout * 1000;
    while (!gotFirstTimeline && Date.now() < deadline) {
      await sleep(0.5);
    }

    console.error(`Scrolling timeline (${config.scrape.scrollCount} scrolls)...`);
    await autoScroll(page, config);

    if (config.scrape.scrapeTrends) {
      console.error("Navigating to trending...");
      await page.goto("https://x.com/explore/tabs/trending", {
        waitUntil: "domcontentloaded",
        timeout: config.scrape.timeout * 1000,
      });
      await sleep(2);
      await autoScroll(page, {
        ...config,
        scrape: { ...config.scrape, scrollCount: 3 },
      });
    }
  } finally {
    await browser.close();
  }

  if (captured.tweets.length === 0) {
    console.error("Warning: No tweets captured. Timeline may be empty or session invalid.");
  }

  writeFileSync(join(outDir, "raw-feed.json"), JSON.stringify(captured, null, 2));
  console.error(`Captured ${captured.tweets.length} timeline responses, ${captured.trends.length} trend responses.`);

  return captured;
}
