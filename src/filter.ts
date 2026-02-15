import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Tweet, ParsedFeed } from "./parse.js";
import type { Config } from "./config.js";

const FILTERED_FEED_PATH = resolve("data/filtered-feed.json");

type FilterFn = (tweet: Tweet, config: Config) => boolean;

const registry: FilterFn[] = [];

function register(fn: FilterFn): FilterFn {
  registry.push(fn);
  return fn;
}

register(function blockKeywords(tweet, config) {
  const patterns = config.filters.blockKeywords;
  if (patterns.length === 0) return true;
  return !patterns.some((p) => new RegExp(p, "i").test(tweet.text));
});

register(function blockAccounts(tweet, config) {
  const blocked = config.filters.blockAccounts;
  if (blocked.length === 0) return true;
  const lower = blocked.map((a) => a.toLowerCase());
  return !lower.includes(tweet.author.username.toLowerCase());
});

register(function languages(tweet, config) {
  const allowed = config.filters.languages;
  if (allowed.length === 0) return true;
  return allowed.includes(tweet.language);
});

register(function minEngagement(tweet, config) {
  return tweet.metrics.likes >= config.filters.minLikes;
});

register(function excludeRetweets(tweet, config) {
  if (!config.filters.excludeRetweets) return true;
  return !tweet.isRetweet;
});

register(function maxAge(tweet, config) {
  if (!config.filters.maxAgeHours || !tweet.timestamp) return true;
  const cutoff = Date.now() - config.filters.maxAgeHours * 60 * 60 * 1000;
  const tweetTime = new Date(tweet.timestamp).getTime();
  return tweetTime >= cutoff;
});

export interface FilterStats {
  totalScraped: number;
  afterFiltering: number;
  removedBy: Record<string, number>;
}

export interface FilteredFeed {
  tweets: Tweet[];
  trends: ParsedFeed["trends"];
  filterStats: FilterStats;
  scrapedAt: string;
}

export function applyAll(
  tweets: Tweet[],
  config: Config
): { filtered: Tweet[]; stats: FilterStats } {
  const removedBy: Record<string, number> = {};

  const filtered = tweets.filter((t) =>
    registry.every((fn) => {
      const pass = fn(t, config);
      if (!pass) removedBy[fn.name] = (removedBy[fn.name] ?? 0) + 1;
      return pass;
    })
  );

  return {
    filtered,
    stats: {
      totalScraped: tweets.length,
      afterFiltering: filtered.length,
      removedBy,
    },
  };
}

export function filterFeed(parsed: ParsedFeed, config: Config): FilteredFeed {
  const { filtered, stats } = applyAll(parsed.tweets, config);

  const result: FilteredFeed = {
    tweets: filtered,
    trends: parsed.trends,
    filterStats: stats,
    scrapedAt: parsed.scrapedAt,
  };

  writeFileSync(FILTERED_FEED_PATH, JSON.stringify(result, null, 2));
  console.error(
    `Filtered: ${stats.totalScraped} → ${stats.afterFiltering} tweets. ` +
      `Removed by: ${JSON.stringify(stats.removedBy)}`
  );

  return result;
}
