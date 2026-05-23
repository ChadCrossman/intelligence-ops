import type { SearchProvider } from "../searchProvider.js";
import { buildSearchQuery, mockSearchResults, shouldUseMockProvider } from "./providerUtils.js";

export const redditSearchProvider: SearchProvider = {
  name: "reddit",

  async search(query) {
    const subreddits = process.env.REDDIT_SUBREDDITS ?? "artificial,MachineLearning,technology,Futurology";
    const url = new URL(`https://www.reddit.com/r/${subreddits}/search.json`);
    url.searchParams.set("q", buildSearchQuery(query).slice(0, 300));
    url.searchParams.set("restrict_sr", "false");
    url.searchParams.set("sort", "new");
    url.searchParams.set("limit", String(Math.min(Math.max(query.topX + 5, 1), 25)));

    try {
      const response = await fetch(url, { headers: { "User-Agent": "PublishWeaver-IntelligenceOps/0.1" } });
      if (!response.ok) throw new Error(`Reddit request failed with status ${response.status}.`);

      const payload = (await response.json()) as {
        data?: { children?: Array<{ data?: { title?: string; permalink?: string; selftext?: string; subreddit_name_prefixed?: string; created_utc?: number } }> };
      };

      return (payload.data?.children ?? [])
        .map((child) => child.data)
        .filter((item): item is { title: string; permalink: string; selftext?: string; subreddit_name_prefixed?: string; created_utc?: number } =>
          Boolean(item?.title && item.permalink)
        )
        .map((item) => ({
          title: item.title,
          url: `https://www.reddit.com${item.permalink}`,
          source: item.subreddit_name_prefixed ?? "Reddit",
          publishedAt: item.created_utc ? new Date(item.created_utc * 1000).toISOString() : new Date().toISOString(),
          snippet: item.selftext ?? ""
        }));
    } catch (error) {
      if (shouldUseMockProvider()) return mockSearchResults("Reddit", query);
      throw error;
    }
  }
};
