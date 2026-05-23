import cors from "@fastify/cors";
import Fastify from "fastify";
import type { QueryDefinition } from "@pwio/shared";
import { v4 as uuid } from "uuid";
import { runQueryPipeline } from "./services/pipeline.js";
import { startScheduler } from "./services/scheduler.js";
import { storage } from "./services/storage.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});

app.get("/health", async () => ({ ok: true }));

app.get("/api/dashboard", async () => storage.snapshot());

app.get("/api/queries", async () => storage.listQueries());

app.post<{ Body: Partial<QueryDefinition> }>("/api/queries", async (request) => {
  const now = new Date().toISOString();

  const query: QueryDefinition = {
    id: request.body.id ?? uuid(),
    name: request.body.name ?? "Untitled query",
    description: request.body.description ?? "",
    baseQuery: request.body.baseQuery ?? "",
    includeTerms: request.body.includeTerms ?? [],
    excludeTerms: request.body.excludeTerms ?? [],
    targetDomains: request.body.targetDomains ?? [],
    dateWindowDays: request.body.dateWindowDays ?? 30,
    topX: request.body.topX ?? 5,
    minimumScore: request.body.minimumScore ?? 70,
    frequency: request.body.frequency ?? "manual",
    status: request.body.status ?? "enabled",
    governanceThemes: request.body.governanceThemes ?? [],
    createdAt: request.body.createdAt ?? now,
    updatedAt: now,
    lastRunAt: request.body.lastRunAt,
    nextRunAt: request.body.nextRunAt
  };

  return storage.upsertQuery(query);
});

app.post<{ Params: { id: string } }>("/api/queries/:id/run", async (request, reply) => {
  const query = storage.getQuery(request.params.id);

  if (!query) {
    return reply.code(404).send({ message: "Query not found" });
  }

  return runQueryPipeline(query);
});

startScheduler();

const port = Number(process.env.PORT ?? 3001);

await app.listen({ port, host: "0.0.0.0" });
