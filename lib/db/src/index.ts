import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

function getMigrationsFolder(): string {
  const candidates = [
    fileURLToPath(new URL("./db-migrations", import.meta.url)),
    resolve(process.cwd(), "lib/db/drizzle"),
    resolve(process.cwd(), "../../lib/db/drizzle"),
    fileURLToPath(new URL("../drizzle", import.meta.url)),
  ];
  const folder = candidates.find((candidate) =>
    existsSync(resolve(candidate, "meta/_journal.json")),
  );
  if (!folder) {
    throw new Error("Could not locate the Drizzle SQL migration directory");
  }
  return folder;
}

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: getMigrationsFolder() });
}

export * from "./schema";
