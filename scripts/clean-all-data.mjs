import "dotenv/config";
import pg from "pg";
import { rm, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const connectionString = process.env.DATABASE_URL;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../uploads");

console.log("=========================================");
console.log("🧹 MAZANIE VŠETKÝCH TESTOVACÍCH A DEMO DÁT");
console.log("=========================================");

// 1. Vymazanie uploads adresára
try {
  const files = await readdir(uploadsDir);
  for (const file of files) {
    const fullPath = path.join(uploadsDir, file);
    await rm(fullPath, { recursive: true, force: true });
  }
  console.log(`✅ Adresár uploads vyčistený (${files.length} položiek zmazaných).`);
} catch (err) {
  if (err.code === "ENOENT") {
    console.log("ℹ️ Adresár uploads neexistuje alebo je už prázdny.");
  } else {
    console.warn("⚠️ Chyba pri čistení uploads:", err.message);
  }
}

// 2. Vymazanie databázových tabuliek (PostgreSQL / Prisma)
if (!connectionString) {
  console.warn("⚠️ DATABASE_URL nie je nastavená v .env");
} else {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    console.log("🔌 Pripojené k databáze...");

    // Vyčistenie závislých tabuliek v správnom poradí
    const tables = [
      "_AnalysisToFile",
      "hitl_statuses",
      "audit_logs",
      "ocr_results",
      "conversation_logs",
      "geospatial_checks",
      "analyses",
      "files"
    ];

    for (const table of tables) {
      try {
        const res = await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);
        console.log(`  🗑️  Tabuľka "${table}" vymazaná.`);
      } catch (e) {
        // Tabuľka nemusí existovať ak ešte neboli aplikované migrácie
        console.log(`  ℹ️  Tabuľka "${table}": ${e.message.split("\n")[0]}`);
      }
    }

    console.log("✅ Databáza bola kompletne vyčistená!");
    await client.end();
  } catch (err) {
    console.log("ℹ️ Databáza nie je aktívna (offline):", err.message);
  }
}

console.log("=========================================");
console.log("🎉 VŠETKY DÁTA BOLI ÚSPEŠNE VYMAZANÉ!");
console.log("=========================================");
