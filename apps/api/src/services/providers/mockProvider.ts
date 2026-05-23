import type { QueryDefinition } from "@pwio/shared";
import type { SearchResult } from "../searchProvider.js";

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
