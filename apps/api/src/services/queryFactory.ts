import { v4 as uuid } from "uuid";
import type { QueryDefinition } from "@pwio/shared";
import type { queryDefinitionInputSchema } from "@pwio/shared";
import type { z } from "zod";

type QueryDefinitionInput = z.infer<typeof queryDefinitionInputSchema>;

export function buildQueryDefinition(input: QueryDefinitionInput): QueryDefinition {
  const now = new Date().toISOString();

  return {
    id: input.id ?? uuid(),
    name: input.name ?? "Untitled query",
    description: input.description ?? "",
    baseQuery: input.baseQuery ?? "",
    includeTerms: input.includeTerms ?? [],
    excludeTerms: input.excludeTerms ?? [],
    targetDomains: input.targetDomains ?? [],
    dateWindowDays: input.dateWindowDays ?? 30,
    topX: input.topX ?? 5,
    minimumScore: input.minimumScore ?? 70,
    frequency: input.frequency ?? "manual",
    status: input.status ?? "enabled",
    governanceThemes: input.governanceThemes ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    lastRunAt: input.lastRunAt,
    nextRunAt: input.nextRunAt
  };
}
