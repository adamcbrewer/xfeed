import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { scrape } from "../src/scrape.js";
import { parse } from "../src/parse.js";
import { filterFeed } from "../src/filter.js";
import { loadConfig } from "../src/config.js";
import { createRunDir } from "../src/pipeline.js";

const { values } = parseArgs({
  options: {
    "scrape-only": { type: "boolean", default: false },
    config: { type: "string", default: "config.yaml" },
  },
});

async function main(): Promise<void> {
  const config = loadConfig(values.config!);
  const outDir = createRunDir();
  console.error(`Output: ${outDir}`);

  const raw = await scrape(config, outDir);

  const parsed = parse(raw);
  writeFileSync(join(outDir, "parsed-feed.json"), JSON.stringify(parsed, null, 2));
  console.error(`Parsed ${parsed.tweets.length} tweets, ${parsed.trends.length} trends.`);

  if (values["scrape-only"]) {
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

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
