import net from "node:net";

export const DOCKER_DATABASE_URL =
  "postgresql://forenz:forenz@localhost:5432/forenzdetectiv?schema=public";

export const PRISMA_DEV_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:51214/forenzdetectiv?schema=public&sslmode=disable";

async function canConnect(host: string, port: number): Promise<boolean> {
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

/** Prefer docker-compose Postgres (5432); fall back to Prisma dev (51214). */
export async function resolveTestDatabaseUrl(): Promise<string> {
  if (process.env.CI && process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const dockerUp = await canConnect("127.0.0.1", 5432);
  if (dockerUp) return DOCKER_DATABASE_URL;

  const prismaDevUp = await canConnect("127.0.0.1", 51214);
  if (prismaDevUp) return PRISMA_DEV_DATABASE_URL;

  return process.env.DATABASE_URL || DOCKER_DATABASE_URL;
}
