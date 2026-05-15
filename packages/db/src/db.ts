import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./config/env";

const connectionString = env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === "production" && !process.env.NEXT_PHASE) {
    throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ 
    connectionString: connectionString || "postgresql://postgres:postgres@localhost:5432/postgres" 
});
export const client = new PrismaClient({ adapter });