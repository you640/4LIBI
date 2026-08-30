# ForenzDetectiv — Beta testovanie (v0.2.0-beta)

Ďakujeme, že testujete ForenzDetectiv. Tento návod vám pomôže začať za pár minút.

## Čo je ForenzDetectiv?

Webová aplikácia pre forenznú analýzu spisov: nahráte PDF/TXT, AI (Mistral) extrahuje osoby, časovú os, rozpory a vzťahy. Výsledky vidíte v prehliadači s odkazom na stranu spisu (`s. 12`).

---

## Rýchly štart

1. Otvorte https://forenzdetectiv-web.vercel.app
2. Na home kliknite **Nahrať výpoveď**
3. Po analýze otvorte záložky **Rozpory**, **Časová os**, **Graf**

---

## Reálna analýza (s API kľúčom)

Pre upload vlastných dokumentov potrebujete **API kľúč** od administrátora.

### Ako poslať API kľúč

Aplikácia posiela kľúč v hlavičke `X-API-Key` pri každom volaní API.

**Vo ForenzDetectiv UI:** Profil → sekcia API / nastavenia (ak je dostupná) — vložte kľúč a uložte.

**Manuálne (curl):**

```bash
curl -H "X-API-Key: VAS_BETA_KLUC" \
  https://forenzdetectiv-web.vercel.app/api/health
```

Očakávaná odpoveď: `{"status":"ok",...}`

### Upload a analýza

1. **Sherlock** (`/sherlock`) — nahrajte PDF alebo TXT (max 20 súborov, 25 MB každý)
2. Počkajte na dokončenie analýzy (fronta BullMQ)
3. Prejdite do **Spisy** → otvorte nový spis → **Rozpory** / **Časová os**

### Čo očakávať

- Rozpory s citátmi a **číslom strany** (ak AI alebo parser stranu našiel)
- Graf vzťahov medzi osobami
- Mapa alibi (ak sú v texte lokácie)

---

## Súkromie (Privacy Wipe)

- Po **zmazaní spisu** sa odstránia súvisiace joby vo fronte (Redis)
- Analýza v IndexedDB v prehliadači zostáva, kým ju sami nevymažete alebo nevyčistíte údaje stránky
- Nahrávajte len testovacie / anonymizované dokumenty, pokiaľ vám admin nepovie inak

---

## Známe obmedzenia bety

| Obmedzenie | Popis |
|------------|--------|
| Uploady na serveri | Súbory na Railway môžu zmiznúť po redeploy — výsledok analýzy je v DB/cache |
| Rate limit | ~60 požiadaviek / minútu na IP |
| OCR | Vyžaduje `MISTRAL_API_KEY` na serveri; veľké skeny môžu trvať dlhšie |
| Offline | UI shell áno (PWA); nová analýza vyžaduje internet a API |

---

## Hlásenie chýb

Pri hlásení prosím uveďte:

1. **Čo ste robili** (kroky na reprodukciu)
2. **Čo ste očakávali** vs. **čo sa stalo**
3. **URL** stránky (bez citlivých údajov v spise)
4. **Prehliadač** a zariadenie (Chrome / Safari / mobil)
5. **Screenshot** alebo chybová hláška
6. Či ide o **reálnu analýzu** (upload) a aký súbor ste nahrávali (bez citlivého obsahu)

**Kam poslať:** e-mail / Slack / GitHub Issues — podľa inštrukcií od administrátora bety.

Pre technické chyby API môže admin skontrolovať Railway logy a `GET /api/health`.

---

## FAQ

**401 Vyžaduje sa autentifikácia**  
→ Chýba alebo je nesprávny API kľúč. Skontrolujte Profil alebo kontaktujte admina.

**CORS error v konzole**  
→ Admin musí pridať vašu Vercel URL do `ALLOWED_ORIGINS` na API.

**Analýza visí**  
→ Redis / fronta môže byť zaneprázdnená. Skúste obnoviť stránku po 1–2 minútach.

**Chýba číslo strany (`s. N`)**  
→ AI nie vždy vráti `page` v JSON; appka sa pokúsi stranu vydoliť z textu. Ak v dokumente nie je značka strany, badge sa nezobrazí.

---

*Verzia dokumentu: v0.2.0-beta — 2026-08-30*
