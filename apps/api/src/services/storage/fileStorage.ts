import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { BlogDraft, EmailCampaign, QueryDefinition, QueryRun, RetrievedArticle } from "@pwio/shared";
import { seedQueries } from "../seed.js";
import type { Storage, Store } from "./storage.js";

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

export const fileStorage: Storage = {
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

  async upsertQuery(query: QueryDefinition) {
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

  async getQuery(id: string) {
    return readStore().queries.find((query) => query.id === id);
  },

  async addRun(run: QueryRun) {
    const store = readStore();
    store.runs.push(run);
    writeStore(store);
  },

  async updateRun(run: QueryRun) {
    const store = readStore();
    store.runs = store.runs.map((item) => (item.id === run.id ? run : item));
    writeStore(store);
  },

  async addArticles(articles: RetrievedArticle[]) {
    const store = readStore();
    const existingUrls = new Set(store.articles.map((article) => article.url));
    store.articles.push(...articles.filter((article) => !existingUrls.has(article.url)));
    writeStore(store);
  },

  async updateArticleStatus(id: string, status: RetrievedArticle["status"]) {
    const store = readStore();
    const article = store.articles.find((item) => item.id === id);

    if (!article) {
      return undefined;
    }

    article.status = status;
    writeStore(store);
    return article;
  },

  async addBlogDraft(blogDraft: BlogDraft) {
    const store = readStore();
    store.blogDrafts.push(blogDraft);
    writeStore(store);
  },

  async addEmailCampaign(emailCampaign: EmailCampaign) {
    const store = readStore();
    store.emailCampaigns.push(emailCampaign);
    writeStore(store);
  }
};
