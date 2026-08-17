import "dotenv/config";
import { PrismaClient } from "../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const LOCAL_EMAIL = "local@forenzdetectiv.local";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: LOCAL_EMAIL },
    update: {},
    create: { email: LOCAL_EMAIL },
  });
  console.log(`Seed user: ${user.email} (${user.id})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
