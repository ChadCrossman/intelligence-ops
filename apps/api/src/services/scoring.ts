import type { QueryDefinition } from "@pwio/shared";
import type { SearchResult } from "./searchProvider.js";

// Scoring weights — tune these to adjust ranking sensitivity.
const BASE_SCORE = 40;
const INCLUDE_TERM_WEIGHT = 12;
const DOMAIN_MATCH_BONUS = 15;
const EXCLUSION_PENALTY = 35;
const THEME_MATCH_BONUS = 15;
const THEME_MISS_SCORE = 5;

export function scoreArticle(query: QueryDefinition, result: SearchResult): number {
  const haystack = `${result.title} ${result.snippet} ${result.source}`.toLowerCase();

  const includeScore = query.includeTerms.reduce((score, term) => {
    return haystack.includes(term.toLowerCase()) ? score + INCLUDE_TERM_WEIGHT : score;
  }, BASE_SCORE);

  const domainScore = query.targetDomains.some((domain) => result.source.includes(domain)) ? DOMAIN_MATCH_BONUS : 0;

  const exclusionPenalty = query.excludeTerms.some((term) => haystack.includes(term.toLowerCase())) ? EXCLUSION_PENALTY : 0;

  const themeScore = query.governanceThemes.some((theme) => haystack.includes(theme.toLowerCase()))
    ? THEME_MATCH_BONUS
    : THEME_MISS_SCORE;

  return Math.max(0, Math.min(100, includeScore + domainScore + themeScore - exclusionPenalty));
}
