import type { QueryDefinition } from "@pwio/shared";
import { arxivSearchProvider } from "./providers/arxivSearchProvider.js";
import { braveSearchProvider } from "./providers/braveSearchProvider.js";
import { academicFeedsProvider, governanceBlogsProvider, regulatoryFeedsProvider, vendorBlogsProvider } from "./providers/feedCategoryProviders.js";
import { bingSearchProvider, googleSearchProvider, newsApiProvider } from "./providers/genericSearchProviders.js";
import { redditSearchProvider } from "./providers/redditSearchProvider.js";
import { rssSearchProvider } from "./providers/rssSearchProvider.js";
import type { SearchProvider, SearchResult } from "./searchProvider.js";

export class SearchOrchestrator {
  constructor(private readonly providers: SearchProvider[]) {}

  async execute(query: QueryDefinition): Promise<SearchResult[]> {
    const settledResults = await Promise.allSettled(this.providers.map((provider) => provider.search(query)));
    const successfulResults = settledResults
      .filter((result): result is PromiseFulfilledResult<SearchResult[]> => result.status === "fulfilled")
      .flatMap((result) => result.value);

    if (successfulResults.length > 0) {
      return dedupeByUrl(successfulResults);
    }

    const errors = settledResults
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => (result.reason instanceof Error ? result.reason.message : "Unknown provider error"));

    throw new Error(errors.length > 0 ? errors.join("; ") : "No search providers are configured.");
  }
}

function dedupeByUrl(results: SearchResult[]): SearchResult[] {
  const byUrl = new Map<string, SearchResult>();

  for (const result of results) {
    const key = normalizeUrl(result.url);
    const existing = byUrl.get(key);

    if (!existing || result.snippet.length > existing.snippet.length) {
      byUrl.set(key, result);
    }
  }

  return Array.from(byUrl.values());
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";

    for (const key of Array.from(url.searchParams.keys())) {
      if (key.toLowerCase().startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }

    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

export const searchOrchestrator = new SearchOrchestrator([
  braveSearchProvider,
  googleSearchProvider,
  bingSearchProvider,
  rssSearchProvider,
  arxivSearchProvider,
  newsApiProvider,
  redditSearchProvider,
  regulatoryFeedsProvider,
  governanceBlogsProvider,
  vendorBlogsProvider,
  academicFeedsProvider
]);
