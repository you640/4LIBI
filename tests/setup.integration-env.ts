import { resolveTestDatabaseUrl } from "./helpers/resolveTestDatabaseUrl";

// Must run before any import of server/prisma (see setup.integration.ts).
process.env.DATABASE_URL = await resolveTestDatabaseUrl();
