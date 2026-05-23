// Load environment variables before any service modules are imported.
import { existsSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

for (const envPath of [join(process.cwd(), "..", "..", ".env"), join(process.cwd(), "..", "..", ".env.local")]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

import cors from "@fastify/cors";
import Fastify from "fastify";
import { queryDefinitionInputSchema, updateArticleStatusInputSchema } from "@pwio/shared";
import { ZodError } from "zod";
import { runQueryPipeline } from "./services/pipeline.js";
import { startScheduler } from "./services/scheduler.js";
import { buildQueryDefinition } from "./services/queryFactory.js";
import { storage } from "./services/storage/index.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

function zodErrorResponse(error: ZodError) {
  return {
    message: "Invalid request body",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };
}

app.get("/health", async () => ({ ok: true }));

app.get("/api/dashboard", async () => storage.snapshot());

app.get("/api/queries", async () => storage.listQueries());

app.post<{ Body: unknown }>("/api/queries", async (request, reply) => {
  const parsed = queryDefinitionInputSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send(zodErrorResponse(parsed.error));
  }

  return storage.upsertQuery(buildQueryDefinition(parsed.data));
});

app.post<{ Params: { id: string } }>("/api/queries/:id/run", async (request, reply) => {
  const query = await storage.getQuery(request.params.id);

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

  const article = await storage.updateArticleStatus(request.params.id, parsed.data.status);

  if (!article) {
    return reply.code(404).send({ message: "Article not found" });
  }

  return article;
});

startScheduler();

const port = Number(process.env.PORT ?? 3150);

await app.listen({ port, host: "0.0.0.0" });
