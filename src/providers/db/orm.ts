import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../prisma/client";

export function GetORM(URL: string): PrismaClient {
    const pool = new Pool({
        connectionString: URL,
        ssl: { rejectUnauthorized: true },
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}