import type { QueryDefinition } from "@pwio/shared";

export interface SearchResult {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
}

export interface SearchProvider {
  name: string;
  search(query: QueryDefinition): Promise<SearchResult[]>;
}
