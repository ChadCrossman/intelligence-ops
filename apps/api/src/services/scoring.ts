import type { QueryDefinition } from "@pwio/shared";
import type { SearchResult } from "./searchProvider.js";

export function scoreArticle(query: QueryDefinition, result: SearchResult): number {
  const haystack = `${result.title} ${result.snippet} ${result.source}`.toLowerCase();

  const includeScore = query.includeTerms.reduce((score, term) => {
    return haystack.includes(term.toLowerCase()) ? score + 12 : score;
  }, 40);

  const domainScore = query.targetDomains.some((domain) => result.source.includes(domain)) ? 15 : 0;

  const exclusionPenalty = query.excludeTerms.some((term) => haystack.includes(term.toLowerCase())) ? 35 : 0;

  const themeScore = query.governanceThemes.some((theme) => haystack.includes(theme.toLowerCase())) ? 15 : 5;

  return Math.max(0, Math.min(100, includeScore + domainScore + themeScore - exclusionPenalty));
}
