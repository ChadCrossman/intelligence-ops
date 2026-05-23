import pg from "pg";
import { fileStorage } from "./fileStorage.js";
import { createPostgresStorage } from "./postgresStorage.js";
import { createSqliteStorage } from "./sqliteStorage.js";

export type { Storage } from "./storage.js";

const { Pool } = pg;

function databaseUrl(): string {
  // Use || rather than ?? so that empty-string env vars also fall through.
  return (
    process.env.INTELLIGENCE_OPS_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.LABELS_DATABASE_URL?.trim() ||
    ""
  );
}

function createPool() {
  const connectionString = databaseUrl();

  if (!connectionString) {
    throw new Error("STORAGE_PROVIDER=postgres requires INTELLIGENCE_OPS_DATABASE_URL.");
  }

  return new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=disable") ? false : undefined
  });
}

async function createStorage() {
  const provider = process.env.STORAGE_PROVIDER ?? "sqlite";

  if (provider === "postgres") {
    return createPostgresStorage(createPool());
  }

  if (provider === "file") {
    return fileStorage;
  }

  // Default: sqlite — local-first, no server required.
  return createSqliteStorage();
}

// Top-level await is valid in ESM ("type": "module").
// The server's import of this module suspends until the DB is ready.
export const storage = await createStorage();
