import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const EXHIBIT_ROWS = [
  {
    claim: "„Spal som celú noc v Nitre.“",
    locus: "Nitra",
    time: "20:00",
    kind: "testimony",
  },
  {
    claim: "Kamera ČS, Štúrova, BA",
    locus: "Bratislava",
    time: "20:19",
    kind: "direct_evidence",
  },
] as const;

const REFUSALS = [
  {
    title: "Osoba ≠ firma",
    body: "Ján Novák a Ján Novák s.r.o. majú oddelené entity_id. Konateľstvo, licencia ani podpis samy osebe nedokazujú, kto zbrane prevzal.",
  },
  {
    title: "OCR nie je druhý svedok",
    body: "Originál, pracovný OCR a prepis z tej istej zápisnice zdieľajú source_group_id. To nie je nezávislé potvrdenie.",
  },
  {
    title: "Dátum sa neopravuje",
    body: "Zápis „12.01.2026/2025“ ostáva dateConflict. Model si nevyberie pohodlnejší rok.",
  },
  {
    title: "Platiteľ faktúry ≠ zdroj peňazí",
    body: "invoice_payer, cash_payer, account_holder a funding_source sú štyri rôzne role. Zmes ich nesmie zlievať.",
  },
];

const QUESTIONS = [
  {
    n: "01",
    id: "weapons_flow",
    q: "Kto zbrane objednal, zaplatil, fyzicky prevzal a komu ich mal odovzdať?",
  },
  {
    n: "02",
    id: "plan_author",
    q: "Kto plán navrhol, riadil alebo koordinoval — a čo z toho je len funkcia v firme?",
  },
  {
    n: "03",
    id: "financing",
    q: "Kto faktúru uhradil a kto, ak vôbec niekto, dodal peniaze?",
  },
];

const TAXONOMY = [
  { t: "direct_evidence", d: "listina, kamera, účet — citujeme stranu" },
  { t: "testimony", d: "výpoveď. Nie je fakt, kým ju niečo nedrží." },
  { t: "corroborated", d: "dva nezávislé source_group_id, nie dve kópie" },
  { t: "inference", d: "odvodené; v UI nie ako doložený fakt" },
  { t: "hypothesis", d: "možnosť. confirmed_answer ostáva null" },
];

export function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.add("landing-mode");
    document.body.classList.add("landing-mode");
    const theme = document.querySelector('meta[name="theme-color"]');
    const prev = theme?.getAttribute("content") ?? "#F7F9FC";
    theme?.setAttribute("content", "#07080b");
    return () => {
      document.documentElement.classList.remove("landing-mode");
      document.body.classList.remove("landing-mode");
      theme?.setAttribute("content", prev);
    };
  }, []);

  return (
    <div className="landing" data-testid="home-hero">
      <div
        className="island-safe-zone landing-island"
        aria-hidden="true"
        data-testid="island-safe-zone"
      />

      <header className="landing-nav">
        <p className="landing-mark">
          ForenzDetectiv
          <span> · protokol, nie slogan</span>
        </p>
        <nav className="landing-nav-links" aria-label="Landing">
          <Link to="/spisy">Spisy</Link>
          <Link to="/sherlock" data-testid="home-cta-nav">
            Sherlock
          </Link>
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <p className="landing-kicker">
            ČVS: PP-104/2026 · ilustračný výpočet · nie verdikt
          </p>
          <h1>
            Dve tvrdenia.
            <br />
            Devätnásť minút.
            <br />
            <em>Rýchlosť, ktorú auto nemá.</em>
          </h1>
          <p className="landing-lede">
            Alibi nie je príbeh. Je to kinematika: vzdialenosť delená časom. Keď
            výpoveď vyžaduje 290&nbsp;km/h medzi Nitrou a Bratislavou, padá na
            Newtonovi — nie na tom, kto hovorí plynulejšie.
          </p>
          <div className="landing-cta">
            <button
              type="button"
              className="landing-btn-primary"
              data-testid="home-cta-upload"
              onClick={() => navigate("/sherlock")}
            >
              Analyzovať Linear dôkazy
            </button>
            <button
              type="button"
              className="landing-btn-ghost"
              onClick={() => navigate("/spisy")}
            >
              Otvoriť spisy
            </button>
          </div>
          <p className="landing-legal">
            Neurčíme vinu. Nevydáme právnu kvalifikáciu. Vrátime citát, stranu a
            typ dôkazu — alebo <code>confirmed_answer: null</code>.
          </p>
        </section>

        <aside className="landing-exhibit" aria-label="Ilustračný rozpor">
          <p className="landing-exhibit-label">Príloha A · kinematika alibi</p>
          <table>
            <caption className="sr-only">
              Porovnanie výpovede a kamerového záznamu
            </caption>
            <thead>
              <tr>
                <th>Zdroj</th>
                <th>Miesto</th>
                <th>Čas</th>
                <th>Typ</th>
              </tr>
            </thead>
            <tbody>
              {EXHIBIT_ROWS.map((row) => (
                <tr key={row.time}>
                  <td>{row.claim}</td>
                  <td>{row.locus}</td>
                  <td className="tabular">{row.time}</td>
                  <td>
                    <code>{row.kind}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="landing-phys">
            <div>
              <dt>Δs</dt>
              <dd>~92 km</dd>
            </div>
            <div>
              <dt>Δt</dt>
              <dd>19 min</dd>
            </div>
            <div>
              <dt>v</dt>
              <dd className="landing-phys-fail">290 km/h</dd>
            </div>
          </dl>
          <p className="landing-exhibit-foot">
            Požadovaná priemerná rýchlosť presahuje bežnú cestnú kinematiku.
            Stroju stačí citácia + súradnice. Nepotrebuje názor.
          </p>
        </aside>
      </main>

      <section className="landing-band" aria-labelledby="refuse-h">
        <h2 id="refuse-h">Čo stroj odmieta</h2>
        <p className="landing-band-lede">
          Forenzná AI, ktorá „dopĺňa“ spis, je nebezpečnejšia ako žiadna.
          Tieto štyri veci systém nesmie urobiť — ani keď by to vyzeralo
          uhladenejšie.
        </p>
        <ul className="landing-refuse">
          {REFUSALS.map((item) => (
            <li key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-band landing-band-alt" aria-labelledby="q-h">
        <h2 id="q-h">Tri otázky, ktoré spis musí uniesť</h2>
        <ol className="landing-questions">
          {QUESTIONS.map((item) => (
            <li key={item.id}>
              <span className="landing-q-n">{item.n}</span>
              <div>
                <code>{item.id}</code>
                <p>{item.q}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-band" aria-labelledby="tax-h">
        <h2 id="tax-h">Taxonómia dôkazu</h2>
        <p className="landing-band-lede">
          Každé tvrdenie nesie <code>evidence_type</code>. Hypotéza sa v
          protokole nesmie tváriť ako listina.
        </p>
        <ul className="landing-tax">
          {TAXONOMY.map((item) => (
            <li key={item.t}>
              <code>{item.t}</code>
              <span>{item.d}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="landing-proof" data-testid="home-proof-strip">
        Rozpory <span aria-hidden="true">·</span> Alibi mapa{" "}
        <span aria-hidden="true">·</span> Citát zo zdroja
      </p>

      <footer className="landing-foot">
        <p>
          Linear UBOK je jediný dôkazný sklad. Lokálny upload nie je spis.
          Demo spis sme odstránili — vymyslený spis nie je dôkaz.
        </p>
        <p className="landing-foot-meta">
          ForenzDetectiv · 0.2.0-beta ·{" "}
          <a href="https://forenzdetectiv-web.vercel.app">produkcia</a>
        </p>
      </footer>
    </div>
  );
}
