import pg from "pg";
import { fileStorage } from "./fileStorage.js";
import { createPostgresStorage } from "./postgresStorage.js";

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

export const storage =
  process.env.STORAGE_PROVIDER === "postgres"
    ? createPostgresStorage(createPool())
    : fileStorage;
