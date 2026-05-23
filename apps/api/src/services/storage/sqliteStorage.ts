import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { BlogDraft, EmailCampaign, QueryDefinition, QueryRun, RetrievedArticle } from "@pwio/shared";
import { seedQueries } from "../seed.js";
import type { Storage } from "./storage.js";

// Allow override via env var so the path can be changed without editing code.
const DB_PATH = process.env.SQLITE_DB_PATH ?? join(process.cwd(), "data", "intelligence-ops.db");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS query_definitions (
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
  );

  CREATE TABLE IF NOT EXISTS query_runs (
    id                    TEXT    PRIMARY KEY,
    query_definition_id   TEXT    NOT NULL,
    status                TEXT    NOT NULL,
    started_at            TEXT    NOT NULL,
    completed_at          TEXT,
    articles_found        INTEGER NOT NULL DEFAULT 0,
    articles_selected     INTEGER NOT NULL DEFAULT 0,
    error_message         TEXT
  );

  CREATE TABLE IF NOT EXISTS retrieved_articles (
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
  );

  CREATE TABLE IF NOT EXISTS blog_drafts (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    subtitle            TEXT NOT NULL DEFAULT '',
    summary             TEXT NOT NULL DEFAULT '',
    body_markdown       TEXT NOT NULL DEFAULT '',
    source_article_ids  TEXT NOT NULL DEFAULT '[]',
    status              TEXT NOT NULL DEFAULT 'draft',
    created_at          TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS email_campaigns (
    id                  TEXT PRIMARY KEY,
    subject             TEXT NOT NULL,
    synopsis_markdown   TEXT NOT NULL DEFAULT '',
    blog_draft_ids      TEXT NOT NULL DEFAULT '[]',
    status              TEXT NOT NULL DEFAULT 'draft',
    created_at          TEXT NOT NULL
  );
`;

// ---------------------------------------------------------------------------
// Row mappers — arrays are stored as JSON text in SQLite
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function rowToQueryDefinition(row: Row): QueryDefinition {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    baseQuery: String(row.base_query),
    includeTerms: parseJsonArray(row.include_terms),
    excludeTerms: parseJsonArray(row.exclude_terms),
    targetDomains: parseJsonArray(row.target_domains),
    dateWindowDays: Number(row.date_window_days),
    topX: Number(row.top_x),
    minimumScore: Number(row.minimum_score),
    frequency: row.frequency as QueryDefinition["frequency"],
    status: row.status as QueryDefinition["status"],
    governanceThemes: parseJsonArray(row.governance_themes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : undefined,
    nextRunAt: row.next_run_at ? String(row.next_run_at) : undefined
  };
}

function rowToQueryRun(row: Row): QueryRun {
  return {
    id: String(row.id),
    queryDefinitionId: String(row.query_definition_id),
    status: row.status as QueryRun["status"],
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    articlesFound: Number(row.articles_found),
    articlesSelected: Number(row.articles_selected),
    errorMessage: row.error_message ? String(row.error_message) : undefined
  };
}

function rowToRetrievedArticle(row: Row): RetrievedArticle {
  return {
    id: String(row.id),
    queryRunId: String(row.query_run_id),
    queryDefinitionId: String(row.query_definition_id),
    title: String(row.title),
    url: String(row.url),
    source: String(row.source),
    publishedAt: String(row.published_at),
    snippet: String(row.snippet ?? ""),
    relevanceScore: Number(row.relevance_score),
    governanceThemes: parseJsonArray(row.governance_themes),
    status: row.status as RetrievedArticle["status"]
  };
}

function rowToBlogDraft(row: Row): BlogDraft {
  return {
    id: String(row.id),
    title: String(row.title),
    subtitle: String(row.subtitle ?? ""),
    summary: String(row.summary ?? ""),
    bodyMarkdown: String(row.body_markdown ?? ""),
    sourceArticleIds: parseJsonArray(row.source_article_ids),
    status: row.status as BlogDraft["status"],
    createdAt: String(row.created_at)
  };
}

function rowToEmailCampaign(row: Row): EmailCampaign {
  return {
    id: String(row.id),
    subject: String(row.subject),
    synopsisMarkdown: String(row.synopsis_markdown ?? ""),
    blogDraftIds: parseJsonArray(row.blog_draft_ids),
    status: row.status as EmailCampaign["status"],
    createdAt: String(row.created_at)
  };
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

function applySchema(db: Database.Database): void {
  db.exec(SCHEMA);
}

function seedIfEmpty(db: Database.Database): void {
  const row = db.prepare("SELECT COUNT(*) AS count FROM query_definitions").get() as { count: number };

  if (row.count > 0) return;

  const insert = db.prepare(`
    INSERT INTO query_definitions (
      id, name, description, base_query,
      include_terms, exclude_terms, target_domains, governance_themes,
      date_window_days, top_x, minimum_score, frequency, status,
      created_at, updated_at, last_run_at, next_run_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction(() => {
    for (const query of seedQueries) {
      insert.run(
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
      );
    }
  });

  insertAll();
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSqliteStorage(): Storage {
  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  applySchema(db);
  seedIfEmpty(db);

  // Prepared statements — defined once and reused for performance.
  const stmts = {
    listQueries: db.prepare("SELECT * FROM query_definitions ORDER BY name"),
    getQuery: db.prepare("SELECT * FROM query_definitions WHERE id = ?"),
    upsertQuery: db.prepare(`
      INSERT INTO query_definitions (
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
        next_run_at       = excluded.next_run_at
    `),

    insertRun: db.prepare(`
      INSERT OR IGNORE INTO query_runs (
        id, query_definition_id, status, started_at, completed_at,
        articles_found, articles_selected, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateRun: db.prepare(`
      UPDATE query_runs
      SET status            = ?,
          completed_at      = ?,
          articles_found    = ?,
          articles_selected = ?,
          error_message     = ?
      WHERE id = ?
    `),
    recentRuns: db.prepare("SELECT * FROM query_runs ORDER BY started_at DESC LIMIT 20"),

    insertArticle: db.prepare(`
      INSERT OR IGNORE INTO retrieved_articles (
        id, query_run_id, query_definition_id, title, url, source,
        published_at, snippet, relevance_score, governance_themes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateArticleStatus: db.prepare("UPDATE retrieved_articles SET status = ? WHERE id = ?"),
    getArticle: db.prepare("SELECT * FROM retrieved_articles WHERE id = ?"),
    recentArticles: db.prepare("SELECT * FROM retrieved_articles ORDER BY created_at DESC LIMIT 50"),

    insertBlogDraft: db.prepare(`
      INSERT OR IGNORE INTO blog_drafts (
        id, title, subtitle, summary, body_markdown, source_article_ids, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    recentBlogDrafts: db.prepare("SELECT * FROM blog_drafts ORDER BY created_at DESC LIMIT 20"),

    insertEmailCampaign: db.prepare(`
      INSERT OR IGNORE INTO email_campaigns (
        id, subject, synopsis_markdown, blog_draft_ids, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `),
    recentEmailCampaigns: db.prepare("SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT 20")
  };

  return {
    async snapshot() {
      return Promise.resolve({
        queries: (stmts.listQueries.all() as Row[]).map(rowToQueryDefinition),
        recentRuns: (stmts.recentRuns.all() as Row[]).map(rowToQueryRun),
        recentArticles: (stmts.recentArticles.all() as Row[]).map(rowToRetrievedArticle),
        blogDrafts: (stmts.recentBlogDrafts.all() as Row[]).map(rowToBlogDraft),
        emailCampaigns: (stmts.recentEmailCampaigns.all() as Row[]).map(rowToEmailCampaign)
      });
    },

    async listQueries() {
      return Promise.resolve((stmts.listQueries.all() as Row[]).map(rowToQueryDefinition));
    },

    async upsertQuery(query) {
      const now = new Date().toISOString();
      stmts.upsertQuery.run(
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
      );
      return Promise.resolve({ ...query, updatedAt: now });
    },

    async getQuery(id) {
      const row = stmts.getQuery.get(id) as Row | undefined;
      return Promise.resolve(row ? rowToQueryDefinition(row) : undefined);
    },

    async addRun(run) {
      stmts.insertRun.run(
        run.id,
        run.queryDefinitionId,
        run.status,
        run.startedAt,
        run.completedAt ?? null,
        run.articlesFound,
        run.articlesSelected,
        run.errorMessage ?? null
      );
      return Promise.resolve();
    },

    async updateRun(run) {
      stmts.updateRun.run(
        run.status,
        run.completedAt ?? null,
        run.articlesFound,
        run.articlesSelected,
        run.errorMessage ?? null,
        run.id
      );
      return Promise.resolve();
    },

    async addArticles(articles) {
      const insertAll = db.transaction(() => {
        for (const article of articles) {
          stmts.insertArticle.run(
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
          );
        }
      });
      insertAll();
      return Promise.resolve();
    },

    async updateArticleStatus(id, status) {
      stmts.updateArticleStatus.run(status, id);
      const row = stmts.getArticle.get(id) as Row | undefined;
      return Promise.resolve(row ? rowToRetrievedArticle(row) : undefined);
    },

    async addBlogDraft(blogDraft) {
      stmts.insertBlogDraft.run(
        blogDraft.id,
        blogDraft.title,
        blogDraft.subtitle,
        blogDraft.summary,
        blogDraft.bodyMarkdown,
        JSON.stringify(blogDraft.sourceArticleIds),
        blogDraft.status,
        blogDraft.createdAt
      );
      return Promise.resolve();
    },

    async addEmailCampaign(emailCampaign) {
      stmts.insertEmailCampaign.run(
        emailCampaign.id,
        emailCampaign.subject,
        emailCampaign.synopsisMarkdown,
        JSON.stringify(emailCampaign.blogDraftIds),
        emailCampaign.status,
        emailCampaign.createdAt
      );
      return Promise.resolve();
    }
  };
}
