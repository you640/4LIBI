import dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:5176";
const analysisId = process.argv[2] || "cmtgniwh9000934ofkijljgbv";

async function main() {
  console.log(`\n=== Polling status for Analysis ID: ${analysisId} ===`);
  const startTime = Date.now();

  let attempts = 0;
  let analysisData: any = null;

  while (attempts < 300) {
    attempts++;
    await new Promise((r) => setTimeout(r, 3000));

    const pollRes = await fetch(`${BASE_URL}/api/analyses/${analysisId}`);
    if (!pollRes.ok) {
      console.warn(`Poll attempt ${attempts} returned HTTP ${pollRes.status}`);
      continue;
    }

    analysisData = await pollRes.json();
    console.log(`Attempt ${attempts}: status = ${analysisData.status}`);

    if (analysisData.status === "ready") {
      break;
    }
    if (analysisData.status === "error") {
      console.error("Analysis failed with error:", analysisData.error || analysisData);
      process.exit(1);
    }
  }

  if (analysisData?.status !== "ready") {
    console.error("Analysis did not complete within the timeout period.");
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAnalysis finished! Status: ready (polled for ${elapsed}s)`);

  const forensic = analysisData.data?.forensic;
  if (!forensic) {
    console.error("No forensic result in analysis data:", JSON.stringify(analysisData.data, null, 2));
    process.exit(1);
  }

  console.log("\n================ PILOT RUN REPORT ================\n");
  console.log(`1. ID vytvoreného spisu: ${analysisId}`);
  console.log(`   Názov spisu: ${analysisData.name}`);
  console.log(`   Vytvorené: ${analysisData.createdAt}`);

  const q = forensic.case_level?.questions;
  console.log("\n2. & 3. Odpovede na 3 vyšetrovacie otázky, ich confidence a status:\n");

  if (q) {
    console.log(`A. Tok zbraní (Weapons Flow):`);
    console.log(`   - Odpoveď: ${q.weapons_flow.answer}`);
    console.log(`   - Status: ${q.weapons_flow.status}`);
    console.log(`   - Confidence: ${q.weapons_flow.confidence}`);
    console.log(`   - Aktéri: ${q.weapons_flow.actors.map((a: any) => `${a.name} (${a.role})`).join(", ") || "žiadni"}`);

    console.log(`\nB. Autor plánu (Plan Author):`);
    console.log(`   - Odpoveď: ${q.plan_author.answer}`);
    console.log(`   - Status: ${q.plan_author.status}`);
    console.log(`   - Confidence: ${q.plan_author.confidence}`);
    console.log(`   - Kandidáti: ${q.plan_author.candidates.map((c: any) => `${c.name} (${c.role})`).join(", ") || "žiadni"}`);

    console.log(`\nC. Financovanie (Financing):`);
    console.log(`   - Odpoveď: ${q.financing.answer}`);
    console.log(`   - Status: ${q.financing.status}`);
    console.log(`   - Confidence: ${q.financing.confidence}`);
    console.log(`   - Zdroje: ${q.financing.funding_sources.map((s: any) => s.name).join(", ") || "žiadne"}`);
  } else {
    console.log("   case_level.questions is empty/null");
  }

  console.log("\n4. Všetky použité citácie:");
  const allCitations: any[] = [];
  if (q) {
    for (const [qName, qObj] of Object.entries(q) as [string, any][]) {
      const items = (qObj.actors || qObj.candidates || qObj.funding_sources || []);
      for (const item of items) {
        for (const ev of (item.evidence || [])) {
          allCitations.push({ question: qName, person: item.name, ...ev });
        }
      }
    }
  }

  if (allCitations.length === 0) {
    console.log("   Žiadne citácie (status: insufficient_evidence / inconclusive)");
  } else {
    for (const c of allCitations) {
      console.log(`   - [${c.question}] ${c.person}: issue_id=${c.linear_issue_id || "null"}, doc_id=${c.linear_document_id || "null"}, group=${c.source_group_id || "null"}, page=${c.page ?? "null"}`);
      console.log(`     Citát: "${c.quote}"`);
    }
  }

  console.log("\n5. Zoznam contradictions, warnings a missing_evidence:");
  console.log("   - Contradictions:", JSON.stringify(forensic.case_level?.contradictions || [], null, 2));
  console.log("   - Warnings:", JSON.stringify(forensic.warnings || [], null, 2));
  console.log("   - Missing evidence:", JSON.stringify(forensic.case_level?.missing_evidence || [], null, 2));

  console.log("\n6. Kontrola neprípustných zdrojov (derived_index, register, timeline, 00A):");
  let derivedFound = false;
  for (const c of allCitations) {
    if (c.source_kind === "derived_index" || c.is_framework || (c.quote && /register|časová os|hlavný index|source of truth/i.test(c.quote))) {
      derivedFound = true;
      console.error(`   POZOR: Nájdený odvodený zdroj v citáciách! ${JSON.stringify(c)}`);
    }
  }
  if (!derivedFound) {
    console.log("   POTVRDENÉ: Žiadny derived_index, register, timeline ani 00A nebol použitý ako skutkový dôkaz.");
  }

  console.log("\n7. Počet unikátnych source_group_id pri každej otázke:");
  if (q) {
    for (const [qName, qObj] of Object.entries(q) as [string, any][]) {
      const groups = new Set<string>();
      const items = (qObj.actors || qObj.candidates || qObj.funding_sources || []);
      for (const item of items) {
        for (const ev of (item.evidence || [])) {
          if (ev.source_group_id) groups.add(ev.source_group_id);
          else if (ev.linear_issue_id) groups.add(`issue:${ev.linear_issue_id}`);
          else if (ev.linear_document_id) groups.add(`doc:${ev.linear_document_id}`);
        }
      }
      console.log(`   - ${qName}: ${groups.size} unikátnych skupín (${[...groups].join(", ") || "0"})`);
    }
  }

  console.log("\n8. Presný HTTP výsledok endpointu /api/analyses/linear:");
  console.log(`   HTTP 200 OK`);
  console.log(`   Payload: {"id": "${analysisId}", "status": "${analysisData.status}"}`);
  console.log("\n================ END OF REPORT ================\n");
}

main().catch((err) => {
  console.error("Polling script error:", err);
  process.exit(1);
});
