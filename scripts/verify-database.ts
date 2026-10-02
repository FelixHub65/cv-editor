import "../envConfig";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.local and add the Neon development branch connection string.");
}

const sql = neon(connectionString);
const [result] = await sql`select current_database() as database, current_user as role`;

console.log(`Connected to PostgreSQL database ${String(result.database)} as ${String(result.role)}.`);
