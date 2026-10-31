import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

type DatabaseConfig = {
    URL: string;
    SSL: boolean;
};

export function GetORM(config: DatabaseConfig): { db: Database; pool: Pool } {
    const pool = new Pool({
        connectionString: config.URL,
        ssl: config.SSL ? { rejectUnauthorized: true } : undefined,
    });
    const db = drizzle({ client: pool, schema });
    return { db, pool };
}
