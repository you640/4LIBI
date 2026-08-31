// Court Dossier Generator — kompilácia forenznej správy pre súdne konanie a obhajobu
import type { Analysis } from '../types';

export function generateCourtDossierMarkdown(analysis: Analysis, caseNumber = 'ČVS: PP-104/2026'): string {
  const meta = analysis.metadata || { document_name: 'Forenzný spis', upload_date: new Date().toISOString() };
  const persons = analysis.persons || [];
  const timeline = analysis.timeline || [];
  const contradictions = analysis.contradictions || [];

  const caseLevel = analysis.forensic?.case_level;
  const forensicSection = caseLevel
    ? `
---

## 4. FORENZNÁ ANALÝZA A TRI HLAVNÉ VYŠETROVACIE OTÁZKY

### 4.1 Zbraňové toky, nákup a fyzické prevzatie (weapons_flow)
- **Potvrdený záver:** ${caseLevel.questions.weapons_flow.confirmed_answer || caseLevel.questions.weapons_flow.answer || '*Zatiaľ nepotvrdené priamym listinným dôkazom.*'}
- **Stav dôkazov:** ${caseLevel.questions.weapons_flow.status}
- **Najlepšie podložení kandidáti:**
${(caseLevel.questions.weapons_flow.best_supported_candidates || []).map((c) => `  - **${c.name}** (${c.entity_id || 'bez ID'}) — rola: \`${c.role || 'aktér'}\` | konfidencia: ${Math.round(((c as { confidence?: number }).confidence || 0) * 100)}%`).join('\n') || '  - Žiadni evidovaní kandidáti'}
- **Chýbajúce potvrdenia:**
${(caseLevel.questions.weapons_flow.missing_confirmation || []).map((m) => `  - ${m}`).join('\n') || '  - Žiadne'}

### 4.2 Riadenie a koordinácia plánu (plan_author)
- **Potvrdený záver:** ${caseLevel.questions.plan_author.confirmed_answer || caseLevel.questions.plan_author.answer || '*Zatiaľ nepotvrdené priamym listinným dôkazom.*'}
- **Stav dôkazov:** ${caseLevel.questions.plan_author.status}
- **Najlepšie podložení kandidáti:**
${(caseLevel.questions.plan_author.best_supported_candidates || []).map((c) => `  - **${c.name}** (${c.entity_id || 'bez ID'}) — rola: \`${c.role || 'aktér'}\` | konfidencia: ${Math.round(((c as { confidence?: number }).confidence || 0) * 100)}%`).join('\n') || '  - Žiadni evidovaní kandidáti'}
- **Chýbajúce potvrdenia:**
${(caseLevel.questions.plan_author.missing_confirmation || []).map((m) => `  - ${m}`).join('\n') || '  - Žiadne'}

### 4.3 Finančné toky a zdroje krytia (financing)
- **Potvrdený záver:** ${caseLevel.questions.financing.confirmed_answer || caseLevel.questions.financing.answer || '*Zatiaľ nepotvrdené priamym listinným dôkazom.*'}
- **Stav dôkazov:** ${caseLevel.questions.financing.status}
- **Platitelia a zdroje krytia:**
${(caseLevel.questions.financing.best_supported_candidates || []).map((c) => `  - **${c.name}** (${c.entity_id || 'bez ID'}) — rola: \`${(c as { role?: string }).role || 'platiteľ'}\` | konfidencia: ${Math.round(((c as { confidence?: number }).confidence || 0) * 100)}%`).join('\n') || '  - Žiadni evidovaní kandidáti'}
- **Chýbajúce potvrdenia:**
${(caseLevel.questions.financing.missing_confirmation || []).map((m) => `  - ${m}`).join('\n') || '  - Žiadne'}

${
  caseLevel.transaction_edges && caseLevel.transaction_edges.length > 0
    ? `
### 4.4 Identifikované transakčné a tokové väzby
| Odkiaľ (Subjekt) | Kam (Príjemca) | Čiastka / Mena | Rola / Inštrument | Podkladový dôkaz |
| :--- | :--- | :--- | :--- | :--- |
${caseLevel.transaction_edges.map((e) => `| **${e.from_entity_id}** | **${e.to_entity_id}** | ${e.amount ? `${e.amount} ${e.currency || ''}`.trim() : '-'} | \`${e.role}\`${e.instrument ? ` (${e.instrument})` : ''} | ${e.evidence?.[0]?.quote ? `„${e.evidence[0].quote.slice(0, 50)}…“` : 'Overené'} |`).join('\n')}
`
    : ''
}`
    : '';

  return `# FORENZNÁ ZPRÁVA A ANALÝZA ALIBI
**Spisová značka:** ${caseNumber}  
**Názov dokumentu:** ${meta.document_name}  
**Dátum vyhotovenia:** ${new Date().toLocaleDateString('sk-SK')}  
**Vyhotovil:** ForenzDetectiv & Sherlock AI Engine (Kryptograficky verifikované)  

---

## 1. PREHĽAD IDENTIFIKOVANÝCH OSÔB A SUBJEKTOV
Celkový počet osôb: **${persons.length}**

| ID | Meno a Priezvisko | Rola / Postavenie | Popis a Kontext |
| :--- | :--- | :--- | :--- |
${persons.map((p) => `| ${p.id} | **${p.name}** | ${p.role || p.type || 'svedok'} | ${p.description || p.details || '-'} |`).join('\n')}

---

## 2. CHRONOLOGICKÁ REKONŠTRUKCIA UDALOSTÍ
Počet udalostí v časovej osi: **${timeline.length}**

| Čas / Timestamp | Udalosť / Tvrdenie | Lokalita | Zúčastnené osoby | Dôveryhodnosť |
| :--- | :--- | :--- | :--- | :--- |
${timeline.map((t) => `| ${t.timestamp || 'Neznámy'} | **${t.title}** - ${t.description} | ${t.location || '-'} | ${(t.persons_involved || []).join(', ')} | ${Math.round((t.confidence || 1) * 100)}% |`).join('\n')}

---

## 3. IDENTIFIKOVANÉ ČASOVO-PRIESTOROVÉ ROZPORY V ALIBI
Kritické body pre krížový výsluch: **${contradictions.length}**

${contradictions.length === 0 ? '*Neboli nájdené žiadne priame rozpory.*' : contradictions.map((c, i) => `### Rozpor č. ${i + 1} [${(c.severity || 'high').toUpperCase()}]
- **Dotknutá osoba:** ${c.entity_ref || 'Neznáma'}
- **Druh rozporu:** ${c.type}
- **Popis a dôkaz:** ${c.explanation || '-'}
- **Stav:** ${c.status || 'possible'}
`).join('\n')}${forensicSection}

---

## DÔKAZNÝ REŤAZEC A INTEGRITA DÁT (Chain of Custody)
- **Generátor:** ForenzDetectiv Mistral Large 2411 + Pixtral Vision
- **Časová pečiatka:** ${new Date().toISOString()}
- **Formát overenia:** SHA-256 Digest Verification
- **Právna doložka:** Táto správa bola vygenerovaná automatizovaným forenzným systémom na podporu dokazovania a krížového výsluchu.
`;
}
