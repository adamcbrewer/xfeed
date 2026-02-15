import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { scrape } from "./scrape.js";
import { parse } from "./parse.js";
import { filterFeed } from "./filter.js";
import { loadConfig } from "./config.js";

export function createRunDir(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve("data", ts);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function main(configPath = "config.yaml"): Promise<void> {
  const config = loadConfig(configPath);
  const outDir = createRunDir();
  console.error(`Output: ${outDir}`);

  const raw = await scrape(config, outDir);

  const parsed = parse(raw);
  writeFileSync(join(outDir, "parsed-feed.json"), JSON.stringify(parsed, null, 2));
  console.error(`Parsed ${parsed.tweets.length} tweets, ${parsed.trends.length} trends.`);

  const filtered = filterFeed(parsed, config);
  writeFileSync(join(outDir, "filtered-feed.json"), JSON.stringify(filtered, null, 2));
  console.error(
    `Filtered: ${filtered.filterStats.totalScraped} → ${filtered.filterStats.afterFiltering} tweets. ` +
      `Removed by: ${JSON.stringify(filtered.filterStats.removedBy)}`
  );

  console.log(JSON.stringify(filtered, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
