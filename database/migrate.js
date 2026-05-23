#!/usr/bin/env node

/*
 * Simple PostgreSQL migration runner for Intelligence Ops.
 *
 * Usage:
 *   node database/migrate.js up
 *   node database/migrate.js up 001
 *   node database/migrate.js status
 *
 * Environment:
 *   INTELLIGENCE_OPS_DATABASE_URL, DATABASE_URL, or LABELS_DATABASE_URL
 */

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

const rootEnvLocal = path.join(__dirname, "..", ".env.local");
const rootEnv = path.join(__dirname, "..", ".env");
const localEnv = path.join(__dirname, ".env");

for (const envPath of [rootEnv, rootEnvLocal, localEnv]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const migrationsDir = path.join(__dirname, "migrations");
const databaseUrl = (
  process.env.INTELLIGENCE_OPS_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.LABELS_DATABASE_URL ||
  ""
).trim();

if (!databaseUrl) {
  console.error("ERROR: No database connection string set.");
  console.error("Set INTELLIGENCE_OPS_DATABASE_URL, DATABASE_URL, or LABELS_DATABASE_URL.");
  process.exit(1);
}

function getSslConfig() {
  const match = databaseUrl.match(/[?&]sslmode=([^&]+)/i);
  const sslMode = (match?.[1] || process.env.PGSSLMODE || "").toLowerCase();
  const caPath = process.env.PGSSLROOTCERT || process.env.DATABASE_SSL_CA;

  if (sslMode === "disable" || process.env.DATABASE_SSL === "disable") {
    return false;
  }

  if (
    sslMode === "no-verify" ||
    sslMode === "require" ||
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false" ||
    process.env.ALLOW_SELF_SIGNED_CERTS === "true"
  ) {
    return { rejectUnauthorized: false };
  }

  if (caPath) {
    return {
      ca: fs.readFileSync(caPath, "utf8"),
      rejectUnauthorized: true
    };
  }

  return undefined;
}

function createClient() {
  const ssl = getSslConfig();
  return new Client({
    connectionString: databaseUrl,
    ...(ssl !== undefined ? { ssl } : {})
  });
}

function getMigrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql") && !file.includes("TEMPLATE"))
    .sort()
    .map((filename) => {
      const version = filename.split("_")[0];
      const name = filename.replace(/^\d+_/, "").replace(/\.sql$/, "");
      return {
        version,
        name,
        filename,
        path: path.join(migrationsDir, filename)
      };
    });
}

async function getAppliedMigrations(client) {
  try {
    const result = await client.query("SELECT version, name, applied_at FROM ops.schema_migrations ORDER BY version");
    return result.rows;
  } catch {
    return [];
  }
}

async function initializeMigrationTable(client) {
  const trackingMigration = getMigrationFiles().find((migration) => migration.version === "000");

  if (!trackingMigration) {
    throw new Error("Migration tracking file 000_migration_tracking.sql not found");
  }

  const sql = fs.readFileSync(trackingMigration.path, "utf8");
  await client.query(sql);
}

async function runMigration(client, migration) {
  console.log(`Running migration ${migration.version}_${migration.name}...`);
  const sql = fs.readFileSync(migration.path, "utf8");

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO ops.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
      [migration.version, migration.name]
    );
    await client.query("COMMIT");
    console.log(`Migration ${migration.version}_${migration.name} completed`);
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`Migration ${migration.version}_${migration.name} failed:`);
    console.error(error.message);
    return false;
  }
}

async function migrateUp() {
  const client = createClient();
  const targetVersion = process.argv.slice(3).find((arg) => !arg.startsWith("--"));

  try {
    await client.connect();

    let appliedMigrations = await getAppliedMigrations(client);
    if (!appliedMigrations.some((migration) => migration.version === "000")) {
      await initializeMigrationTable(client);
      appliedMigrations = await getAppliedMigrations(client);
    }

    const appliedVersions = new Set(appliedMigrations.map((migration) => migration.version));
    let pendingMigrations = getMigrationFiles().filter(
      (migration) => migration.version !== "000" && !appliedVersions.has(migration.version)
    );

    if (targetVersion) {
      pendingMigrations = pendingMigrations.filter((migration) => migration.version === targetVersion);
    }

    if (pendingMigrations.length === 0) {
      console.log(targetVersion ? `No pending migration found for version ${targetVersion}.` : "Database is up to date.");
      return;
    }

    for (const migration of pendingMigrations) {
      const success = await runMigration(client, migration);
      if (!success) process.exit(1);
    }
  } finally {
    await client.end();
  }
}

async function showStatus() {
  const client = createClient();

  try {
    await client.connect();
    const appliedMigrations = await getAppliedMigrations(client);
    const appliedVersions = new Set(appliedMigrations.map((migration) => migration.version));

    console.log("Version  Status    Name                         Applied At");
    console.log("-------  --------  ---------------------------  -------------------");

    for (const migration of getMigrationFiles()) {
      const applied = appliedMigrations.find((item) => item.version === migration.version);
      const status = appliedVersions.has(migration.version) ? "Applied" : "Pending";
      const appliedAt = applied?.applied_at
        ? applied.applied_at.toISOString().slice(0, 19).replace("T", " ")
        : "-";

      console.log(
        `${migration.version.padEnd(8)} ${status.padEnd(9)} ${migration.name.padEnd(28)} ${appliedAt}`
      );
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "up":
      await migrateUp();
      break;
    case "status":
      await showStatus();
      break;
    case "down":
      console.error("Rollback migrations are not implemented.");
      process.exit(1);
      break;
    default:
      console.log("Usage:");
      console.log("  node database/migrate.js up");
      console.log("  node database/migrate.js up <version>");
      console.log("  node database/migrate.js status");
      process.exit(command ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
