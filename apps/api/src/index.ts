import cors from "@fastify/cors";
import Fastify from "fastify";
import { queryDefinitionInputSchema, updateArticleStatusInputSchema, type QueryDefinition } from "@pwio/shared";
import { ZodError } from "zod";
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

function zodErrorResponse(error: ZodError) {
  return {
    message: "Invalid request body",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };
}

app.post<{ Body: unknown }>("/api/queries", async (request, reply) => {
  const parsed = queryDefinitionInputSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send(zodErrorResponse(parsed.error));
  }

  const now = new Date().toISOString();
  const body = parsed.data;

  const query: QueryDefinition = {
    id: body.id ?? uuid(),
    name: body.name ?? "Untitled query",
    description: body.description ?? "",
    baseQuery: body.baseQuery ?? "",
    includeTerms: body.includeTerms ?? [],
    excludeTerms: body.excludeTerms ?? [],
    targetDomains: body.targetDomains ?? [],
    dateWindowDays: body.dateWindowDays ?? 30,
    topX: body.topX ?? 5,
    minimumScore: body.minimumScore ?? 70,
    frequency: body.frequency ?? "manual",
    status: body.status ?? "enabled",
    governanceThemes: body.governanceThemes ?? [],
    createdAt: body.createdAt ?? now,
    updatedAt: now,
    lastRunAt: body.lastRunAt,
    nextRunAt: body.nextRunAt
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

app.patch<{
  Params: { id: string };
  Body: unknown;
}>("/api/articles/:id/status", async (request, reply) => {
  const parsed = updateArticleStatusInputSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send(zodErrorResponse(parsed.error));
  }

  const article = storage.updateArticleStatus(request.params.id, parsed.data.status);

  if (!article) {
    return reply.code(404).send({ message: "Article not found" });
  }

  return article;
});

startScheduler();

const port = Number(process.env.PORT ?? 3150);

await app.listen({ port, host: "0.0.0.0" });
