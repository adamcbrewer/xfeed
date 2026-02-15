import type { CapturedData } from "./scrape.js";

export interface Tweet {
  id: string;
  author: {
    username: string;
    displayName: string;
    followers: number;
    verified: boolean;
  };
  text: string;
  timestamp: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    views: number;
  };
  isRetweet: boolean;
  isQuote: boolean;
  quotedTweet: Tweet | null;
  urls: string[];
  media: string[];
  language: string;
}

export interface Trend {
  name: string;
  tweetCount: number | null;
  category: string | null;
  description: string | null;
}

export interface ParsedFeed {
  tweets: Tweet[];
  trends: Trend[];
  scrapedAt: string;
}

function extractTweetResult(entry: Record<string, unknown>): Record<string, unknown> | null {
  const content = entry.entryId as string | undefined;
  if (!content || typeof content !== "string") return null;
  if (!content.startsWith("tweet-") && !content.startsWith("promoted")) return null;

  try {
    const itemContent = (entry as any).content?.itemContent;
    if (!itemContent) return null;
    const result = itemContent.tweet_results?.result;
    if (!result) return null;

    if (result.__typename === "TweetWithVisibilityResults") {
      return result.tweet ?? null;
    }
    return result;
  } catch {
    return null;
  }
}

function parseTweetObject(raw: Record<string, unknown>): Tweet | null {
  try {
    const legacy = raw.legacy as Record<string, unknown> | undefined;
    if (!legacy) return null;

    const core = raw.core as Record<string, unknown> | undefined;
    const userResults = (core?.user_results as any)?.result;
    const userLegacy = userResults?.legacy as Record<string, unknown> | undefined;

    const retweetedStatus = legacy.retweeted_status_result as Record<string, unknown> | undefined;
    const isRetweet = !!retweetedStatus;

    let quotedTweet: Tweet | null = null;
    const quotedResult = (raw.quoted_status_result as any)?.result;
    if (quotedResult) {
      const inner = quotedResult.__typename === "TweetWithVisibilityResults"
        ? quotedResult.tweet
        : quotedResult;
      if (inner) quotedTweet = parseTweetObject(inner);
    }

    const entities = legacy.entities as Record<string, unknown> | undefined;
    const urls = ((entities?.urls as any[]) ?? [])
      .map((u: any) => u.expanded_url as string)
      .filter(Boolean);

    const extMedia = ((legacy.extended_entities as any)?.media as any[]) ?? [];
    const media = extMedia
      .map((m: any) => (m.media_url_https ?? m.media_url) as string)
      .filter(Boolean);

    const viewCount = (raw.views as any)?.count;

    return {
      id: (legacy.id_str as string) ?? (raw.rest_id as string) ?? "",
      author: {
        username: (userLegacy?.screen_name as string) ?? "",
        displayName: (userLegacy?.name as string) ?? "",
        followers: (userLegacy?.followers_count as number) ?? 0,
        verified: !!(userResults?.is_blue_verified ?? userLegacy?.verified),
      },
      text: (legacy.full_text as string) ?? "",
      timestamp: legacy.created_at
        ? new Date(legacy.created_at as string).toISOString()
        : "",
      metrics: {
        likes: (legacy.favorite_count as number) ?? 0,
        retweets: (legacy.retweet_count as number) ?? 0,
        replies: (legacy.reply_count as number) ?? 0,
        views: viewCount ? Number(viewCount) : 0,
      },
      isRetweet,
      isQuote: (legacy.is_quote_status as boolean) ?? false,
      quotedTweet,
      urls,
      media,
      language: (legacy.lang as string) ?? "und",
    };
  } catch {
    return null;
  }
}

function walkTimelineEntries(data: unknown): Record<string, unknown>[] {
  const entries: Record<string, unknown>[] = [];

  function walk(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }

    const record = obj as Record<string, unknown>;

    if (record.entryId && typeof record.entryId === "string") {
      entries.push(record);
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") walk(value);
    }
  }

  walk(data);
  return entries;
}

function parseTrend(entry: Record<string, unknown>): Trend | null {
  try {
    const content = (entry as any).content?.itemContent?.trend;
    if (!content) {
      const itemContent = (entry as any).content?.itemContent;
      if (itemContent?.name) {
        return {
          name: itemContent.name as string,
          tweetCount: (itemContent.tweetCount as number) ?? null,
          category: (itemContent.category as string) ?? null,
          description: (itemContent.description as string) ?? null,
        };
      }
      return null;
    }

    return {
      name: (content.name as string) ?? "",
      tweetCount: content.tweetCount
        ? parseInt(String(content.tweetCount), 10)
        : null,
      category: (content.associatedCardInfo?.category as string) ?? null,
      description: (content.description as string) ?? null,
    };
  } catch {
    return null;
  }
}

export function parse(raw: CapturedData): ParsedFeed {
  const seenIds = new Set<string>();
  const tweets: Tweet[] = [];

  for (const response of raw.tweets) {
    const entries = walkTimelineEntries(response);
    for (const entry of entries) {
      const tweetResult = extractTweetResult(entry);
      if (!tweetResult) continue;

      const tweet = parseTweetObject(tweetResult);
      if (!tweet || !tweet.id) continue;
      if (seenIds.has(tweet.id)) continue;

      seenIds.add(tweet.id);
      tweets.push(tweet);
    }
  }

  const trends: Trend[] = [];
  const seenTrends = new Set<string>();

  for (const response of raw.trends) {
    const entries = walkTimelineEntries(response);
    for (const entry of entries) {
      const trend = parseTrend(entry);
      if (!trend || !trend.name) continue;
      if (seenTrends.has(trend.name)) continue;

      seenTrends.add(trend.name);
      trends.push(trend);
    }
  }

  const parsed: ParsedFeed = {
    tweets,
    trends,
    scrapedAt: new Date().toISOString(),
  };

  return parsed;
}
