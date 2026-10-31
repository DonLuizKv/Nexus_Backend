import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Only `drizzle-kit generate` is used: it diffs the schema against db/migrations and writes SQL
// without touching any database. The tables are created by hand from db/schema.sql.
export default defineConfig({
    dialect: "postgresql",
    schema: "./src/providers/db/schema/index.ts",
    out: "./db/migrations",
    dbCredentials: {
        url: process.env.DATABASE_URL ?? "",
    },
    strict: true,
    verbose: true,
});
