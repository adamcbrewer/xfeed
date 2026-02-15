import { describe, it, expect, vi } from "vitest";
import { parse } from "../src/parse.js";
import sampleTimeline from "./fixtures/sample-timeline.json";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, writeFileSync: vi.fn() };
});

describe("parse", () => {
  const raw = {
    tweets: [sampleTimeline],
    trends: [],
  };

  it("extracts tweets from GraphQL response", () => {
    const result = parse(raw);
    expect(result.tweets.length).toBeGreaterThan(0);
  });

  it("normalizes tweet fields correctly", () => {
    const result = parse(raw);
    const tweet = result.tweets.find((t) => t.id === "1234567890");

    expect(tweet).toBeDefined();
    expect(tweet!.author.username).toBe("techuser");
    expect(tweet!.author.displayName).toBe("Tech User");
    expect(tweet!.author.followers).toBe(50000);
    expect(tweet!.author.verified).toBe(true);
    expect(tweet!.text).toContain("open source TypeScript library");
    expect(tweet!.metrics.likes).toBe(250);
    expect(tweet!.metrics.retweets).toBe(45);
    expect(tweet!.metrics.views).toBe(15000);
    expect(tweet!.urls).toContain("https://github.com/example/graphql-parser");
    expect(tweet!.isRetweet).toBe(false);
    expect(tweet!.language).toBe("en");
  });

  it("detects retweets", () => {
    const result = parse(raw);
    const rt = result.tweets.find((t) => t.id === "2222222222");

    expect(rt).toBeDefined();
    expect(rt!.isRetweet).toBe(true);
  });

  it("deduplicates tweets by ID", () => {
    const duplicated = { tweets: [sampleTimeline, sampleTimeline], trends: [] };
    const result = parse(duplicated);
    const ids = result.tweets.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes scrapedAt timestamp", () => {
    const result = parse(raw);
    expect(result.scrapedAt).toBeDefined();
    expect(new Date(result.scrapedAt).getTime()).not.toBeNaN();
  });

  it("handles empty input gracefully", () => {
    const empty = { tweets: [], trends: [] };
    const result = parse(empty);
    expect(result.tweets).toEqual([]);
    expect(result.trends).toEqual([]);
  });
});
