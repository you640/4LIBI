import dotenv from "dotenv";
import { getLinearStatus, loadLinearCatalog } from "../src/lib/forensic/linearClient";

dotenv.config();

async function run() {
  const apiKey = process.env.LINEAR_API_KEY || "";
  console.log("Testing with LINEAR_API_KEY:", apiKey ? `${apiKey.slice(0, 10)}...` : "missing");
  
  const status = await getLinearStatus({ apiKey: apiKey || null });
  console.log("Linear Connection Status Result:", JSON.stringify(status, null, 2));

  const catalog = await loadLinearCatalog({ apiKey });
  console.log("Linear Catalog Loaded. Project Name:", catalog.project_name);
  console.log("Sources count:", catalog.sources.length);
  
  const admissible = catalog.sources.filter(s => s.admissible);
  console.log("Admissible Sources count:", admissible.length);
  for (const s of admissible) {
    console.log(`- Admissible [${s.source_kind}] Title: "${s.title}"`);
    console.log(`  Metadata:`, s.metadata);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
});
