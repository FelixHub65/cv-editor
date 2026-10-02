import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;

export function createDatabase(connectionString: string) {
  return drizzle(neon(connectionString), { schema });
}

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }
  database ??= createDatabase(connectionString);
  return database;
}

export type Database = ReturnType<typeof createDatabase>;
