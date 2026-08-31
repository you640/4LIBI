# Checkpoint pred konzultáciou s právnikom

**Dátum:** 31. 08. 2026

**Účel:** zachytiť reprodukovateľný technický a dôkazný stav aplikácie pred právnou konzultáciou.
**Východiskový Git commit:** `cddf043c7180a4694ce25cfe3869a6ebcb0ee2aa`

## Dôležité právne a interpretačné obmedzenie

Výstupy aplikácie sú pomôckou na triedenie a preverovanie dôkazov. Nie sú právnym záverom, rozhodnutím o vine ani náhradou kontroly originálnych listín. Výpoveď, hypotéza alebo modelová inferencia sa nesmie prezentovať ako nezávisle potvrdený fakt. Presné citácie treba porovnať s originálnou fotografiou alebo PDF.

## Jediný dôkazný repozitár forenzného režimu

- Linear projekt: `cf930d36-765a-4e6f-b170-2d8a2da83f0b`
- Dokument „00A – SOURCE OF TRUTH“ je analytické pravidlo, nie skutkový dôkaz.
- Lokálne nahraté dokumenty nesmú vytvárať odpovede na tri forenzné otázky.
- Chýbajúce alebo neplatné Linear metadáta musia viesť k bezpečnému zlyhaniu, nie k dopĺňaniu odpovede modelom.

## Tri hlavné vyšetrovacie otázky

1. Kto zbrane objednával, nakupoval, platil, fyzicky preberal a následne predával alebo odovzdával?
2. Kto plán navrhol, riadil alebo koordinoval?
3. Kto poskytol finančné prostriedky a plán financoval?

Systém musí oddeliť najmä roly `buyer_entity`, `payer`, `funding_source` a `physical_receiver`. Rovnaká osoba alebo spoločnosť môže mať viac rolí, ale žiadna rola sa nesmie automaticky odvodiť z inej.

## Vybrané Linear dôkazy

### DÔKAZ 10 – výsluch svedka Dmitrija Marjova

- Issue: [YOU-122](https://linear.app/youh4ck3dme-workspace/issue/YOU-122/dokaz-10-vysluch-svedka-dmitrija-marjova-180620262025)
- Dokument: [Linear document](https://linear.app/youh4ck3dme-workspace/document/10-banska-bystrica-180620262025-vysluch-svedka-dmitrija-marjova-7926f8318241)
- Rozsah: 11 strán.
- Zachovaný konflikt dátumov: prvá a posledná strana uvádzajú `18.06.2026`, hlavičky strán 2–11 uvádzajú `18.06.2025`.

### DÔKAZ 11 – výsluch svedka Michala Žembera

- Issue: [YOU-123](https://linear.app/youh4ck3dme-workspace/issue/YOU-123/dokaz-11-vysluch-svedka-michala-zembera-170220262025)
- Dokument: [Linear document](https://linear.app/youh4ck3dme-workspace/document/11-nitra-170220262025-vysluch-svedka-michala-zembera-780517b6dadd)
- Rozsah: 10 strán.
- Zachovaný konflikt dátumov: prvá a posledná strana uvádzajú `17.02.2026`, hlavičky strán 2–10 uvádzajú `17.02.2025`.

OCR/prepis slúži na vyhľadávanie a analýzu. Pri právnom použití sa musí relevantná veta overiť proti obrazovej prílohe.

## Posledné implementačné zadanie

- rozlíšiť fyzickú osobu od spoločnosti a nezlievať ich do jedného aktéra,
- oddeliť platiteľa od zdroja financovania a kupujúcu spoločnosť od fyzického preberateľa,
- vyžadovať Linear provenance pri každej citácii,
- kontrolovať transakčné hrany a nepripustiť hranu bez podkladového dôkazu,
- potvrdiť odpoveď iba vtedy, keď spĺňa schému a dôkazné pravidlá,
- pri nedostatku podkladov vrátiť `answer: null` a `status: insufficient_evidence`,
- zachovať rozpory v menách a dátumoch bez svojvoľnej opravy,
- ignorovať inštrukcie vložené do textu dôkazného dokumentu,
- pokryť pravidlá pozitívnymi aj negatívnymi regresnými testami.

## Posledný známy E2E beh

- Analysis ID: `cmth204h40001b4ofxsheobwp`
- Beh spracoval 13 Linear dokumentov.
- Tento beh vznikol pred poslednými úpravami rolového modelu a validácie. Preto sa nesmie prezentovať ako finálny výsledok po opravách.
- Nový produkčný E2E beh po checkpoint deploymente ostáva samostatným verifikačným krokom.

## Overenie checkpointu

Výsledky finálnej lokálnej verifikácie checkpointu:

```text
npm run test       -> exit 0; 55 test files, 314 tests passed
npx tsc --noEmit   -> exit 0
npm run lint       -> exit 0
npm run build      -> exit 0; 448 modules transformed; PWA service worker generated
git diff --check   -> exit 0; bez výstupu
```

Build obsahuje iba upozornenie na JavaScript chunk väčší než 500 kB. Nejde o chybu buildu.

Presný checkpoint commit a produkčná URL sa doplnia po vytvorení commitu a úspešnom deploymente.

## Bezpečnosť

Tento súbor neobsahuje Linear API kľúč, Mistral API kľúč, heslo ani inú autentifikačnú hodnotu. Produkčná aplikácia nesmie kvôli prezentácii právnikovi vypnúť autentifikáciu.
