import cron from "node-cron";
import type { QueryDefinition } from "@pwio/shared";
import { runQueryPipeline } from "./pipeline.js";
import { storage } from "./storage/index.js";

async function runEnabled(frequency: QueryDefinition["frequency"]): Promise<void> {
  const queries = await storage.listQueries();
  const matching = queries.filter((q) => q.status === "enabled" && q.frequency === frequency);
  await Promise.allSettled(matching.map(runQueryPipeline));
}

export function startScheduler(): void {
  cron.schedule("0 * * * *", () => { void runEnabled("hourly"); });
  cron.schedule("0 7 * * *", () => { void runEnabled("daily"); });
  cron.schedule("0 7 * * 1", () => { void runEnabled("weekly"); });
}
