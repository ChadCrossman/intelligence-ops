import type { SearchProvider, SearchResult } from "../searchProvider.js";
import { envList } from "./envUtils.js";
import { fetchText } from "./httpClient.js";
import { firstText, hostnameFromUrl, stripTags } from "./feedParser.js";
import { mockSearchResults, shouldUseMockProvider } from "./mockProvider.js";

const defaultFeeds = [
  "https://openai.com/news/rss.xml",
  "https://blogs.microsoft.com/ai/feed/",
  "https://research.google/blog/rss/",
  "https://deepmind.google/discover/blog/rss.xml"
];

function parseRss(xml: string, feedUrl: string): SearchResult[] {
  const itemBlocks = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi), (match) => match[0]);
  const entryBlocks = Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi), (match) => match[0]);
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  return blocks
    .map((block) => {
      const title = firstText(block, /<title[^>]*>([\s\S]*?)<\/title>/i);
      const rssLink = firstText(block, /<link[^>]*>([\s\S]*?)<\/link>/i);
      const atomLink = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
      const url = rssLink ?? atomLink;
      const description =
        firstText(block, /<description[^>]*>([\s\S]*?)<\/description>/i) ??
        firstText(block, /<summary[^>]*>([\s\S]*?)<\/summary>/i) ??
        "";
      const publishedAt =
        firstText(block, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ??
        firstText(block, /<updated[^>]*>([\s\S]*?)<\/updated>/i) ??
        firstText(block, /<published[^>]*>([\s\S]*?)<\/published>/i);

      if (!title || !url) return undefined;

      const parsedDate = publishedAt ? new Date(publishedAt) : undefined;
      return {
        title,
        url,
        source: hostnameFromUrl(feedUrl, "RSS"),
        publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString(),
        snippet: stripTags(description)
      };
    })
    .filter((result): result is SearchResult => Boolean(result));
}

export async function searchRssFeeds(feedUrls: string[]): Promise<SearchResult[]> {
  const settled = await Promise.allSettled(
    feedUrls.map(async (feedUrl) => parseRss(await fetchText(feedUrl), feedUrl))
  );
  return settled
    .filter((result): result is PromiseFulfilledResult<SearchResult[]> => result.status === "fulfilled")
    .flatMap((result) => result.value);
}

export const rssSearchProvider: SearchProvider = {
  name: "rss",

  async search(query) {
    const feeds = envList("RSS_SOURCE_URLS");
    const feedUrls = feeds.length > 0 ? feeds : defaultFeeds;

    if (feedUrls.length === 0) {
      if (shouldUseMockProvider()) return mockSearchResults("RSS", query);
      throw new Error("RSS_SOURCE_URLS is required to run RSS ingestion.");
    }

    const results = await searchRssFeeds(feedUrls);

    return results.length > 0 || !shouldUseMockProvider() ? results : mockSearchResults("RSS", query);
  }
};
