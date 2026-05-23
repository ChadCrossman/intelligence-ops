import type { SearchProvider } from "../searchProvider.js";
import { buildSearchQuery } from "./queryBuilder.js";
import { mockSearchResults, shouldUseMockProvider } from "./mockProvider.js";

interface WebResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string;
}

function missingCredential(providerName: string, names: string[]): Error {
  return new Error(`${names.join(" and ")} required to run ${providerName}.`);
}

export const googleSearchProvider: SearchProvider = {
  name: "google",

  async search(query) {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !cx) {
      if (shouldUseMockProvider()) return mockSearchResults("Google", query);
      throw missingCredential("Google Custom Search", ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID"]);
    }

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", buildSearchQuery(query).slice(0, 400));
    url.searchParams.set("num", String(Math.min(Math.max(query.topX, 1), 10)));

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Search request failed with status ${response.status}.`);

    const payload = (await response.json()) as {
      items?: Array<{ title?: string; link?: string; snippet?: string; displayLink?: string }>;
    };

    return (payload.items ?? [])
      .filter((item): item is { title: string; link: string; snippet?: string; displayLink?: string } =>
        Boolean(item.title && item.link)
      )
      .map((item) => ({
        title: item.title,
        url: item.link,
        source: item.displayLink ?? "Google",
        publishedAt: new Date().toISOString(),
        snippet: item.snippet ?? ""
      }));
  }
};

export const bingSearchProvider: SearchProvider = {
  name: "bing",

  async search(query) {
    const apiKey = process.env.BING_SEARCH_API_KEY;

    if (!apiKey) {
      if (shouldUseMockProvider()) return mockSearchResults("Bing", query);
      throw missingCredential("Bing Web Search", ["BING_SEARCH_API_KEY"]);
    }

    const url = new URL("https://api.bing.microsoft.com/v7.0/search");
    url.searchParams.set("q", buildSearchQuery(query).slice(0, 400));
    url.searchParams.set("count", String(Math.min(Math.max(query.topX + 5, 1), 50)));
    url.searchParams.set("responseFilter", "Webpages,News");
    url.searchParams.set("safeSearch", "Moderate");

    const response = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": apiKey } });
    if (!response.ok) throw new Error(`Bing Search request failed with status ${response.status}.`);

    const payload = (await response.json()) as {
      webPages?: { value?: WebResult[] };
      news?: { value?: WebResult[] };
    };
    const results = [...(payload.webPages?.value ?? []), ...(payload.news?.value ?? [])];

    return results.map((item) => ({
      title: item.title,
      url: item.url,
      source: item.source ?? "Bing",
      publishedAt: item.publishedAt ?? new Date().toISOString(),
      snippet: item.snippet ?? ""
    }));
  }
};

export const newsApiProvider: SearchProvider = {
  name: "news-api",

  async search(query) {
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
      if (shouldUseMockProvider()) return mockSearchResults("News API", query);
      throw missingCredential("News API", ["NEWS_API_KEY"]);
    }

    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", buildSearchQuery(query).slice(0, 500));
    url.searchParams.set("pageSize", String(Math.min(Math.max(query.topX + 5, 1), 100)));
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("language", "en");

    const response = await fetch(url, { headers: { "X-Api-Key": apiKey } });
    if (!response.ok) throw new Error(`News API request failed with status ${response.status}.`);

    const payload = (await response.json()) as {
      articles?: Array<{
        title?: string;
        url?: string;
        description?: string;
        source?: { name?: string };
        publishedAt?: string;
      }>;
    };

    return (payload.articles ?? [])
      .filter(
        (item): item is { title: string; url: string; description?: string; source?: { name?: string }; publishedAt?: string } =>
          Boolean(item.title && item.url)
      )
      .map((item) => ({
        title: item.title,
        url: item.url,
        source: item.source?.name ?? "News API",
        publishedAt: item.publishedAt ?? new Date().toISOString(),
        snippet: item.description ?? ""
      }));
  }
};
