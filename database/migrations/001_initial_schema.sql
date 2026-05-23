-- Migration: 001_initial_schema
-- Description: Initial Intelligence Ops schema for query scheduling, retrieved articles, and draft outputs.

CREATE SCHEMA IF NOT EXISTS ops;

CREATE OR REPLACE FUNCTION ops.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE ops.query_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_query TEXT NOT NULL,
  include_terms TEXT[] NOT NULL DEFAULT '{}',
  exclude_terms TEXT[] NOT NULL DEFAULT '{}',
  target_domains TEXT[] NOT NULL DEFAULT '{}',
  date_window_days INTEGER NOT NULL DEFAULT 30 CHECK (date_window_days BETWEEN 1 AND 365),
  top_x INTEGER NOT NULL DEFAULT 5 CHECK (top_x BETWEEN 1 AND 50),
  minimum_score INTEGER NOT NULL DEFAULT 70 CHECK (minimum_score BETWEEN 0 AND 100),
  frequency TEXT NOT NULL DEFAULT 'manual' CHECK (frequency IN ('manual', 'hourly', 'daily', 'weekly')),
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'paused')),
  governance_themes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ
);

CREATE TRIGGER update_query_definitions_updated_at
  BEFORE UPDATE ON ops.query_definitions
  FOR EACH ROW EXECUTE FUNCTION ops.update_updated_at_column();

CREATE TABLE ops.query_runs (
  id TEXT PRIMARY KEY,
  query_definition_id TEXT NOT NULL REFERENCES ops.query_definitions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  articles_found INTEGER NOT NULL DEFAULT 0 CHECK (articles_found >= 0),
  articles_selected INTEGER NOT NULL DEFAULT 0 CHECK (articles_selected >= 0),
  error_message TEXT
);

CREATE TABLE ops.retrieved_articles (
  id TEXT PRIMARY KEY,
  query_run_id TEXT NOT NULL REFERENCES ops.query_runs(id) ON DELETE CASCADE,
  query_definition_id TEXT NOT NULL REFERENCES ops.query_definitions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  snippet TEXT NOT NULL DEFAULT '',
  relevance_score INTEGER NOT NULL CHECK (relevance_score BETWEEN 0 AND 100),
  governance_themes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'rejected', 'selected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (url)
);

CREATE TRIGGER update_retrieved_articles_updated_at
  BEFORE UPDATE ON ops.retrieved_articles
  FOR EACH ROW EXECUTE FUNCTION ops.update_updated_at_column();

CREATE TABLE ops.blog_drafts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  body_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_blog_drafts_updated_at
  BEFORE UPDATE ON ops.blog_drafts
  FOR EACH ROW EXECUTE FUNCTION ops.update_updated_at_column();

CREATE TABLE ops.blog_draft_articles (
  blog_draft_id TEXT NOT NULL REFERENCES ops.blog_drafts(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL REFERENCES ops.retrieved_articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blog_draft_id, article_id)
);

CREATE TABLE ops.email_campaigns (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  synopsis_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'sent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON ops.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION ops.update_updated_at_column();

CREATE TABLE ops.email_campaign_blog_drafts (
  email_campaign_id TEXT NOT NULL REFERENCES ops.email_campaigns(id) ON DELETE CASCADE,
  blog_draft_id TEXT NOT NULL REFERENCES ops.blog_drafts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (email_campaign_id, blog_draft_id)
);

CREATE INDEX idx_query_definitions_status_frequency
  ON ops.query_definitions(status, frequency);

CREATE INDEX idx_query_runs_query_started
  ON ops.query_runs(query_definition_id, started_at DESC);

CREATE INDEX idx_query_runs_status
  ON ops.query_runs(status);

CREATE INDEX idx_retrieved_articles_query_status
  ON ops.retrieved_articles(query_definition_id, status);

CREATE INDEX idx_retrieved_articles_run
  ON ops.retrieved_articles(query_run_id);

CREATE INDEX idx_retrieved_articles_published
  ON ops.retrieved_articles(published_at DESC);

CREATE INDEX idx_retrieved_articles_relevance
  ON ops.retrieved_articles(relevance_score DESC);

CREATE INDEX idx_blog_draft_articles_article
  ON ops.blog_draft_articles(article_id);

CREATE INDEX idx_email_campaign_blog_drafts_blog_draft
  ON ops.email_campaign_blog_drafts(blog_draft_id);

INSERT INTO ops.query_definitions (
  id,
  name,
  description,
  base_query,
  include_terms,
  exclude_terms,
  target_domains,
  date_window_days,
  top_x,
  minimum_score,
  frequency,
  status,
  governance_themes
) VALUES
(
  'query-ai-governance',
  'AI Governance',
  'General enterprise AI governance, oversight, assurance, and controls.',
  '("AI governance" OR "generative AI governance" OR "enterprise AI governance") (compliance OR oversight OR controls OR assurance)',
  ARRAY['enterprise', 'governance', 'risk'],
  ARRAY['homework', 'students', 'image generator'],
  ARRAY['cio.com', 'forbes.com', 'nist.gov', 'europa.eu'],
  30,
  5,
  70,
  'daily',
  'enabled',
  ARRAY['AI operational governance', 'publication assurance']
),
(
  'query-semantic-drift',
  'Semantic Drift',
  'Meaning drift, inconsistency, hallucination risk, and output reliability.',
  '("AI semantic drift" OR "meaning drift" OR "AI output reliability" OR "AI inconsistency")',
  ARRAY['traceability', 'validation', 'provenance'],
  ARRAY['school', 'essay'],
  ARRAY['venturebeat.com', 'wired.com', 'mit.edu', 'arxiv.org'],
  56,
  5,
  65,
  'weekly',
  'enabled',
  ARRAY['semantic governance', 'provenance']
)
ON CONFLICT (id) DO NOTHING;
