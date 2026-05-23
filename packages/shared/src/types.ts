export type QueryStatus = "enabled" | "paused";
export type RunStatus = "queued" | "running" | "success" | "failed";
export type BlogDraftStatus = "draft" | "review" | "approved" | "published";
export type EmailCampaignStatus = "draft" | "review" | "approved" | "sent";

export type ScheduleFrequency = "manual" | "hourly" | "daily" | "weekly";

export interface QueryDefinition {
  id: string;
  name: string;
  description: string;
  baseQuery: string;
  includeTerms: string[];
  excludeTerms: string[];
  targetDomains: string[];
  dateWindowDays: number;
  topX: number;
  minimumScore: number;
  frequency: ScheduleFrequency;
  status: QueryStatus;
  governanceThemes: string[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface QueryRun {
  id: string;
  queryDefinitionId: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  articlesFound: number;
  articlesSelected: number;
  errorMessage?: string;
}

export interface RetrievedArticle {
  id: string;
  queryRunId: string;
  queryDefinitionId: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
  relevanceScore: number;
  governanceThemes: string[];
  status: "new" | "accepted" | "rejected" | "selected";
}

export interface BlogDraft {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  bodyMarkdown: string;
  sourceArticleIds: string[];
  status: BlogDraftStatus;
  createdAt: string;
}

export interface EmailCampaign {
  id: string;
  subject: string;
  synopsisMarkdown: string;
  blogDraftIds: string[];
  status: EmailCampaignStatus;
  createdAt: string;
}

export interface DashboardSnapshot {
  queries: QueryDefinition[];
  recentRuns: QueryRun[];
  recentArticles: RetrievedArticle[];
  blogDrafts: BlogDraft[];
  emailCampaigns: EmailCampaign[];
}
