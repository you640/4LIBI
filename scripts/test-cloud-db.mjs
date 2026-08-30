import dotenv from "dotenv";
dotenv.config();
import pg from "pg";
import Redis from "ioredis";

console.log("==================================================");
console.log("🔍 TEST PRIPOJENIA: LOKÁLNY .ENV → CLOUD RAILWAY");
console.log("==================================================");

async function testPostgres() {
  console.log("\n1. Pripájam sa na PostgreSQL...");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const res = await client.query("SELECT current_database(), version(), count(*) FROM pg_tables WHERE schemaname = 'public'");
    console.log("   ✅ PostgreSQL pripojený!");
    console.log("   🐘 Databáza:", res.rows[0].current_database);
    console.log("   📊 Počet tabuliek v public schéme:", res.rows[0].count);
    await client.end();
    return true;
  } catch (err) {
    console.error("   ❌ Chyba pripojenia PostgreSQL:", err.message);
    return false;
  }
}

async function testRedis() {
  console.log("\n2. Pripájam sa na Redis...");
  const redis = new Redis(process.env.REDIS_URL, {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
  });
  try {
    const pong = await redis.ping();
    console.log("   ✅ Redis pripojený! Odpoveď:", pong);
    await redis.quit();
    return true;
  } catch (err) {
    console.error("   ❌ Chyba pripojenia Redis:", err.message);
    return false;
  }
}

const pgOk = await testPostgres();
const redisOk = await testRedis();

console.log("\n==================================================");
if (pgOk && redisOk) {
  console.log("🎉 LOKÁLNY .ENV JE 100% PREPOJENÝ S CLOUD RAILWAY!");
} else {
  console.log("❌ Niektoré pripojenie zlyhalo.");
}
console.log("==================================================");
