import type { SearchProvider, SearchResult } from "../searchProvider.js";
import { buildSearchQuery } from "./queryBuilder.js";
import { fetchText } from "./httpClient.js";
import { firstText, stripTags } from "./feedParser.js";
import { mockSearchResults, shouldUseMockProvider } from "./mockProvider.js";

function parseArxiv(xml: string): SearchResult[] {
  return Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi), (match) => match[0])
    .map((entry) => {
      const title = firstText(entry, /<title[^>]*>([\s\S]*?)<\/title>/i);
      const id = firstText(entry, /<id[^>]*>([\s\S]*?)<\/id>/i);
      const summary = firstText(entry, /<summary[^>]*>([\s\S]*?)<\/summary>/i) ?? "";
      const published = firstText(entry, /<published[^>]*>([\s\S]*?)<\/published>/i);

      if (!title || !id) return undefined;

      const publishedAt = published ? new Date(published) : undefined;
      return {
        title,
        url: id,
        source: "arXiv",
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : new Date().toISOString(),
        snippet: stripTags(summary)
      };
    })
    .filter((result): result is SearchResult => Boolean(result));
}

export const arxivSearchProvider: SearchProvider = {
  name: "arxiv",

  async search(query) {
    const searchUrl = new URL("https://export.arxiv.org/api/query");
    searchUrl.searchParams.set("search_query", `all:${buildSearchQuery(query).slice(0, 220)}`);
    searchUrl.searchParams.set("start", "0");
    searchUrl.searchParams.set("max_results", String(Math.min(Math.max(query.topX + 5, 1), 50)));
    searchUrl.searchParams.set("sortBy", "submittedDate");
    searchUrl.searchParams.set("sortOrder", "descending");

    try {
      return parseArxiv(await fetchText(searchUrl.toString()));
    } catch (error) {
      if (shouldUseMockProvider()) return mockSearchResults("arXiv", query);
      throw error;
    }
  }
};
