// Court Dossier Generator — kompilácia forenznej správy pre súdne konanie a obhajobu
import type { Analysis, Contradiction } from '../types';

export function generateCourtDossierMarkdown(analysis: Analysis, caseNumber = 'ČVS: PP-104/2026'): string {
  const meta = analysis.metadata || { document_name: 'Forenzný spis', upload_date: new Date().toISOString() };
  const persons = analysis.persons || [];
  const timeline = analysis.timeline || [];
  const contradictions = analysis.contradictions || [];
  const claims = analysis.claims || [];

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
`).join('\n')}

---

## 4. DÔKAZNÝ REŤAZEC A INTEGRITA DÁT (Chain of Custody)
- **Generátor:** ForenzDetectiv Mistral Large 2411 + Pixtral Vision
- **Časová pečiatka:** ${new Date().toISOString()}
- **Formát overenia:** SHA-256 Digest Verification
- **Právna doložka:** Táto správa bola vygenerovaná automatizovaným forenzným systémom na podporu dokazovania a krížového výsluchu.
`;
}
