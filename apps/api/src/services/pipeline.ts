import { v4 as uuid } from "uuid";
import type { QueryDefinition, QueryRun, RetrievedArticle } from "@pwio/shared";
import { generateBlogDraft } from "./blogGenerator.js";
import { generateEmailSynopsis } from "./emailSynopsis.js";
import { scoreArticle } from "./scoring.js";
import { searchOrchestrator } from "./searchOrchestrator.js";
import { storage } from "./storage.js";

export async function runQueryPipeline(query: QueryDefinition): Promise<QueryRun> {
  const run: QueryRun = {
    id: uuid(),
    queryDefinitionId: query.id,
    status: "running",
    startedAt: new Date().toISOString(),
    articlesFound: 0,
    articlesSelected: 0
  };

  await storage.addRun(run);

  try {
    const results = await searchOrchestrator.execute(query);

    const articles: RetrievedArticle[] = results.map((result) => {
      const relevanceScore = scoreArticle(query, result);

      return {
        id: uuid(),
        queryRunId: run.id,
        queryDefinitionId: query.id,
        title: result.title,
        url: result.url,
        source: result.source,
        publishedAt: result.publishedAt,
        snippet: result.snippet,
        relevanceScore,
        governanceThemes: query.governanceThemes,
        status: relevanceScore >= query.minimumScore ? "selected" : "new"
      };
    });

    const selected = articles
      .filter((article) => article.relevanceScore >= query.minimumScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, query.topX);

    await storage.addArticles(articles);

    if (selected.length > 0) {
      const blogDraft = generateBlogDraft(selected);
      await storage.addBlogDraft(blogDraft);

      const emailCampaign = generateEmailSynopsis([blogDraft]);
      await storage.addEmailCampaign(emailCampaign);
    }

    const completed: QueryRun = {
      ...run,
      status: "success",
      completedAt: new Date().toISOString(),
      articlesFound: articles.length,
      articlesSelected: selected.length
    };

    await storage.updateRun(completed);
    return completed;
  } catch (error) {
    const failed: QueryRun = {
      ...run,
      status: "failed",
      completedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    };

    await storage.updateRun(failed);
    return failed;
  }
}
