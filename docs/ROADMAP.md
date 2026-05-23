# Intelligence Ops — Roadmap and Technical Debt

Items in this file are removed when implemented.

---

## Ingestion and feed infrastructure

### Pending feed URL verification

Confirm each URL returns a valid RSS/Atom feed, then move it into `.env.local`.

```sh
# Quick check — look for <rss or <feed at the top of the response
curl -s <URL> | head -5
```

| Feed | Candidate URL | Target env var |
|---|---|---|
| xAI | `https://x.ai/news/rss.xml` | `RSS_SOURCE_URLS` |
| Apple ML | `https://machinelearning.apple.com/feed/` | `RSS_SOURCE_URLS` |
| UK DSIT / AI Safety Institute | Not yet found | `REGULATORY_FEED_URLS` |
| US White House / AI policy | Not yet found | `REGULATORY_FEED_URLS` |
| Ben's Bites | Check `https://bensbites.co` | `VENDOR_BLOG_FEED_URLS` |
| TLDR AI | Check `https://tldr.tech/ai` | `VENDOR_BLOG_FEED_URLS` |
| Hacker News AI | `https://rsshub.app/hackernews/label/ai` (unconfirmed) | `VENDOR_BLOG_FEED_URLS` |
| Reddit r/LocalLLaMA | RSS generator required | `VENDOR_BLOG_FEED_URLS` |

### HTTP caching on feed fetches

`fetchText` in `providers/httpClient.ts` makes unconditional GET requests.
Feeds that return `ETag` or `Last-Modified` headers can skip transfer when unchanged.

- Add an in-memory (or Redis) cache keyed on feed URL storing `ETag` / `Last-Modified`.
- On subsequent requests set `If-None-Match` / `If-Modified-Since` headers.
- Return cached content on `304 Not Modified` without re-parsing.
- Respect `Cache-Control: max-age` and `ttl` / `updatePeriod` from feed metadata to avoid polling faster than the feed publisher intends.

### Per-host rate limiting

Feed providers have implicit or explicit rate limits.
Currently all providers fire concurrently with no throttling.

- Track request timestamps per hostname.
- Apply a minimum interval per host (configurable, default 60 s).
- Queue requests that would exceed the limit rather than dropping them.

### robots.txt compliance

`fetchText` does not check `robots.txt` before fetching.

- Cache parsed `robots.txt` per hostname.
- Skip fetching feed URLs that disallow the `PublishWeaver-IntelligenceOps` agent.
- Log skipped URLs so feed config can be updated.

### Store raw feed items separately from processed content

`retrieved_articles` mixes pipeline-scored articles with raw feed items.
Raw items are discarded if they fall below `minimumScore`, with no way to re-evaluate them later.

- Add a `raw_feed_items` table (or collection in the file store) that stores every ingested item before scoring.
- Run scoring and filtering as a separate pass against raw items.
- Enables retroactive re-scoring when query parameters or scoring weights change.

### Content-hash deduplication for syndicated articles

`addArticles` deduplicates by URL only.
The same article syndicated across multiple feeds (e.g. a Google Research post appearing in both
`RSS_SOURCE_URLS` and `GOVERNANCE_BLOG_FEED_URLS`) is currently stored once by URL, but feeds
that republish content at different URLs (e.g. Medium mirrors) create duplicates.

- Compute a normalised content hash from `title + snippet` (lowercased, punctuation-stripped).
- Reject inserts where a matching hash already exists for the same `queryRunId`.

---

## Scoring and filtering

### Source authority weighting

`scoreArticle` treats all sources equally.
A result from `nist.gov` and one from a personal blog score identically on domain match.

- Maintain a tiered source authority list (e.g. tier 1: government/standards bodies,
  tier 2: established research institutions, tier 3: general tech press).
- Apply a multiplier to `relevanceScore` based on tier.

### Auto-tagging by topic category

Articles are stored with `governanceThemes` from the query definition only.
There is no per-article categorisation.

- After scoring, classify each article into one or more topic tags:
  `regulation`, `model-release`, `safety-research`, `industry`, `tooling`, `policy`.
- Use keyword heuristics initially; replace with a lightweight classifier when volume justifies it.
- Expose tags as a filter in the Results Review UI.

### ML-based noise filtering

The current scorer is a linear heuristic with fixed weights.
It produces false positives (off-topic articles that hit include terms incidentally).

- Train or prompt a lightweight classifier (Claude Haiku or a local model) to give a
  binary `relevant / not relevant` judgement on title + snippet.
- Use classifier output as a gating step before the numeric scorer.
- Log classifier decisions for review so the model can be tuned.

---

## Blog and content generation

### AI-powered blog generation via Claude API

`generateBlogDraft` in `services/blogGenerator.ts` returns placeholder Markdown.
`generateEmailSynopsis` in `services/emailSynopsis.ts` similarly.

- Call the Claude API with the selected articles as context.
- Prompt structure:
  1. System: Publish Weaver voice, governance framing, attribution rules.
  2. User: Article titles, sources, snippets, governance themes from the query.
  3. Output: Title, subtitle, structured body Markdown with source citations.
- Accept `OPENAI_API_KEY` (already in `.env.local`) as a fallback provider.
- Keep the current placeholder as a fallback when no AI key is configured.

### Per-article "Generate Blog" action

Blog drafts are currently generated automatically for all selected articles at the end of
a pipeline run. There is no way to generate a draft for a single article from the review UI.

- Add a `POST /api/articles/:id/generate-blog` endpoint.
- Wire a "Generate Blog" button to each article card in `ResultsReview`.
- Reuse the AI generation logic from the item above.

### Source attribution with hyperlinks in generated content

`generateBlogDraft` lists sources as `- Title (source-name)` without links.

- Include the article URL in the Markdown list item:
  `- [Title](url) — source-name`.
- Ensure the AI generation prompt instructs the model to inline citations.

### Summarise articles before composing blog draft

Currently the full snippet is passed to the blog generator.
Snippets are truncated feed descriptions, not true summaries.

- Add a summarisation step: call Claude with each article's title + snippet to produce
  a 2–3 sentence summary.
- Pass summaries (not raw snippets) to the blog draft composer.
- Cache summaries in the article record to avoid re-generating on subsequent runs.

---

## Publish Weaver integration

### Export drafts directly to Publish Weaver

Blog drafts and email campaigns exist only inside Intelligence Ops.
There is no mechanism to push them into the Publish Weaver publishing pipeline.

- Define an export endpoint or shared-queue contract with Publish Weaver.
- Add an "Export to Publish Weaver" action on each `BlogDraft` in the UI.
- Track export status on the draft (`exported`, `export-failed`).

### Map generated content to Publish Weaver Canon sections (C1–C8)

Generated blogs do not reference the Publish Weaver Canon structure.

- After generation, run a classification pass to identify which Canon sections
  (C1–C8) the content addresses.
- Attach Canon section tags to the `BlogDraft` record.
- Use Canon section mapping as an additional quality gate before export.

### Governance compliance score on generated content

There is no automated quality check on generated drafts before they enter review.

- After AI generation, run a deterministic validation pass:
  - Source attribution present? (links, not just names)
  - Claim–source alignment? (every assertion has a cited article)
  - Prohibited terms / tone check from Canon rules.
- Store a `complianceScore` and any `complianceFlags` on the `BlogDraft` record.
- Surface warnings in the UI before a draft can be approved.

### Multi-channel governed extracts

The pipeline currently produces one blog draft and one email synopsis per run.
Publish Weaver supports multiple output channels (social, internal briefing, long-form, etc.).

- Define a `ChannelTemplate` concept: each template specifies tone, length, format, and
  applicable Canon sections.
- Generate one extract per configured channel from the same source articles.
- Store as separate records linked to the originating `BlogDraft`.

---

## Search and data

### Full-text search on stored articles

Articles are queryable only by status filter in the UI.
There is no free-text search across titles, snippets, or sources.

- Add `tsvector` columns to `ops.retrieved_articles` in Postgres.
- Expose a `GET /api/articles/search?q=` endpoint.
- Add a search input to the Results Review panel.
- For the file storage backend, filter in-memory using a simple string match.

### Historical feed archive and search

Currently only the 50 most recent articles are surfaced in the dashboard snapshot.
Older articles are stored but not accessible from the UI.

- Add pagination to `GET /api/articles` (cursor or offset-based).
- Add date-range and source filters.
- Add a dedicated archive view in the web app.

---

## Publish Weaver output push

### Push approved blog drafts to Publish Weaver

Approved blog drafts and email campaigns exist only inside Intelligence Ops.
There is no mechanism to push them to the Publish Weaver publishing pipeline.

Architecture — follow the same pattern as the Publish Weaver audit log (`auditSync.ts`):

- Add a `publishWeaverClient.ts` that `callLambda`-posts to the PW Lambda endpoint.
- When a `BlogDraft` moves to `approved` status, call the client to push the draft payload.
- Track push status on the draft: `pending_push` → `pushed` | `push_failed`.
- Add `PUBLISH_WEAVER_LAMBDA_URL` and `PUBLISH_WEAVER_API_KEY` to `.env.local`.
- Surface push status in the Results Review UI so operators know when a draft is live.

### Self-host RSSHub

Use a self-hosted RSSHub instance rather than the public `rsshub.app` endpoint.
The public instance is rate-limited and unreliable for production polling.

- Deploy as a Node.js process alongside the API (no Docker — local-first setup).
- Update all `rsshub.app/*` URLs in `.env.local` to point at `http://localhost:1200`.
- Reference: <https://docs.rsshub.app/deploy/>

---

## Infrastructure

### Reddit `r/MachineLearning` and `r/LocalLLaMA` via RSS generator

The Reddit provider queries configurable subreddits via the JSON API.
`r/LocalLLaMA` is not in the default `REDDIT_SUBREDDITS` list and contains high-signal
local model discussion not captured elsewhere.

- Add `LocalLLaMA` to the default subreddit list in `redditSearchProvider.ts`, or
- Configure `REDDIT_SUBREDDITS=artificial,MachineLearning,technology,LocalLLaMA` in `.env.local`.
