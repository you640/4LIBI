import dotenv from "dotenv";
import {
  getLinearStatus,
  loadLinearCatalog,
  resolveLinearApiKey,
} from "../src/lib/forensic/linearClient";

dotenv.config();

async function run() {
  const apiKey = resolveLinearApiKey();
  console.log("configured:", Boolean(apiKey));

  if (!apiKey) {
    throw new Error("LINEAR_API_KEY chýba na serveri.");
  }

  const status = await getLinearStatus({ apiKey });
  console.log("Linear Connection Status Result:", JSON.stringify(status, null, 2));

  if (!status.reachable || status.error) {
    throw new Error(status.error || "Linear projekt nie je dostupný.");
  }

  const catalog = await loadLinearCatalog({ apiKey });
  console.log("Linear Catalog Loaded. Project Name:", catalog.project_name);
  console.log("Sources count:", catalog.sources.length);

  const admissible = catalog.sources.filter((s) => s.admissible);
  console.log("Admissible Sources count:", admissible.length);
  for (const s of admissible) {
    console.log(`- Admissible [${s.source_kind}] [${s.source_group_id}] Title: "${s.title}"`);
    console.log(`  Metadata:`, s.metadata);
  }

  if (admissible.length === 0) {
    throw new Error("Nenašli sa žiadne prípustné skutkové dôkazy.");
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exitCode = 1;
});
