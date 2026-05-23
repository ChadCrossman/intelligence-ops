import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  BlogDraft,
  DashboardSnapshot,
  EmailCampaign,
  QueryDefinition,
  QueryRun,
  RetrievedArticle
} from "@pwio/shared";
import { seedQueries } from "./seed.js";

interface Store {
  queries: QueryDefinition[];
  runs: QueryRun[];
  articles: RetrievedArticle[];
  blogDrafts: BlogDraft[];
  emailCampaigns: EmailCampaign[];
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

export const storage = {
  snapshot(): DashboardSnapshot {
    const store = readStore();
    return {
      queries: store.queries,
      recentRuns: store.runs.slice(-20).reverse(),
      recentArticles: store.articles.slice(-50).reverse(),
      blogDrafts: store.blogDrafts.slice(-20).reverse(),
      emailCampaigns: store.emailCampaigns.slice(-20).reverse()
    };
  },

  listQueries(): QueryDefinition[] {
    return readStore().queries;
  },

  upsertQuery(query: QueryDefinition): QueryDefinition {
    const store = readStore();
    const index = store.queries.findIndex((item) => item.id === query.id);

    const saved = {
      ...query,
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) {
      store.queries[index] = saved;
    } else {
      store.queries.push(saved);
    }

    writeStore(store);
    return saved;
  },

  getQuery(id: string): QueryDefinition | undefined {
    return readStore().queries.find((query) => query.id === id);
  },

  addRun(run: QueryRun): void {
    const store = readStore();
    store.runs.push(run);
    writeStore(store);
  },

  updateRun(run: QueryRun): void {
    const store = readStore();
    store.runs = store.runs.map((item) => (item.id === run.id ? run : item));
    writeStore(store);
  },

  addArticles(articles: RetrievedArticle[]): void {
    const store = readStore();
    const existingUrls = new Set(store.articles.map((article) => article.url));
    store.articles.push(...articles.filter((article) => !existingUrls.has(article.url)));
    writeStore(store);
  },

  updateArticleStatus(id: string, status: RetrievedArticle["status"]): RetrievedArticle | undefined {
    const store = readStore();
    const article = store.articles.find((item) => item.id === id);

    if (!article) {
      return undefined;
    }

    article.status = status;
    writeStore(store);
    return article;
  },

  addBlogDraft(blogDraft: BlogDraft): void {
    const store = readStore();
    store.blogDrafts.push(blogDraft);
    writeStore(store);
  },

  addEmailCampaign(emailCampaign: EmailCampaign): void {
    const store = readStore();
    store.emailCampaigns.push(emailCampaign);
    writeStore(store);
  }
};
