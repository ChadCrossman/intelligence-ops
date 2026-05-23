import { createClient } from "@libsql/client";
import type { Client, Value } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BlogDraft, EmailCampaign, QueryDefinition, QueryRun, RetrievedArticle } from "@pwio/shared";
import { seedQueries } from "../seed.js";
import type { Storage } from "./storage.js";

// Allow override via env var so the path can be changed without editing code.
const DB_PATH = resolve(process.env.SQLITE_DB_PATH ?? "data/intelligence-ops.db");

// ---------------------------------------------------------------------------
// Schema — each statement is its own element so batch() can run them individually.
// ---------------------------------------------------------------------------

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS query_definitions (
    id                TEXT    PRIMARY KEY,
    name              TEXT    NOT NULL,
    description       TEXT    NOT NULL DEFAULT '',
    base_query        TEXT    NOT NULL,
    include_terms     TEXT    NOT NULL DEFAULT '[]',
    exclude_terms     TEXT    NOT NULL DEFAULT '[]',
    target_domains    TEXT    NOT NULL DEFAULT '[]',
    governance_themes TEXT    NOT NULL DEFAULT '[]',
    date_window_days  INTEGER NOT NULL DEFAULT 7,
    top_x             INTEGER NOT NULL DEFAULT 10,
    minimum_score     INTEGER NOT NULL DEFAULT 50,
    frequency         TEXT    NOT NULL DEFAULT 'manual',
    status            TEXT    NOT NULL DEFAULT 'enabled',
    created_at        TEXT    NOT NULL,
    updated_at        TEXT    NOT NULL,
    last_run_at       TEXT,
    next_run_at       TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS query_runs (
    id                    TEXT    PRIMARY KEY,
    query_definition_id   TEXT    NOT NULL,
    status                TEXT    NOT NULL,
    started_at            TEXT    NOT NULL,
    completed_at          TEXT,
    articles_found        INTEGER NOT NULL DEFAULT 0,
    articles_selected     INTEGER NOT NULL DEFAULT 0,
    error_message         TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS retrieved_articles (
    id                    TEXT    PRIMARY KEY,
    query_run_id          TEXT    NOT NULL,
    query_definition_id   TEXT    NOT NULL,
    title                 TEXT    NOT NULL,
    url                   TEXT    NOT NULL UNIQUE,
    source                TEXT    NOT NULL,
    published_at          TEXT    NOT NULL,
    snippet               TEXT    NOT NULL DEFAULT '',
    relevance_score       INTEGER NOT NULL DEFAULT 0,
    governance_themes     TEXT    NOT NULL DEFAULT '[]',
    status                TEXT    NOT NULL DEFAULT 'new',
    created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE TABLE IF NOT EXISTS blog_drafts (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    subtitle            TEXT NOT NULL DEFAULT '',
    summary             TEXT NOT NULL DEFAULT '',
    body_markdown       TEXT NOT NULL DEFAULT '',
    source_article_ids  TEXT NOT NULL DEFAULT '[]',
    status              TEXT NOT NULL DEFAULT 'draft',
    created_at          TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS email_campaigns (
    id                  TEXT PRIMARY KEY,
    subject             TEXT NOT NULL,
    synopsis_markdown   TEXT NOT NULL DEFAULT '',
    blog_draft_ids      TEXT NOT NULL DEFAULT '[]',
    status              TEXT NOT NULL DEFAULT 'draft',
    created_at          TEXT NOT NULL
  )`
];

// ---------------------------------------------------------------------------
// Row mappers — arrays are stored as JSON text in SQLite
// ---------------------------------------------------------------------------

type Row = Record<string, Value>;

function parseJsonArray(value: Value): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function str(value: Value): string {
  return value == null ? "" : String(value);
}

function rowToQueryDefinition(row: Row): QueryDefinition {
  return {
    id: str(row.id),
    name: str(row.name),
    description: str(row.description),
    baseQuery: str(row.base_query),
    includeTerms: parseJsonArray(row.include_terms),
    excludeTerms: parseJsonArray(row.exclude_terms),
    targetDomains: parseJsonArray(row.target_domains),
    dateWindowDays: Number(row.date_window_days),
    topX: Number(row.top_x),
    minimumScore: Number(row.minimum_score),
    frequency: str(row.frequency) as QueryDefinition["frequency"],
    status: str(row.status) as QueryDefinition["status"],
    governanceThemes: parseJsonArray(row.governance_themes),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    lastRunAt: row.last_run_at != null ? str(row.last_run_at) : undefined,
    nextRunAt: row.next_run_at != null ? str(row.next_run_at) : undefined
  };
}

function rowToQueryRun(row: Row): QueryRun {
  return {
    id: str(row.id),
    queryDefinitionId: str(row.query_definition_id),
    status: str(row.status) as QueryRun["status"],
    startedAt: str(row.started_at),
    completedAt: row.completed_at != null ? str(row.completed_at) : undefined,
    articlesFound: Number(row.articles_found),
    articlesSelected: Number(row.articles_selected),
    errorMessage: row.error_message != null ? str(row.error_message) : undefined
  };
}

function rowToRetrievedArticle(row: Row): RetrievedArticle {
  return {
    id: str(row.id),
    queryRunId: str(row.query_run_id),
    queryDefinitionId: str(row.query_definition_id),
    title: str(row.title),
    url: str(row.url),
    source: str(row.source),
    publishedAt: str(row.published_at),
    snippet: str(row.snippet),
    relevanceScore: Number(row.relevance_score),
    governanceThemes: parseJsonArray(row.governance_themes),
    status: str(row.status) as RetrievedArticle["status"]
  };
}

function rowToBlogDraft(row: Row): BlogDraft {
  return {
    id: str(row.id),
    title: str(row.title),
    subtitle: str(row.subtitle),
    summary: str(row.summary),
    bodyMarkdown: str(row.body_markdown),
    sourceArticleIds: parseJsonArray(row.source_article_ids),
    status: str(row.status) as BlogDraft["status"],
    createdAt: str(row.created_at)
  };
}

function rowToEmailCampaign(row: Row): EmailCampaign {
  return {
    id: str(row.id),
    subject: str(row.subject),
    synopsisMarkdown: str(row.synopsis_markdown),
    blogDraftIds: parseJsonArray(row.blog_draft_ids),
    status: str(row.status) as EmailCampaign["status"],
    createdAt: str(row.created_at)
  };
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

async function applySchema(db: Client): Promise<void> {
  await db.batch(
    SCHEMA_STATEMENTS.map((sql) => ({ sql })),
    "write"
  );
}

async function seedIfEmpty(db: Client): Promise<void> {
  const result = await db.execute("SELECT COUNT(*) AS count FROM query_definitions");
  const count = Number(result.rows[0]?.count ?? 0);
  if (count > 0) return;

  await db.batch(
    seedQueries.map((query) => ({
      sql: `INSERT INTO query_definitions (
              id, name, description, base_query,
              include_terms, exclude_terms, target_domains, governance_themes,
              date_window_days, top_x, minimum_score, frequency, status,
              created_at, updated_at, last_run_at, next_run_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        query.id,
        query.name,
        query.description,
        query.baseQuery,
        JSON.stringify(query.includeTerms),
        JSON.stringify(query.excludeTerms),
        JSON.stringify(query.targetDomains),
        JSON.stringify(query.governanceThemes),
        query.dateWindowDays,
        query.topX,
        query.minimumScore,
        query.frequency,
        query.status,
        query.createdAt,
        query.updatedAt,
        query.lastRunAt ?? null,
        query.nextRunAt ?? null
      ]
    })),
    "write"
  );
}

// ---------------------------------------------------------------------------
// Factory — async because schema initialisation requires await
// ---------------------------------------------------------------------------

export async function createSqliteStorage(): Promise<Storage> {
  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = createClient({ url: `file:${DB_PATH}` });

  await applySchema(db);
  await seedIfEmpty(db);

  return {
    async snapshot() {
      const [queries, runs, articles, blogDrafts, emailCampaigns] = await Promise.all([
        db.execute("SELECT * FROM query_definitions ORDER BY name"),
        db.execute("SELECT * FROM query_runs ORDER BY started_at DESC LIMIT 20"),
        db.execute("SELECT * FROM retrieved_articles ORDER BY created_at DESC LIMIT 50"),
        db.execute("SELECT * FROM blog_drafts ORDER BY created_at DESC LIMIT 20"),
        db.execute("SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT 20")
      ]);

      return {
        queries: (queries.rows as Row[]).map(rowToQueryDefinition),
        recentRuns: (runs.rows as Row[]).map(rowToQueryRun),
        recentArticles: (articles.rows as Row[]).map(rowToRetrievedArticle),
        blogDrafts: (blogDrafts.rows as Row[]).map(rowToBlogDraft),
        emailCampaigns: (emailCampaigns.rows as Row[]).map(rowToEmailCampaign)
      };
    },

    async listQueries() {
      const result = await db.execute("SELECT * FROM query_definitions ORDER BY name");
      return (result.rows as Row[]).map(rowToQueryDefinition);
    },

    async upsertQuery(query) {
      const now = new Date().toISOString();
      await db.execute({
        sql: `INSERT INTO query_definitions (
                id, name, description, base_query,
                include_terms, exclude_terms, target_domains, governance_themes,
                date_window_days, top_x, minimum_score, frequency, status,
                created_at, updated_at, last_run_at, next_run_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT (id) DO UPDATE SET
                name              = excluded.name,
                description       = excluded.description,
                base_query        = excluded.base_query,
                include_terms     = excluded.include_terms,
                exclude_terms     = excluded.exclude_terms,
                target_domains    = excluded.target_domains,
                governance_themes = excluded.governance_themes,
                date_window_days  = excluded.date_window_days,
                top_x             = excluded.top_x,
                minimum_score     = excluded.minimum_score,
                frequency         = excluded.frequency,
                status            = excluded.status,
                updated_at        = excluded.updated_at,
                last_run_at       = excluded.last_run_at,
                next_run_at       = excluded.next_run_at`,
        args: [
          query.id,
          query.name,
          query.description,
          query.baseQuery,
          JSON.stringify(query.includeTerms),
          JSON.stringify(query.excludeTerms),
          JSON.stringify(query.targetDomains),
          JSON.stringify(query.governanceThemes),
          query.dateWindowDays,
          query.topX,
          query.minimumScore,
          query.frequency,
          query.status,
          query.createdAt,
          now,
          query.lastRunAt ?? null,
          query.nextRunAt ?? null
        ]
      });
      return { ...query, updatedAt: now };
    },

    async getQuery(id) {
      const result = await db.execute({ sql: "SELECT * FROM query_definitions WHERE id = ?", args: [id] });
      const row = result.rows[0] as Row | undefined;
      return row ? rowToQueryDefinition(row) : undefined;
    },

    async addRun(run) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO query_runs (
                id, query_definition_id, status, started_at, completed_at,
                articles_found, articles_selected, error_message
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          run.id,
          run.queryDefinitionId,
          run.status,
          run.startedAt,
          run.completedAt ?? null,
          run.articlesFound,
          run.articlesSelected,
          run.errorMessage ?? null
        ]
      });
    },

    async updateRun(run) {
      await db.execute({
        sql: `UPDATE query_runs
              SET status            = ?,
                  completed_at      = ?,
                  articles_found    = ?,
                  articles_selected = ?,
                  error_message     = ?
              WHERE id = ?`,
        args: [
          run.status,
          run.completedAt ?? null,
          run.articlesFound,
          run.articlesSelected,
          run.errorMessage ?? null,
          run.id
        ]
      });
    },

    async addArticles(articles) {
      if (articles.length === 0) return;

      await db.batch(
        articles.map((article) => ({
          sql: `INSERT OR IGNORE INTO retrieved_articles (
                  id, query_run_id, query_definition_id, title, url, source,
                  published_at, snippet, relevance_score, governance_themes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            article.id,
            article.queryRunId,
            article.queryDefinitionId,
            article.title,
            article.url,
            article.source,
            article.publishedAt,
            article.snippet,
            article.relevanceScore,
            JSON.stringify(article.governanceThemes),
            article.status
          ]
        })),
        "write"
      );
    },

    async updateArticleStatus(id, status) {
      await db.execute({ sql: "UPDATE retrieved_articles SET status = ? WHERE id = ?", args: [status, id] });
      const result = await db.execute({ sql: "SELECT * FROM retrieved_articles WHERE id = ?", args: [id] });
      const row = result.rows[0] as Row | undefined;
      return row ? rowToRetrievedArticle(row) : undefined;
    },

    async addBlogDraft(blogDraft) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO blog_drafts (
                id, title, subtitle, summary, body_markdown, source_article_ids, status, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          blogDraft.id,
          blogDraft.title,
          blogDraft.subtitle,
          blogDraft.summary,
          blogDraft.bodyMarkdown,
          JSON.stringify(blogDraft.sourceArticleIds),
          blogDraft.status,
          blogDraft.createdAt
        ]
      });
    },

    async addEmailCampaign(emailCampaign) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO email_campaigns (
                id, subject, synopsis_markdown, blog_draft_ids, status, created_at
              ) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          emailCampaign.id,
          emailCampaign.subject,
          emailCampaign.synopsisMarkdown,
          JSON.stringify(emailCampaign.blogDraftIds),
          emailCampaign.status,
          emailCampaign.createdAt
        ]
      });
    }
  };
}
