import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { QueryDefinition } from "@pwio/shared";
import { scoreArticle } from "./scoring.js";
import type { SearchResult } from "./searchProvider.js";

const query: QueryDefinition = {
  id: "query-ai-governance",
  name: "AI Governance",
  description: "Governance monitoring query",
  baseQuery: "AI governance",
  includeTerms: ["provenance", "validation"],
  excludeTerms: ["sports"],
  targetDomains: ["example.com"],
  dateWindowDays: 30,
  topX: 5,
  minimumScore: 70,
  frequency: "manual",
  status: "enabled",
  governanceThemes: ["operational governance"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    title: "Operational governance and provenance controls",
    url: "https://example.com/article",
    source: "example.com",
    publishedAt: "2026-01-02T00:00:00.000Z",
    snippet: "Validation workflows strengthen operational governance for AI systems.",
    ...overrides
  };
}

describe("scoreArticle", () => {
  it("scores matching include terms, target domain, and governance theme", () => {
    assert.equal(scoreArticle(query, result()), 94);
  });

  it("applies a penalty when excluded terms are present", () => {
    assert.equal(
      scoreArticle(
        query,
        result({
          title: "Unrelated update",
          source: "unmatched.test",
          snippet: "A sports story with no relevant governance signal."
        })
      ),
      10
    );
  });

  it("caps high scores at 100", () => {
    assert.equal(
      scoreArticle(
        {
          ...query,
          includeTerms: ["provenance", "validation", "audit", "risk", "semantic", "controls"]
        },
        result({
          snippet: "Provenance, validation, audit, risk, semantic, and controls all appear in this operational governance update."
        })
      ),
      100
    );
  });
});
