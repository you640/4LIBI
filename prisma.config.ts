import "dotenv/config";
import { defineConfig } from "prisma/config";

// Build-time (`prisma generate`) may run without DATABASE_URL.
// Runtime (migrate / client) must set a real URL via env.
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
