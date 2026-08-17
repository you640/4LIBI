import "dotenv/config";
import { spawn } from "node:child_process";
import pg from "pg";

const INSTANCE = "forenzdetectiv";
const templateUrl =
  process.env.DATABASE_URL?.replace(/\/[^/?]+(\?|$)/, "/template1$1") ??
  "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable";

function runPrisma(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["prisma", ...args], {
      stdio: "inherit",
      shell: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma ${args.join(" ")} exited ${code}`));
    });
  });
}

async function tryConnect(connectionString) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 2000,
  });
  try {
    await client.connect();
    return client;
  } catch {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return null;
  }
}

let client = await tryConnect(templateUrl);

if (!client) {
  console.log(`[db] starting Prisma Postgres (${INSTANCE})...`);
  try {
    await runPrisma(["dev", "start", INSTANCE]);
  } catch {
    await runPrisma(["dev", "--name", INSTANCE, "--detach"]);
  }

  for (let i = 0; i < 40 && !client; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    client = await tryConnect(templateUrl);
  }
}

if (!client) {
  console.error("[db] Postgres is not reachable on 51214.");
  console.error("[db] Run: npx prisma dev --name forenzdetectiv --detach");
  process.exit(1);
}

const existing = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = $1",
  [INSTANCE]
);

if (existing.rowCount === 0) {
  await client.query(`CREATE DATABASE ${INSTANCE}`);
  console.log(`[db] created ${INSTANCE}`);
} else {
  console.log(`[db] ${INSTANCE} ready`);
}

await client.end();
