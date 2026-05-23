import { z } from "zod";

export const queryStatusSchema = z.enum(["enabled", "paused"]);
export const runStatusSchema = z.enum(["queued", "running", "success", "failed"]);
export const blogDraftStatusSchema = z.enum(["draft", "review", "approved", "published"]);
export const emailCampaignStatusSchema = z.enum(["draft", "review", "approved", "sent"]);
export const scheduleFrequencySchema = z.enum(["manual", "hourly", "daily", "weekly"]);
export const articleStatusSchema = z.enum(["new", "accepted", "rejected", "selected"]);

const isoDateStringSchema = z.string().datetime({ offset: true });

export const queryDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  baseQuery: z.string(),
  includeTerms: z.array(z.string()),
  excludeTerms: z.array(z.string()),
  targetDomains: z.array(z.string()),
  dateWindowDays: z.number().int().min(1).max(365),
  topX: z.number().int().min(1).max(50),
  minimumScore: z.number().int().min(0).max(100),
  frequency: scheduleFrequencySchema,
  status: queryStatusSchema,
  governanceThemes: z.array(z.string()),
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
  lastRunAt: isoDateStringSchema.optional(),
  nextRunAt: isoDateStringSchema.optional()
});

export const queryDefinitionInputSchema = queryDefinitionSchema.partial().extend({
  dateWindowDays: z.coerce.number().int().min(1).max(365).optional(),
  topX: z.coerce.number().int().min(1).max(50).optional(),
  minimumScore: z.coerce.number().int().min(0).max(100).optional()
});

export const queryRunSchema = z.object({
  id: z.string().min(1),
  queryDefinitionId: z.string().min(1),
  status: runStatusSchema,
  startedAt: isoDateStringSchema,
  completedAt: isoDateStringSchema.optional(),
  articlesFound: z.number().int().min(0),
  articlesSelected: z.number().int().min(0),
  errorMessage: z.string().optional()
});

export const retrievedArticleSchema = z.object({
  id: z.string().min(1),
  queryRunId: z.string().min(1),
  queryDefinitionId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  source: z.string().min(1),
  publishedAt: isoDateStringSchema,
  snippet: z.string(),
  relevanceScore: z.number().int().min(0).max(100),
  governanceThemes: z.array(z.string()),
  status: articleStatusSchema
});

export const blogDraftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string(),
  summary: z.string(),
  bodyMarkdown: z.string(),
  sourceArticleIds: z.array(z.string()),
  status: blogDraftStatusSchema,
  createdAt: isoDateStringSchema
});

export const emailCampaignSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  synopsisMarkdown: z.string(),
  blogDraftIds: z.array(z.string()),
  status: emailCampaignStatusSchema,
  createdAt: isoDateStringSchema
});

export const dashboardSnapshotSchema = z.object({
  queries: z.array(queryDefinitionSchema),
  recentRuns: z.array(queryRunSchema),
  recentArticles: z.array(retrievedArticleSchema),
  blogDrafts: z.array(blogDraftSchema),
  emailCampaigns: z.array(emailCampaignSchema)
});

export const updateArticleStatusInputSchema = z.object({
  status: articleStatusSchema
});
