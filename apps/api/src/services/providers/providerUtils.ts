import type { QueryDefinition } from "@pwio/shared";
import type { SearchResult } from "../searchProvider.js";

export function buildSearchQuery(query: QueryDefinition): string {
  const includeTerms = query.includeTerms.map((term) => `"${term}"`);
  const excludeTerms = query.excludeTerms.map((term) => `-${term}`);
  const targetDomains = query.targetDomains.map((domain) => `site:${domain}`);
  const domainClause = targetDomains.length > 0 ? `(${targetDomains.join(" OR ")})` : "";

  return [query.baseQuery, ...includeTerms, ...excludeTerms, domainClause].filter(Boolean).join(" ");
}

export function shouldUseMockProvider(): boolean {
  return process.env.MOCK_SEARCH_PROVIDERS !== "false";
}

export function mockSearchResults(providerName: string, query: QueryDefinition, count = 3): SearchResult[] {
  const now = new Date().toISOString();
  const themes = query.governanceThemes.length > 0 ? query.governanceThemes.join(", ") : "AI governance";

  return Array.from({ length: count }, (_, index) => ({
    title: `${providerName} mock result ${index + 1}: ${query.name}`,
    url: `https://mock.intelligence-ops.local/${providerName.toLowerCase().replaceAll(" ", "-")}/${query.id}/${index + 1}`,
    source: `${providerName} mock`,
    publishedAt: now,
    snippet: `Mocked ${providerName} result for ${query.baseQuery}. Themes: ${themes}. Replace credentials or feed URLs to enable live ingestion.`
  }));
}

export function hostnameFromUrl(value: string, fallback = "unknown source"): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

export function firstText(value: string, pattern: RegExp): string | undefined {
  const match = value.match(pattern);
  return match?.[1] ? decodeXml(match[1].trim()) : undefined;
}

export function decodeXml(value: string): string {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

export function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchText(url: string, headers?: HeadersInit): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": "PublishWeaver-IntelligenceOps/0.1", ...headers } });

  if (!response.ok) {
    throw new Error(`${url} failed with status ${response.status}`);
  }

  return response.text();
}

export function envList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
