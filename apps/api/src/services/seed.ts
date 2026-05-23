import type { QueryDefinition } from "@pwio/shared";

export const seedQueries: QueryDefinition[] = [
  {
    id: "query-ai-governance",
    name: "AI Governance",
    description: "General enterprise AI governance, oversight, assurance, and controls.",
    baseQuery: "(\"AI governance\" OR \"generative AI governance\" OR \"enterprise AI governance\") (compliance OR oversight OR controls OR assurance)",
    includeTerms: ["enterprise", "governance", "risk"],
    excludeTerms: ["homework", "students", "image generator"],
    targetDomains: ["cio.com", "forbes.com", "nist.gov", "europa.eu"],
    dateWindowDays: 30,
    topX: 5,
    minimumScore: 70,
    frequency: "daily",
    status: "enabled",
    governanceThemes: ["AI operational governance", "publication assurance"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "query-semantic-drift",
    name: "Semantic Drift",
    description: "Meaning drift, inconsistency, hallucination risk, and output reliability.",
    baseQuery: "(\"AI semantic drift\" OR \"meaning drift\" OR \"AI output reliability\" OR \"AI inconsistency\")",
    includeTerms: ["traceability", "validation", "provenance"],
    excludeTerms: ["school", "essay"],
    targetDomains: ["venturebeat.com", "wired.com", "mit.edu", "arxiv.org"],
    dateWindowDays: 56,
    topX: 5,
    minimumScore: 65,
    frequency: "weekly",
    status: "enabled",
    governanceThemes: ["semantic governance", "provenance"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
