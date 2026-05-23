import type { Pool as PgPool } from "pg";
import type { QueryDefinition } from "@pwio/shared";
import { toBlogDraft, toEmailCampaign, toQueryDefinition, toQueryRun, toRetrievedArticle } from "./postgresRowMappers.js";
import type { Storage } from "./storage.js";

export function createPostgresStorage(pool: PgPool): Storage {
  // Local helper used by both snapshot() and listQueries() to avoid `this` binding.
  async function fetchQueryDefinitions(): Promise<QueryDefinition[]> {
    const result = await pool.query("SELECT * FROM ops.query_definitions ORDER BY name");
    return result.rows.map(toQueryDefinition);
  }

  return {
    async snapshot() {
      const [queries, runs, articles, blogDrafts, emailCampaigns] = await Promise.all([
        fetchQueryDefinitions(),
        pool.query("SELECT * FROM ops.query_runs ORDER BY started_at DESC LIMIT 20"),
        pool.query("SELECT * FROM ops.retrieved_articles ORDER BY created_at DESC LIMIT 50"),
        pool.query(`
          SELECT blog_drafts.*, COALESCE(array_agg(blog_draft_articles.article_id) FILTER (WHERE blog_draft_articles.article_id IS NOT NULL), '{}') AS source_article_ids
          FROM ops.blog_drafts
          LEFT JOIN ops.blog_draft_articles ON blog_draft_articles.blog_draft_id = blog_drafts.id
          GROUP BY blog_drafts.id
          ORDER BY blog_drafts.created_at DESC
          LIMIT 20
        `),
        pool.query(`
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

    listQueries: fetchQueryDefinitions,

    async upsertQuery(query) {
      const result = await pool.query(
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
      const result = await pool.query("SELECT * FROM ops.query_definitions WHERE id = $1", [id]);
      return result.rows[0] ? toQueryDefinition(result.rows[0]) : undefined;
    },

    async addRun(run) {
      await pool.query(
        `
        INSERT INTO ops.query_runs (
          id, query_definition_id, status, started_at, completed_at,
          articles_found, articles_selected, error_message
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
      await pool.query(
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
        await pool.query(
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
      const result = await pool.query(
        "UPDATE ops.retrieved_articles SET status = $2 WHERE id = $1 RETURNING *",
        [id, status]
      );
      return result.rows[0] ? toRetrievedArticle(result.rows[0]) : undefined;
    },

    async addBlogDraft(blogDraft) {
      await pool.query(
        `
        INSERT INTO ops.blog_drafts (id, title, subtitle, summary, body_markdown, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
        `,
        [
          blogDraft.id,
          blogDraft.title,
          blogDraft.subtitle,
          blogDraft.summary,
          blogDraft.bodyMarkdown,
          blogDraft.status,
          blogDraft.createdAt
        ]
      );

      for (const articleId of blogDraft.sourceArticleIds) {
        await pool.query(
          "INSERT INTO ops.blog_draft_articles (blog_draft_id, article_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [blogDraft.id, articleId]
        );
      }
    },

    async addEmailCampaign(emailCampaign) {
      await pool.query(
        `
        INSERT INTO ops.email_campaigns (id, subject, synopsis_markdown, status, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
        `,
        [
          emailCampaign.id,
          emailCampaign.subject,
          emailCampaign.synopsisMarkdown,
          emailCampaign.status,
          emailCampaign.createdAt
        ]
      );

      for (const blogDraftId of emailCampaign.blogDraftIds) {
        await pool.query(
          "INSERT INTO ops.email_campaign_blog_drafts (email_campaign_id, blog_draft_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [emailCampaign.id, blogDraftId]
        );
      }
    }
  };
}
