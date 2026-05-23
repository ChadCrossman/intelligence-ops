import type { QueryDefinition } from "@pwio/shared";

export interface SearchResult {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
}

export interface SearchProvider {
  search(query: QueryDefinition): Promise<SearchResult[]>;
}

export const mockSearchProvider: SearchProvider = {
  async search(query) {
    const now = new Date();

    return Array.from({ length: Math.max(query.topX + 3, 8) }).map((_, index) => {
      const publishedAt = new Date(now);
      publishedAt.setDate(now.getDate() - index);

      const theme = query.governanceThemes[index % query.governanceThemes.length] ?? "AI governance";

      return {
        title: `${query.name}: ${theme} article ${index + 1}`,
        url: `https://example.com/${query.id}/article-${index + 1}`,
        source: query.targetDomains[index % Math.max(query.targetDomains.length, 1)] ?? "example.com",
        publishedAt: publishedAt.toISOString(),
        snippet: `Mock article discussing ${query.baseQuery}, ${query.includeTerms.join(", ")}, provenance, validation, approval workflows, and enterprise risk.`
      };
    });
  }
};
