import type { BlogDraft, DashboardSnapshot, EmailCampaign, QueryDefinition, QueryRun, RetrievedArticle } from "@pwio/shared";

export interface Store {
  queries: QueryDefinition[];
  runs: QueryRun[];
  articles: RetrievedArticle[];
  blogDrafts: BlogDraft[];
  emailCampaigns: EmailCampaign[];
}

export interface Storage {
  snapshot(): Promise<DashboardSnapshot>;
  listQueries(): Promise<QueryDefinition[]>;
  upsertQuery(query: QueryDefinition): Promise<QueryDefinition>;
  getQuery(id: string): Promise<QueryDefinition | undefined>;
  addRun(run: QueryRun): Promise<void>;
  updateRun(run: QueryRun): Promise<void>;
  addArticles(articles: RetrievedArticle[]): Promise<void>;
  updateArticleStatus(id: string, status: RetrievedArticle["status"]): Promise<RetrievedArticle | undefined>;
  addBlogDraft(blogDraft: BlogDraft): Promise<void>;
  addEmailCampaign(emailCampaign: EmailCampaign): Promise<void>;
}
