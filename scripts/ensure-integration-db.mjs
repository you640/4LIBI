import { spawn } from "node:child_process";
import net from "node:net";

const DOCKER_DATABASE_URL =
  "postgresql://forenz:forenz@localhost:5432/forenzdetectiv?schema=public";

const PRISMA_DEV_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:51214/forenzdetectiv?schema=public&sslmode=disable";

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function resolveTestDatabaseUrl() {
  if (process.env.CI && process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  if (await canConnect("127.0.0.1", 5432)) return DOCKER_DATABASE_URL;
  if (await canConnect("127.0.0.1", 51214)) return PRISMA_DEV_DATABASE_URL;
  return process.env.DATABASE_URL || DOCKER_DATABASE_URL;
}

function runMigrate(databaseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma migrate deploy exited ${code}`));
    });
  });
}

const databaseUrl = await resolveTestDatabaseUrl();
const host = new URL(databaseUrl).hostname;
const port = Number(new URL(databaseUrl).port || 5432);
const reachable = await canConnect(host, port);

if (!reachable) {
  console.log(
    `[integration] no Postgres on resolved URL (${host}:${port}) — skipping migrate deploy`
  );
  process.exit(0);
}

console.log(`[integration] applying migrations to ${host}:${port}…`);
try {
  await runMigrate(databaseUrl);
} catch (err) {
  console.warn("[integration] migrate deploy failed:", err?.message || err);
  process.exit(0);
}
