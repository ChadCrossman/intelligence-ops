import type { QueryDefinition } from "@pwio/shared";

export function buildSearchQuery(query: QueryDefinition): string {
  const includeTerms = query.includeTerms.map((term) => `"${term}"`);
  const excludeTerms = query.excludeTerms.map((term) => `-${term}`);
  const targetDomains = query.targetDomains.map((domain) => `site:${domain}`);
  const domainClause = targetDomains.length > 0 ? `(${targetDomains.join(" OR ")})` : "";

  return [query.baseQuery, ...includeTerms, ...excludeTerms, domainClause].filter(Boolean).join(" ");
}
