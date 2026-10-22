import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run database migrations.");
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
try {
  const migration = await readFile(new URL("../sql/001_init.sql", import.meta.url), "utf8");
  await pool.query(migration);
  console.log("Database migrations completed.");
} finally {
  await pool.end();
}
