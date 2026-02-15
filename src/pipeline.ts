import { scrape } from "./scrape.js";
import { parse } from "./parse.js";
import { filterFeed } from "./filter.js";
import { loadConfig } from "./config.js";

async function main(configPath = "config.yaml"): Promise<void> {
  const config = loadConfig(configPath);

  const raw = await scrape(config);
  const parsed = parse(raw);
  const filtered = filterFeed(parsed, config);

  console.log(JSON.stringify(filtered, null, 2));
}

main();
