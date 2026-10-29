import "./style.css";
import catalogoJson from "./generated/catalogo.json";
import type { Catalogo, ElencoComuni, Evento, Fase, Profilo, VoceRisolta } from "./types";
import {
  FASI, calendarioIcs, comuneDelProfilo, comuniDellaRegione, dateRichieste, descriviScadenza, domandeVisibili,
  scadenzeEvento, scadenzeVisibili, situazione, vociEvento,
} from "./engine";
import { cancellaTutto, caricaDate, caricaFatti, caricaProfilo, salvaDate, salvaFatti, salvaProfilo } from "./storage";

const catalogo = catalogoJson as Catalogo;
const app = document.getElementById("app")!;

let profilo: Profilo = caricaProfilo();
let fatti = new Set(caricaFatti());
let date = caricaDate();
/** elenco ISTAT dei comuni: arriva dopo il primo disegno (vedi in fondo) */
let elencoComuni: ElencoComuni | null = null;

// --- piccolo helper per creare elementi senza innerHTML ---
type Figlio = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attr: Record<string, string | boolean | undefined> = {},
  ...figli: Figlio[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (v === false || v === undefined) continue;
    el.setAttribute(k, v === true ? "" : v);
  }
  for (const f of figli) if (f) el.append(f);
  return el;
}

const ETICHETTE_MATURITA: Record<string, string> = {
  bozza: "Bozza da verificare",
  controllata: "Controllata sulle fonti (AI)",
  verificata: "Verificata",
  completa: "Guida completa",
};
const ETICHETTE_FASE: Record<Fase, string> = { prima: "Prima", durante: "Durante", dopo: "Dopo" };
const ETICHETTE_CATEGORIA: Record<string, string> = {
  lavoro: "Lavoro", casa: "Casa", famiglia: "Famiglia", mobilita: "Mobilità", patrimonio: "Patrimonio",
  previdenza: "Previdenza", salute: "Salute", cittadinanza: "Cittadinanza e documenti", fisco: "Rapporti con il fisco", lutto: "Lutto in famiglia",
};

// --- schede voce ---
function schedaVoce(v: VoceRisolta, evento?: Evento): HTMLElement {
  const idCheckbox = `fatto-${v.id}`;
  const casella = h("input", { type: "checkbox", id: idCheckbox, checked: fatti.has(v.id) });
  casella.addEventListener("change", () => {
    casella.checked ? fatti.add(v.id) : fatti.delete(v.id);
    salvaFatti([...fatti]);
    voce.classList.toggle("fatta", casella.checked);
  });

  const comune = elencoComuni ? comuneDelProfilo(elencoComuni, profilo) : undefined;
  const luogoMancante =
    v.dettaglio_locale_mancante &&
    (v.livello_territoriale === "regionale"
      ? h("p", { class: "avviso" }, "Scadenze e modalità cambiano da regione a regione: verifica sul sito della tua Regione.")
      : comune?.[2]
        ? h("p", { class: "avviso" },
            "Modalità e scadenze cambiano da comune a comune: verifica sul ",
            h("a", { href: comune[2], target: "_blank", rel: "noopener" }, `sito del Comune di ${comune[1]}`),
            ".")
        : h("p", { class: "avviso" }, "Modalità e scadenze cambiano da comune a comune: verifica sul sito del tuo Comune."));

  const scadenze = scadenzeVisibili(v, evento);

  const voce = h("li", { class: `voce ${v.tipo}${fatti.has(v.id) ? " fatta" : ""}` },
    h("div", { class: "riga-titolo" },
      casella,
      h("label", { for: idCheckbox }, h("span", { class: "titolo-voce" }, v.titolo)),
    ),
    h("p", { class: "descrizione" }, v.descrizione.trim()),
    v.passi && h("details", { class: "passi" },
      h("summary", {}, "Come si fa"),
      h("ol", {}, ...v.passi.map((p) => h("li", {}, p))),
    ),
    scadenze.length > 0 && h("ul", { class: "scadenze" },
      ...scadenze.map((s) => h("li", {}, h("strong", {}, `${s.titolo}: `), descriviScadenza(s, evento))),
    ),
    ...v.note_locali.map((n) => h("p", { class: "nota-locale" }, h("strong", {}, `${n.luogo}: `), n.testo)),
    luogoMancante,
    h("p", { class: "meta" },
      h("span", {}, v.ente),
      h("span", { class: `maturita ${v.maturita}` }, ETICHETTE_MATURITA[v.maturita]),
    ),
    h("ul", { class: "fonti" },
      ...v.fonti.map((f) => h("li", {}, h("a", { href: f.url, target: "_blank", rel: "noopener" }, f.titolo))),
    ),
  );
  return voce;
}

function elencoVoci(titolo: string, spiegazione: string, voci: VoceRisolta[], classe: string): HTMLElement | null {
  if (!voci.length) return null;
  return h("section", { class: `gruppo ${classe}` },
    h("h3", {}, titolo),
    h("p", { class: "spiegazione" }, spiegazione),
    h("ul", { class: "voci" }, ...voci.map((v) => schedaVoce(v))),
  );
}

// --- La mia situazione ---
function aggiornaProfilo(modifica: (p: Profilo) => void): void {
  modifica(profilo);
  salvaProfilo(profilo);
  // il ridisegno sostituisce i campi: riportiamo il focus dove era, per chi usa la tastiera
  const attivo = document.activeElement as HTMLInputElement | null;
  const selettore = attivo?.name ? `[name="${attivo.name}"][value="${attivo.value}"]` : attivo?.id ? `#${attivo.id}` : null;
  renderSituazione();
  if (selettore) app.querySelector<HTMLElement>(selettore)?.focus();
}

function selettoreLuogo(): HTMLElement {
  const regione = h("select", { id: "regione" },
    h("option", { value: "" }, "Scegli la regione"),
    ...catalogo.regioni.map((r) => h("option", { value: r.id, selected: r.id === profilo.regione }, r.nome)),
  );
  regione.addEventListener("change", () => aggiornaProfilo((p) => { p.regione = regione.value || undefined; p.comune = undefined; }));

  // con l'elenco completo si sceglie qualsiasi comune; finché non arriva, solo quelli con dettagli locali
  const mappati = new Set(comuniDellaRegione(catalogo, profilo.regione).map((c) => c.id));
  const comuni: [string, string][] = elencoComuni
    ? (elencoComuni[profilo.regione ?? ""] ?? []).map(([id, nome]) => [id, mappati.has(id) ? `${nome} (con dettagli locali)` : nome])
    : comuniDellaRegione(catalogo, profilo.regione).map((c) => [c.id, c.nome]);
  const comune = comuni.length
    ? (() => {
        const sel = h("select", { id: "comune" },
          h("option", { value: "" }, elencoComuni ? "Scegli il comune" : "Un altro comune"),
          ...comuni.map(([id, nome]) => h("option", { value: id, selected: id === profilo.comune }, nome)),
        );
        sel.addEventListener("change", () => aggiornaProfilo((p) => { p.comune = sel.value || undefined; }));
        return h("div", { class: "campo" }, h("label", { for: "comune" }, "Comune"), sel);
      })()
    : null;

  return h("fieldset", { class: "luogo" },
    h("legend", {}, "Dove vivi"),
    h("div", { class: "campo" }, h("label", { for: "regione" }, "Regione"), regione),
    comune,
  );
}

function domandaSiNo(id: string, testo: string, aiuto?: string): HTMLElement {
  const valore = profilo.risposte[id];
  const opzione = (v: boolean, etichetta: string) => {
    const input = h("input", { type: "radio", name: id, value: String(v), checked: valore === v });
    input.addEventListener("change", () => aggiornaProfilo((p) => { p.risposte[id] = v; }));
    return h("label", { class: "opzione" }, input, etichetta);
  };
  return h("fieldset", { class: "domanda" },
    h("legend", {}, testo),
    aiuto && h("p", { class: "aiuto" }, aiuto),
    h("div", { class: "opzioni" }, opzione(true, "Sì"), opzione(false, "No")),
  );
}

function renderSituazione(): void {
  const s = situazione(catalogo, profilo);
  const domande = domandeVisibili(catalogo.domande, profilo.risposte);
  app.replaceChildren(
    h("div", { class: "due-colonne" },
      h("form", { class: "questionario", "aria-label": "Le tue risposte" },
        h("h2", {}, "Rispondi a poche domande"),
        selettoreLuogo(),
        ...domande.map((d) => domandaSiNo(d.id, d.testo, d.aiuto)),
      ),
      h("div", { class: "risultati", "aria-live": "polite" },
        h("h2", {}, "Cosa ti riguarda"),
        elencoVoci("Devi", "Obblighi: se non li rispetti rischi sanzioni.", s.devi, "doveri"),
        elencoVoci("Puoi", "Diritti e agevolazioni: se non li chiedi, li perdi.", s.puoi, "diritti"),
        s.strumenti.length > 0 &&
          h("details", { class: "gruppo strumenti" },
            h("summary", {}, h("h3", {}, `Strumenti di base (${s.strumenti.length})`)),
            h("p", { class: "spiegazione" }, "Valgono per tutti: servono per fare quasi tutto il resto online."),
            h("ul", { class: "voci" }, ...s.strumenti.map((v) => schedaVoce(v))),
          ),
      ),
    ),
  );
}

// --- Sto per… ---
function renderEventi(): void {
  const perCategoria = new Map<string, Evento[]>();
  for (const e of catalogo.eventi) {
    perCategoria.set(e.categoria, [...(perCategoria.get(e.categoria) ?? []), e]);
  }
  app.replaceChildren(
    h("section", { class: "elenco-eventi" },
      h("h2", {}, "Cosa sta per succederti?"),
      h("p", { class: "spiegazione" }, "Scegli un evento: ti diciamo cosa fare prima, durante e dopo."),
      ...[...perCategoria].map(([cat, eventi]) =>
        h("div", { class: "categoria" },
          h("h3", {}, ETICHETTE_CATEGORIA[cat] ?? cat),
          h("ul", {}, ...eventi.map((e) =>
            h("li", {}, h("a", { href: `#evento-${e.id}` }, e.titolo), h("span", { class: "aiuto" }, ` ${e.descrizione}`)))),
        )),
    ),
  );
}

function renderEvento(id: string): void {
  const evento = catalogo.eventi.find((e) => e.id === id);
  if (!evento) return renderEventi();
  const fasi = vociEvento(catalogo, evento, profilo);
  const luogo = profilo.regione ? null : h("p", { class: "avviso" }, "Indica dove vivi in “La mia situazione” per vedere i dettagli locali.");
  app.replaceChildren(
    h("article", { class: "evento" },
      h("p", {}, h("a", { href: "#eventi" }, "Tutti gli eventi")),
      h("h2", {}, evento.titolo),
      h("p", { class: "spiegazione" }, evento.descrizione),
      luogo,
      h("ol", { class: "fasi" },
        ...FASI.filter((f) => fasi[f]).map((f) =>
          h("li", { class: "fase" },
            h("h3", {}, ETICHETTE_FASE[f]),
            h("ul", { class: "voci" }, ...fasi[f]!.map((v) => schedaVoce(v, evento))),
          )),
      ),
      sezioneScadenze(evento),
    ),
  );
}

/** Oggi, AAAA-MM-GG nell'ora locale. */
function oggi(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const formattaData = (data: string) =>
  new Date(`${data}T00:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

function scaricaCalendario(evento: Evento, contenuto: string): void {
  const file = new Blob([contenuto], { type: "text/calendar;charset=utf-8" });
  const link = h("a", { href: URL.createObjectURL(file), download: `${evento.id}.ics` });
  link.click();
  // il download parte in modo asincrono: liberiamo l'URL subito dopo
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function sezioneScadenze(evento: Evento): HTMLElement | null {
  const richieste = dateRichieste(catalogo, evento);
  const mie = date[evento.id] ?? {};
  const scadenze = scadenzeEvento(catalogo, evento, mie, oggi());
  if (!richieste.length && !scadenze.length) return null;

  const campi = richieste.map((d) => {
    const input = h("input", { type: "date", id: `data-${d.id}`, value: mie[d.id] });
    input.addEventListener("change", () => {
      const aggiornate = { ...mie, [d.id]: input.value };
      if (!input.value) delete aggiornate[d.id];
      date = { ...date, [evento.id]: aggiornate };
      salvaDate(date);
      renderEvento(evento.id);
      app.querySelector<HTMLElement>(`#data-${d.id}`)?.focus();
    });
    return h("div", { class: "campo" }, h("label", { for: input.id }, d.domanda), input);
  });

  const scarica = h("button", { type: "button", class: "pulsante", disabled: !scadenze.length }, "Aggiungi al calendario (.ics)");
  scarica.addEventListener("click", () => scaricaCalendario(evento, calendarioIcs(scadenze, new Date())));

  return h("section", { class: "scadenze-evento" },
    h("h3", {}, "Le scadenze"),
    h("p", { class: "spiegazione" }, "Indica le date e scarica il file da importare nel tuo calendario. Le date restano in questo browser."),
    ...campi,
    scadenze.length > 0 && h("ol", { class: "elenco-scadenze" },
      ...scadenze.map((s) => h("li", {},
        h("time", { datetime: s.data }, formattaData(s.data)),
        ` ${s.titolo}${s.annuale ? " (ogni anno)" : ""}`,
      )),
    ),
    richieste.some((d) => !mie[d.id]) && h("p", { class: "aiuto" }, "Indica le date mancanti per calcolare le altre scadenze."),
    scarica,
  );
}

// --- navigazione ---
function render(): void {
  const hash = location.hash.slice(1) || "situazione";
  const scheda = hash.startsWith("evento-") || hash === "eventi" ? "eventi" : "situazione";
  document.querySelectorAll<HTMLAnchorElement>("[data-scheda]").forEach((a) => {
    a.toggleAttribute("aria-current", a.dataset.scheda === scheda);
  });
  if (hash.startsWith("evento-")) renderEvento(hash.slice("evento-".length));
  else if (hash === "eventi") renderEventi();
  else renderSituazione();
}

window.addEventListener("hashchange", () => { render(); app.focus(); });
document.getElementById("cancella")!.addEventListener("click", () => {
  cancellaTutto();
  profilo = { risposte: {} };
  fatti = new Set();
  date = {};
  render();
});

render();

// l'elenco dei comuni pesa: arriva in un file a parte, sempre intero, così nessuno sa quale regione interessa
import("./generated/comuni.json")
  .then((m) => {
    elencoComuni = m.default as unknown as ElencoComuni;
    render();
  })
  .catch(() => {
    /* restano i comuni con dettagli locali */
  });
