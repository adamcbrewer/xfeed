import { describe, it, expect } from "vitest";
import { applyAll } from "../src/filter.js";
import type { Tweet } from "../src/parse.js";
import type { Config } from "../src/config.js";

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
  return {
    id: "1",
    author: {
      username: "testuser",
      displayName: "Test User",
      followers: 1000,
      verified: false,
    },
    text: "Hello world",
    timestamp: new Date().toISOString(),
    metrics: { likes: 100, retweets: 10, replies: 5, views: 1000 },
    isRetweet: false,
    isQuote: false,
    quotedTweet: null,
    urls: [],
    media: [],
    language: "en",
    ...overrides,
  };
}

function makeConfig(overrides: Partial<Config["filters"]> = {}): Config {
  return {
    scrape: {
      scrollCount: 10,
      scrollDelayMin: 1.5,
      scrollDelayMax: 3.5,
      headless: true,
      scrapeTrends: true,
      timeout: 60,
    },
    interests: [],
    priorityAccounts: [],
    filters: {
      blockKeywords: [],
      blockAccounts: [],
      languages: ["en"],
      minLikes: 0,
      excludeRetweets: true,
      maxAgeHours: 24,
      ...overrides,
    },
  };
}

describe("filter", () => {
  it("passes tweets matching all criteria", () => {
    const tweets = [makeTweet()];
    const config = makeConfig();
    const { filtered } = applyAll(tweets, config);
    expect(filtered).toHaveLength(1);
  });

  it("blocks tweets by keyword pattern", () => {
    const tweets = [makeTweet({ text: "gm crypto fam! Let's go!" })];
    const config = makeConfig({ blockKeywords: ["gm crypto fam"] });
    const { filtered, stats } = applyAll(tweets, config);
    expect(filtered).toHaveLength(0);
    expect(stats.removedBy["blockKeywords"]).toBe(1);
  });

  it("blocks tweets by account", () => {
    const tweets = [
      makeTweet({
        author: { username: "spambot123", displayName: "Spam", followers: 10, verified: false },
      }),
    ];
    const config = makeConfig({ blockAccounts: ["spambot123"] });
    const { filtered, stats } = applyAll(tweets, config);
    expect(filtered).toHaveLength(0);
    expect(stats.removedBy["blockAccounts"]).toBe(1);
  });

  it("account blocking is case-insensitive", () => {
    const tweets = [
      makeTweet({
        author: { username: "SpamBot123", displayName: "Spam", followers: 10, verified: false },
      }),
    ];
    const config = makeConfig({ blockAccounts: ["spambot123"] });
    const { filtered } = applyAll(tweets, config);
    expect(filtered).toHaveLength(0);
  });

  it("filters by language", () => {
    const tweets = [makeTweet({ language: "ja" })];
    const config = makeConfig({ languages: ["en"] });
    const { filtered, stats } = applyAll(tweets, config);
    expect(filtered).toHaveLength(0);
    expect(stats.removedBy["languages"]).toBe(1);
  });

  it("filters by minimum likes", () => {
    const tweets = [makeTweet({ metrics: { likes: 2, retweets: 0, replies: 0, views: 10 } })];
    const config = makeConfig({ minLikes: 5 });
    const { filtered, stats } = applyAll(tweets, config);
    expect(filtered).toHaveLength(0);
    expect(stats.removedBy["minEngagement"]).toBe(1);
  });

  it("excludes retweets when configured", () => {
    const tweets = [makeTweet({ isRetweet: true })];
    const config = makeConfig({ excludeRetweets: true });
    const { filtered, stats } = applyAll(tweets, config);
    expect(filtered).toHaveLength(0);
    expect(stats.removedBy["excludeRetweets"]).toBe(1);
  });

  it("keeps retweets when excludeRetweets is false", () => {
    const tweets = [makeTweet({ isRetweet: true })];
    const config = makeConfig({ excludeRetweets: false });
    const { filtered } = applyAll(tweets, config);
    expect(filtered).toHaveLength(1);
  });

  it("filters old tweets by maxAgeHours", () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const tweets = [makeTweet({ timestamp: old })];
    const config = makeConfig({ maxAgeHours: 24 });
    const { filtered, stats } = applyAll(tweets, config);
    expect(filtered).toHaveLength(0);
    expect(stats.removedBy["maxAge"]).toBe(1);
  });

  it("reports correct filter stats", () => {
    const tweets = [
      makeTweet({ id: "1" }),
      makeTweet({ id: "2", text: "gm crypto fam!" }),
      makeTweet({ id: "3", isRetweet: true }),
      makeTweet({ id: "4", language: "ja" }),
    ];
    const config = makeConfig({ blockKeywords: ["gm crypto fam"] });
    const { stats } = applyAll(tweets, config);
    expect(stats.totalScraped).toBe(4);
    expect(stats.afterFiltering).toBe(1);
  });
});
