import type { BlogDraft, EmailCampaign, QueryDefinition, QueryRun, RetrievedArticle } from "@pwio/shared";

export function toQueryDefinition(row: Record<string, unknown>): QueryDefinition {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    baseQuery: String(row.base_query),
    includeTerms: (row.include_terms ?? []) as string[],
    excludeTerms: (row.exclude_terms ?? []) as string[],
    targetDomains: (row.target_domains ?? []) as string[],
    dateWindowDays: Number(row.date_window_days),
    topX: Number(row.top_x),
    minimumScore: Number(row.minimum_score),
    frequency: row.frequency as QueryDefinition["frequency"],
    status: row.status as QueryDefinition["status"],
    governanceThemes: (row.governance_themes ?? []) as string[],
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    lastRunAt: row.last_run_at ? new Date(row.last_run_at as string).toISOString() : undefined,
    nextRunAt: row.next_run_at ? new Date(row.next_run_at as string).toISOString() : undefined
  };
}

export function toQueryRun(row: Record<string, unknown>): QueryRun {
  return {
    id: String(row.id),
    queryDefinitionId: String(row.query_definition_id),
    status: row.status as QueryRun["status"],
    startedAt: new Date(row.started_at as string).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at as string).toISOString() : undefined,
    articlesFound: Number(row.articles_found),
    articlesSelected: Number(row.articles_selected),
    errorMessage: row.error_message ? String(row.error_message) : undefined
  };
}

export function toRetrievedArticle(row: Record<string, unknown>): RetrievedArticle {
  return {
    id: String(row.id),
    queryRunId: String(row.query_run_id),
    queryDefinitionId: String(row.query_definition_id),
    title: String(row.title),
    url: String(row.url),
    source: String(row.source),
    publishedAt: new Date(row.published_at as string).toISOString(),
    snippet: String(row.snippet ?? ""),
    relevanceScore: Number(row.relevance_score),
    governanceThemes: (row.governance_themes ?? []) as string[],
    status: row.status as RetrievedArticle["status"]
  };
}

export function toBlogDraft(row: Record<string, unknown>): BlogDraft {
  return {
    id: String(row.id),
    title: String(row.title),
    subtitle: String(row.subtitle ?? ""),
    summary: String(row.summary ?? ""),
    bodyMarkdown: String(row.body_markdown ?? ""),
    sourceArticleIds: (row.source_article_ids ?? []) as string[],
    status: row.status as BlogDraft["status"],
    createdAt: new Date(row.created_at as string).toISOString()
  };
}

export function toEmailCampaign(row: Record<string, unknown>): EmailCampaign {
  return {
    id: String(row.id),
    subject: String(row.subject),
    synopsisMarkdown: String(row.synopsis_markdown ?? ""),
    blogDraftIds: (row.blog_draft_ids ?? []) as string[],
    status: row.status as EmailCampaign["status"],
    createdAt: new Date(row.created_at as string).toISOString()
  };
}
