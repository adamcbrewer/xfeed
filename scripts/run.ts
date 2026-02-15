import "dotenv/config";
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { scrape } from "../src/scrape.js";
import { parse } from "../src/parse.js";
import { filterFeed } from "../src/filter.js";
import { summarize } from "../src/summarize.js";
import { loadConfig } from "../src/config.js";

const { values } = parseArgs({
  options: {
    "scrape-only": { type: "boolean", default: false },
    summarize: { type: "string" },
    config: { type: "string", default: "config.yaml" },
  },
});

async function main(): Promise<void> {
  const config = loadConfig(values.config!);

  if (values.summarize) {
    const feedJson = readFileSync(values.summarize, "utf-8");
    const digest = await summarize(feedJson, config);
    console.log(digest);
    return;
  }

  const raw = await scrape(config);
  const parsed = parse(raw);
  const filtered = filterFeed(parsed, config);
  const feedJson = JSON.stringify(filtered, null, 2);

  if (values["scrape-only"]) {
    console.log(feedJson);
    return;
  }

  try {
    const digest = await summarize(feedJson, config);
    console.log(digest);
  } catch (err) {
    console.error("LLM summarization failed, printing raw feed:", err);
    console.log(feedJson);
  }
}

main();
