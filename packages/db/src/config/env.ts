import dotenv from "dotenv";
import path from "path";

// Try to load .env from several possible locations relative to the monorepo structure
const rootEnvPath = path.resolve(process.cwd(), "../../.env");
const workspaceRootEnvPath = path.resolve(process.cwd(), "../../../.env");

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: workspaceRootEnvPath });
dotenv.config(); // Also try default .env in cwd

export const env = {
    DATABASE_URL: process.env.DATABASE_URL,
};