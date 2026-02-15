import type { Tweet, ParsedFeed } from "./parse.js";
import type { Config } from "./config.js";

type FilterFn = (tweet: Tweet, config: Config) => boolean;

const registry: FilterFn[] = [];
const regexCache = new Map<string, RegExp | null>();

function register(fn: FilterFn): FilterFn {
  registry.push(fn);
  return fn;
}

function compileRegex(pattern: string): RegExp | null {
  const cached = regexCache.get(pattern);
  if (cached !== undefined) return cached;
  try {
    const re = new RegExp(pattern, "i");
    regexCache.set(pattern, re);
    return re;
  } catch {
    console.error(`Invalid blockKeyword regex, skipping: ${pattern}`);
    regexCache.set(pattern, null);
    return null;
  }
}

register(function blockKeywords(tweet, config) {
  const patterns = config.filters.blockKeywords;
  if (patterns.length === 0) return true;
  return !patterns.some((p) => {
    const re = compileRegex(p);
    return re ? re.test(tweet.text) : false;
  });
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

  return {
    tweets: filtered,
    trends: parsed.trends,
    filterStats: stats,
    scrapedAt: parsed.scrapedAt,
  };
}
