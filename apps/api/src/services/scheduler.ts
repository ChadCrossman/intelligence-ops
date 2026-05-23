import cron from "node-cron";
import { runQueryPipeline } from "./pipeline.js";
import { storage } from "./storage.js";

export function startScheduler(): void {
  cron.schedule("0 * * * *", async () => {
    const queries = storage.listQueries().filter((query) => query.status === "enabled");

    for (const query of queries) {
      if (query.frequency === "hourly") {
        await runQueryPipeline(query);
      }
    }
  });

  cron.schedule("0 7 * * *", async () => {
    const queries = storage.listQueries().filter((query) => query.status === "enabled" && query.frequency === "daily");

    for (const query of queries) {
      await runQueryPipeline(query);
    }
  });

  cron.schedule("0 7 * * 1", async () => {
    const queries = storage.listQueries().filter((query) => query.status === "enabled" && query.frequency === "weekly");

    for (const query of queries) {
      await runQueryPipeline(query);
    }
  });
}
