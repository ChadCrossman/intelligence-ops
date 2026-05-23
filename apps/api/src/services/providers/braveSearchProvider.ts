import type { QueryDefinition } from "@pwio/shared";
import type { SearchProvider } from "../searchProvider.js";
import { buildSearchQuery } from "./queryBuilder.js";
import { mockSearchResults, shouldUseMockProvider } from "./mockProvider.js";

interface BraveWebSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  extra_snippets?: string[];
  age?: string;
  page_age?: string;
  profile?: {
    name?: string;
    long_name?: string;
  };
}

const braveSearchEndpoint = "https://api.search.brave.com/res/v1/web/search";

function freshnessForDateWindow(days: number): string {
  if (days <= 1) return "pd";
  if (days <= 7) return "pw";
  if (days <= 31) return "pm";
  if (days <= 365) return "py";

  return "";
}

function parsePublishedAt(result: BraveWebResult): string {
  const candidate = result.page_age ?? result.age;
  const parsed = candidate ? new Date(candidate) : undefined;

  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function sourceFromResult(result: BraveWebResult): string {
  if (result.profile?.long_name) return result.profile.long_name;
  if (result.profile?.name) return result.profile.name;

  try {
    return result.url ? new URL(result.url).hostname.replace(/^www\./, "") : "unknown source";
  } catch {
    return "unknown source";
  }
}

function snippetFromResult(result: BraveWebResult): string {
  return [result.description, ...(result.extra_snippets ?? [])].filter(Boolean).join(" ");
}

export const braveSearchProvider: SearchProvider = {
  name: "brave",

  async search(query: QueryDefinition) {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!apiKey) {
      if (shouldUseMockProvider()) return mockSearchResults("Brave", query);
      throw new Error("BRAVE_SEARCH_API_KEY is required to run Brave Search queries.");
    }

    const searchUrl = new URL(braveSearchEndpoint);
    searchUrl.searchParams.set("q", buildSearchQuery(query).slice(0, 400));
    searchUrl.searchParams.set("count", String(Math.min(Math.max(query.topX + 5, 1), 20)));
    searchUrl.searchParams.set("safesearch", "moderate");
    searchUrl.searchParams.set("result_filter", "web");
    searchUrl.searchParams.set("text_decorations", "false");
    searchUrl.searchParams.set("extra_snippets", "true");

    const freshness = freshnessForDateWindow(query.dateWindowDays);
    if (freshness) {
      searchUrl.searchParams.set("freshness", freshness);
    }

    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Brave Search request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as BraveWebSearchResponse;

    return (payload.web?.results ?? [])
      .filter((result): result is BraveWebResult & { title: string; url: string } => Boolean(result.title && result.url))
      .map((result) => ({
        title: result.title,
        url: result.url,
        source: sourceFromResult(result),
        publishedAt: parsePublishedAt(result),
        snippet: snippetFromResult(result)
      }));
  }
};
