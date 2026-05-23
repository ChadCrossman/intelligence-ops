import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { RetrievedArticle } from "@pwio/shared";
import { generateBlogDraft } from "./blogGenerator.js";

const articles: RetrievedArticle[] = [
  {
    id: "article-1",
    queryRunId: "run-1",
    queryDefinitionId: "query-1",
    title: "Regulators tighten AI governance expectations",
    url: "https://example.com/regulators-ai-governance",
    source: "example.com",
    publishedAt: "2026-01-02T00:00:00.000Z",
    snippet: "Regulatory teams increase scrutiny of provenance and validation.",
    relevanceScore: 91,
    governanceThemes: ["operational governance"],
    status: "selected"
  },
  {
    id: "article-2",
    queryRunId: "run-1",
    queryDefinitionId: "query-1",
    title: "Enterprise teams improve publication assurance",
    url: "https://governance.test/publication-assurance",
    source: "governance.test",
    publishedAt: "2026-01-03T00:00:00.000Z",
    snippet: "Content teams invest in semantic consistency controls.",
    relevanceScore: 84,
    governanceThemes: ["publication assurance"],
    status: "selected"
  }
];

const generatorOptions = {
  createId: () => "blog-draft-1",
  now: () => new Date("2026-01-04T00:00:00.000Z")
};

describe("generateBlogDraft", () => {
  it("creates a deterministic draft from selected articles", () => {
    const draft = generateBlogDraft(articles, generatorOptions);

    assert.equal(draft.id, "blog-draft-1");
    assert.equal(draft.createdAt, "2026-01-04T00:00:00.000Z");
    assert.equal(draft.status, "draft");
    assert.equal(draft.title, "What Regulators tighten AI governance expectations Shows About AI Governance");
    assert.deepEqual(draft.sourceArticleIds, ["article-1", "article-2"]);
    assert.match(draft.bodyMarkdown, /- Regulators tighten AI governance expectations \(example\.com\)/);
    assert.match(draft.bodyMarkdown, /- Enterprise teams improve publication assurance \(governance\.test\)/);
  });

  it("uses a generic title and no source ids when no articles are provided", () => {
    const draft = generateBlogDraft([], generatorOptions);

    assert.equal(draft.title, "AI Governance Signals Worth Watching");
    assert.deepEqual(draft.sourceArticleIds, []);
    assert.equal(draft.createdAt, "2026-01-04T00:00:00.000Z");
  });
});
