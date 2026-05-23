import { v4 as uuid } from "uuid";
import type { BlogDraft, RetrievedArticle } from "@pwio/shared";

interface BlogDraftGeneratorOptions {
  createId?: () => string;
  now?: () => Date;
}

export function generateBlogDraft(articles: RetrievedArticle[], options: BlogDraftGeneratorOptions = {}): BlogDraft {
  const createId = options.createId ?? uuid;
  const now = options.now ?? (() => new Date());
  const primary = articles[0];

  return {
    id: createId(),
    title: primary ? `What ${primary.title} Shows About AI Governance` : "AI Governance Signals Worth Watching",
    subtitle: "How operational governance, semantic control, provenance, and publication assurance reduce enterprise risk.",
    summary: "A draft article created from selected monitoring results. Replace this placeholder with an LLM-backed generator when ready.",
    bodyMarkdown: [
      "# Draft Blog",
      "",
      "This is a placeholder blog draft generated from selected intelligence results.",
      "",
      "## Why this matters",
      "",
      "The selected articles indicate continuing market concern around AI governance, semantic consistency, provenance, validation, and operational control.",
      "",
      "## Publish Weaver angle",
      "",
      "Publish Weaver helps organisations govern external-facing content by enforcing semantic governance, publication assurance, operational governance, provenance, validation, and auditability.",
      "",
      "## Source articles",
      "",
      ...articles.map((article) => `- ${article.title} (${article.source})`)
    ].join("\n"),
    sourceArticleIds: articles.map((article) => article.id),
    status: "draft",
    createdAt: now().toISOString()
  };
}
