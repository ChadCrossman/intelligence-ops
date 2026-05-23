import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import type { Pool as PgPool } from "pg";
import type {
  BlogDraft,
  DashboardSnapshot,
  EmailCampaign,
  QueryDefinition,
  QueryRun,
  RetrievedArticle
} from "@pwio/shared";
import { seedQueries } from "./seed.js";

const { Pool } = pg;

for (const envPath of [join(process.cwd(), "..", "..", ".env"), join(process.cwd(), "..", "..", ".env.local")]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

interface Store {
  queries: QueryDefinition[];
  runs: QueryRun[];
  articles: RetrievedArticle[];
  blogDrafts: BlogDraft[];
  emailCampaigns: EmailCampaign[];
}

interface Storage {
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

const dataFile = join(process.cwd(), "src", "data", "store.json");

function initialStore(): Store {
  return {
    queries: seedQueries,
    runs: [],
    articles: [],
    blogDrafts: [],
    emailCampaigns: []
  };
}

function ensureStore(): void {
  if (!existsSync(dirname(dataFile))) {
    mkdirSync(dirname(dataFile), { recursive: true });
  }

  if (!existsSync(dataFile)) {
    writeFileSync(dataFile, JSON.stringify(initialStore(), null, 2), "utf-8");
  }
}

function readStore(): Store {
  ensureStore();
  return JSON.parse(readFileSync(dataFile, "utf-8")) as Store;
}

function writeStore(store: Store): void {
  writeFileSync(dataFile, JSON.stringify(store, null, 2), "utf-8");
}

const fileStorage: Storage = {
  async snapshot() {
    const store = readStore();
    return {
      queries: store.queries,
      recentRuns: store.runs.slice(-20).reverse(),
      recentArticles: store.articles.slice(-50).reverse(),
      blogDrafts: store.blogDrafts.slice(-20).reverse(),
      emailCampaigns: store.emailCampaigns.slice(-20).reverse()
    };
  },

  async listQueries() {
    return readStore().queries;
  },

  async upsertQuery(query) {
    const store = readStore();
    const index = store.queries.findIndex((item) => item.id === query.id);
    const saved = { ...query, updatedAt: new Date().toISOString() };

    if (index >= 0) {
      store.queries[index] = saved;
    } else {
      store.queries.push(saved);
    }

    writeStore(store);
    return saved;
  },

  async getQuery(id) {
    return readStore().queries.find((query) => query.id === id);
  },

  async addRun(run) {
    const store = readStore();
    store.runs.push(run);
    writeStore(store);
  },

  async updateRun(run) {
    const store = readStore();
    store.runs = store.runs.map((item) => (item.id === run.id ? run : item));
    writeStore(store);
  },

  async addArticles(articles) {
    const store = readStore();
    const existingUrls = new Set(store.articles.map((article) => article.url));
    store.articles.push(...articles.filter((article) => !existingUrls.has(article.url)));
    writeStore(store);
  },

  async updateArticleStatus(id, status) {
    const store = readStore();
    const article = store.articles.find((item) => item.id === id);

    if (!article) {
      return undefined;
    }

    article.status = status;
    writeStore(store);
    return article;
  },

  async addBlogDraft(blogDraft) {
    const store = readStore();
    store.blogDrafts.push(blogDraft);
    writeStore(store);
  },

  async addEmailCampaign(emailCampaign) {
    const store = readStore();
    store.emailCampaigns.push(emailCampaign);
    writeStore(store);
  }
};

function databaseUrl(): string {
  return (
    process.env.INTELLIGENCE_OPS_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.LABELS_DATABASE_URL ||
    ""
  ).trim();
}

function createPool(): PgPool {
  const connectionString = databaseUrl();

  if (!connectionString) {
    throw new Error("STORAGE_PROVIDER=postgres requires INTELLIGENCE_OPS_DATABASE_URL.");
  }

  return new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=disable") ? false : undefined
  });
}

const pool = process.env.STORAGE_PROVIDER === "postgres" ? createPool() : undefined;

function toQueryDefinition(row: Record<string, unknown>): QueryDefinition {
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

function toQueryRun(row: Record<string, unknown>): QueryRun {
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

function toRetrievedArticle(row: Record<string, unknown>): RetrievedArticle {
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

function toBlogDraft(row: Record<string, unknown>): BlogDraft {
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

function toEmailCampaign(row: Record<string, unknown>): EmailCampaign {
  return {
    id: String(row.id),
    subject: String(row.subject),
    synopsisMarkdown: String(row.synopsis_markdown ?? ""),
    blogDraftIds: (row.blog_draft_ids ?? []) as string[],
    status: row.status as EmailCampaign["status"],
    createdAt: new Date(row.created_at as string).toISOString()
  };
}

const postgresStorage: Storage = {
  async snapshot() {
    const [queries, runs, articles, blogDrafts, emailCampaigns] = await Promise.all([
      this.listQueries(),
      pool!.query("SELECT * FROM ops.query_runs ORDER BY started_at DESC LIMIT 20"),
      pool!.query("SELECT * FROM ops.retrieved_articles ORDER BY created_at DESC LIMIT 50"),
      pool!.query(`
        SELECT blog_drafts.*, COALESCE(array_agg(blog_draft_articles.article_id) FILTER (WHERE blog_draft_articles.article_id IS NOT NULL), '{}') AS source_article_ids
        FROM ops.blog_drafts
        LEFT JOIN ops.blog_draft_articles ON blog_draft_articles.blog_draft_id = blog_drafts.id
        GROUP BY blog_drafts.id
        ORDER BY blog_drafts.created_at DESC
        LIMIT 20
      `),
      pool!.query(`
        SELECT email_campaigns.*, COALESCE(array_agg(email_campaign_blog_drafts.blog_draft_id) FILTER (WHERE email_campaign_blog_drafts.blog_draft_id IS NOT NULL), '{}') AS blog_draft_ids
        FROM ops.email_campaigns
        LEFT JOIN ops.email_campaign_blog_drafts ON email_campaign_blog_drafts.email_campaign_id = email_campaigns.id
        GROUP BY email_campaigns.id
        ORDER BY email_campaigns.created_at DESC
        LIMIT 20
      `)
    ]);

    return {
      queries,
      recentRuns: runs.rows.map(toQueryRun),
      recentArticles: articles.rows.map(toRetrievedArticle),
      blogDrafts: blogDrafts.rows.map(toBlogDraft),
      emailCampaigns: emailCampaigns.rows.map(toEmailCampaign)
    };
  },

  async listQueries() {
    const result = await pool!.query("SELECT * FROM ops.query_definitions ORDER BY name");
    return result.rows.map(toQueryDefinition);
  },

  async upsertQuery(query) {
    const result = await pool!.query(
      `
      INSERT INTO ops.query_definitions (
        id, name, description, base_query, include_terms, exclude_terms, target_domains,
        date_window_days, top_x, minimum_score, frequency, status, governance_themes,
        created_at, updated_at, last_run_at, next_run_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        base_query = EXCLUDED.base_query,
        include_terms = EXCLUDED.include_terms,
        exclude_terms = EXCLUDED.exclude_terms,
        target_domains = EXCLUDED.target_domains,
        date_window_days = EXCLUDED.date_window_days,
        top_x = EXCLUDED.top_x,
        minimum_score = EXCLUDED.minimum_score,
        frequency = EXCLUDED.frequency,
        status = EXCLUDED.status,
        governance_themes = EXCLUDED.governance_themes,
        last_run_at = EXCLUDED.last_run_at,
        next_run_at = EXCLUDED.next_run_at
      RETURNING *
      `,
      [
        query.id,
        query.name,
        query.description,
        query.baseQuery,
        query.includeTerms,
        query.excludeTerms,
        query.targetDomains,
        query.dateWindowDays,
        query.topX,
        query.minimumScore,
        query.frequency,
        query.status,
        query.governanceThemes,
        query.createdAt,
        query.lastRunAt,
        query.nextRunAt
      ]
    );

    return toQueryDefinition(result.rows[0]);
  },

  async getQuery(id) {
    const result = await pool!.query("SELECT * FROM ops.query_definitions WHERE id = $1", [id]);
    return result.rows[0] ? toQueryDefinition(result.rows[0]) : undefined;
  },

  async addRun(run) {
    await pool!.query(
      `
      INSERT INTO ops.query_runs (
        id, query_definition_id, status, started_at, completed_at, articles_found, articles_selected, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        run.id,
        run.queryDefinitionId,
        run.status,
        run.startedAt,
        run.completedAt,
        run.articlesFound,
        run.articlesSelected,
        run.errorMessage
      ]
    );
  },

  async updateRun(run) {
    await pool!.query(
      `
      UPDATE ops.query_runs
      SET status = $2,
          completed_at = $3,
          articles_found = $4,
          articles_selected = $5,
          error_message = $6
      WHERE id = $1
      `,
      [run.id, run.status, run.completedAt, run.articlesFound, run.articlesSelected, run.errorMessage]
    );
  },

  async addArticles(articles) {
    for (const article of articles) {
      await pool!.query(
        `
        INSERT INTO ops.retrieved_articles (
          id, query_run_id, query_definition_id, title, url, source, published_at,
          snippet, relevance_score, governance_themes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (url) DO NOTHING
        `,
        [
          article.id,
          article.queryRunId,
          article.queryDefinitionId,
          article.title,
          article.url,
          article.source,
          article.publishedAt,
          article.snippet,
          article.relevanceScore,
          article.governanceThemes,
          article.status
        ]
      );
    }
  },

  async updateArticleStatus(id, status) {
    const result = await pool!.query("UPDATE ops.retrieved_articles SET status = $2 WHERE id = $1 RETURNING *", [id, status]);
    return result.rows[0] ? toRetrievedArticle(result.rows[0]) : undefined;
  },

  async addBlogDraft(blogDraft) {
    await pool!.query(
      `
      INSERT INTO ops.blog_drafts (id, title, subtitle, summary, body_markdown, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING
      `,
      [blogDraft.id, blogDraft.title, blogDraft.subtitle, blogDraft.summary, blogDraft.bodyMarkdown, blogDraft.status, blogDraft.createdAt]
    );

    for (const articleId of blogDraft.sourceArticleIds) {
      await pool!.query(
        "INSERT INTO ops.blog_draft_articles (blog_draft_id, article_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [blogDraft.id, articleId]
      );
    }
  },

  async addEmailCampaign(emailCampaign) {
    await pool!.query(
      `
      INSERT INTO ops.email_campaigns (id, subject, synopsis_markdown, status, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
      `,
      [emailCampaign.id, emailCampaign.subject, emailCampaign.synopsisMarkdown, emailCampaign.status, emailCampaign.createdAt]
    );

    for (const blogDraftId of emailCampaign.blogDraftIds) {
      await pool!.query(
        "INSERT INTO ops.email_campaign_blog_drafts (email_campaign_id, blog_draft_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [emailCampaign.id, blogDraftId]
      );
    }
  }
};

export const storage: Storage = process.env.STORAGE_PROVIDER === "postgres" ? postgresStorage : fileStorage;
