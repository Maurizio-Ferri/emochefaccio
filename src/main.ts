import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./style.css";
import catalogoJson from "./generated/catalogo.json";
import type { Catalogo, ElencoComuni, Evento, Fase, Profilo, VoceRisolta } from "./types";
import {
  FASI, calendarioIcs, cercaEventi, comuneDelProfilo, comuniDellaRegione, dateRichieste, descriviScadenza, domandeVisibili,
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
/** testo cercato in "Sto per…": resta finché non si ricarica la pagina */
let ricerca = "";

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

// icone a tratto (24×24), disegnate con un solo path ciascuna
const ICONE = {
  freccia: "m9 18 6-6-6-6",
  indietro: "m15 18-6-6 6-6",
  esterno: "M7 17 17 7M8 7h9v9",
  calendario: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  cerca: "m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
  scarica: "M12 3v12m-5-5 5 5 5-5M5 21h14",
  luogo: "M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
};
function icona(nome: keyof typeof ICONE, classe = "size-5"): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2",
    "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: classe,
  })) svg.setAttribute(k, v);
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", ICONE[nome]);
  svg.append(path);
  return svg;
}

// classi Tailwind ricorrenti
const C = {
  scheda: "rounded-2xl border border-linea bg-foglio",
  titoloPagina: "text-2xl font-bold leading-tight tracking-tight sm:text-3xl",
  intro: "mt-2 max-w-2xl text-tenue",
  link: "text-accento underline decoration-1 underline-offset-2 hover:decoration-2",
  campo: "min-h-11 w-full rounded-xl border border-linea bg-foglio px-3 text-base text-inchiostro",
  etichetta: "mb-1 block text-sm font-bold text-tenue",
  avviso: "mt-3 rounded-xl border-l-4 border-avviso-bordo bg-avviso-fondo p-3 text-sm leading-relaxed",
  pulsante:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accento px-5 font-bold text-foglio " +
    "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
};

const ETICHETTE_MATURITA: Record<string, string> = {
  bozza: "Bozza da verificare",
  controllata: "Controllata sulle fonti (AI)",
  verificata: "Verificata",
  completa: "Guida completa",
};
const CLASSI_MATURITA: Record<string, string> = {
  bozza: "border-linea text-tenue",
  controllata: "border-accento/40 bg-accento-fondo text-accento",
  verificata: "border-diritto/40 bg-diritto-fondo text-diritto",
  completa: "border-diritto/40 bg-diritto-fondo text-diritto",
};
const ETICHETTE_FASE: Record<Fase, string> = { prima: "Prima", durante: "Durante", dopo: "Dopo" };
const ETICHETTE_CATEGORIA: Record<string, string> = {
  lavoro: "Lavoro", casa: "Casa", famiglia: "Famiglia", mobilita: "Mobilità", patrimonio: "Patrimonio",
  previdenza: "Previdenza", salute: "Salute", cittadinanza: "Cittadinanza e documenti", fisco: "Rapporti con il fisco", lutto: "Lutto in famiglia",
};

const linkEsterno = (href: string, testo: string) =>
  h("a", { href, target: "_blank", rel: "noopener", class: C.link }, testo);

// --- schede voce ---
function schedaVoce(v: VoceRisolta, evento?: Evento): HTMLElement {
  const idCasella = `fatto-${v.id}`;
  const casella = h("input", {
    type: "checkbox", id: idCasella, checked: fatti.has(v.id),
    class: "mt-0.5 size-5 shrink-0 cursor-pointer accent-inchiostro",
  });
  casella.addEventListener("change", () => {
    casella.checked ? fatti.add(v.id) : fatti.delete(v.id);
    salvaFatti([...fatti]);
    voce.classList.toggle("fatta", casella.checked);
  });

  const comune = elencoComuni ? comuneDelProfilo(elencoComuni, profilo) : undefined;
  const luogoMancante =
    v.dettaglio_locale_mancante &&
    (v.livello_territoriale === "regionale"
      ? h("p", { class: C.avviso }, "Scadenze e modalità cambiano da regione a regione: verifica sul sito della tua Regione.")
      : comune?.[2]
        ? h("p", { class: C.avviso },
            "Modalità e scadenze cambiano da comune a comune: verifica sul ",
            linkEsterno(comune[2], `sito del Comune di ${comune[1]}`),
            ".")
        : h("p", { class: C.avviso }, "Modalità e scadenze cambiano da comune a comune: verifica sul sito del tuo Comune."));

  const scadenze = scadenzeVisibili(v, evento);
  const fondoNote = v.tipo === "dovere" ? "bg-dovere-fondo" : "bg-diritto-fondo";

  const voce = h("li", {
    class: `group ${C.scheda} border-l-4 p-4 transition-opacity sm:p-5 [&.fatta]:opacity-60 ` +
      `${v.tipo === "dovere" ? "border-l-dovere" : "border-l-diritto"}${fatti.has(v.id) ? " fatta" : ""}`,
  },
    h("label", { for: idCasella, class: "flex cursor-pointer items-start gap-3" },
      casella,
      h("span", { class: "text-[1.05rem] font-bold leading-snug group-[.fatta]:line-through" },
        h("span", { class: "sr-only" }, "Fatto: "), v.titolo),
    ),
    h("p", { class: "mt-2 leading-relaxed" }, v.descrizione.trim()),
    v.passi && h("details", { class: "group/passi mt-3 rounded-xl bg-carta px-3" },
      h("summary", { class: "flex min-h-11 cursor-pointer items-center gap-2 font-bold text-accento" },
        icona("freccia", "size-4 transition-transform group-open/passi:rotate-90"), "Come si fa"),
      h("ol", { class: "list-decimal space-y-2 pb-3 pl-6 leading-relaxed marker:font-bold marker:text-tenue" },
        ...v.passi.map((p) => h("li", {}, p))),
    ),
    scadenze.length > 0 && h("ul", { class: "mt-3 space-y-2 rounded-xl border border-linea p-3 text-sm" },
      ...scadenze.map((s) => h("li", { class: "flex gap-2" },
        icona("calendario", "mt-0.5 size-4 shrink-0 text-accento"),
        h("span", {}, h("strong", {}, s.titolo), ` — ${descriviScadenza(s, evento)}`),
      )),
    ),
    ...v.note_locali.map((n) =>
      h("p", { class: `mt-3 rounded-xl ${fondoNote} p-3 text-sm leading-relaxed` }, h("strong", {}, `${n.luogo}: `), n.testo)),
    luogoMancante,
    h("div", { class: "mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-tenue" },
      h("span", {}, v.ente),
      h("span", { class: `rounded-full border px-2.5 py-0.5 text-xs font-bold ${CLASSI_MATURITA[v.maturita]}` }, ETICHETTE_MATURITA[v.maturita]),
    ),
    h("ul", { class: "mt-2 space-y-1 text-sm" },
      ...v.fonti.map((f) => h("li", { class: "flex items-start gap-1.5" },
        icona("esterno", "mt-1 size-3.5 shrink-0 text-tenue"),
        h("a", { href: f.url, target: "_blank", rel: "noopener", class: `${C.link} break-words` }, f.titolo),
      )),
    ),
  );
  return voce;
}

const elencoSchede = (voci: VoceRisolta[], evento?: Evento) =>
  h("ul", { class: "space-y-3" }, ...voci.map((v) => schedaVoce(v, evento)));

function gruppoVoci(id: string, titolo: string, spiegazione: string, voci: VoceRisolta[], colore: string): HTMLElement | null {
  if (!voci.length) return null;
  return h("section", { id, class: "scroll-mt-20" },
    h("h2", { class: `flex items-baseline gap-2 text-xl font-bold sm:text-2xl ${colore}` },
      titolo, h("span", { class: "text-base font-bold text-tenue" }, `(${voci.length})`)),
    h("p", { class: "mb-3 mt-1 text-tenue" }, spiegazione),
    elencoSchede(voci),
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
  if (selettore) app.querySelector<HTMLElement>(selettore)?.focus({ preventScroll: true });
}

function selettoreLuogo(): HTMLElement {
  const regione = h("select", { id: "regione", class: C.campo },
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
        const sel = h("select", { id: "comune", class: C.campo },
          h("option", { value: "" }, elencoComuni ? "Scegli il comune" : "Un altro comune"),
          ...comuni.map(([id, nome]) => h("option", { value: id, selected: id === profilo.comune }, nome)),
        );
        sel.addEventListener("change", () => aggiornaProfilo((p) => { p.comune = sel.value || undefined; }));
        return h("div", {}, h("label", { for: "comune", class: C.etichetta }, "Comune"), sel);
      })()
    : null;

  return h("fieldset", { class: "space-y-3 border-b border-linea pb-5" },
    h("legend", { class: "mb-3 flex items-center gap-2 font-bold" }, icona("luogo", "size-5 text-accento"), "Dove vivi"),
    h("div", {}, h("label", { for: "regione", class: C.etichetta }, "Regione"), regione),
    comune,
  );
}

function domandaSiNo(id: string, testo: string, aiuto?: string): HTMLElement {
  const valore = profilo.risposte[id];
  const opzione = (v: boolean, etichetta: string) => {
    const input = h("input", { type: "radio", name: id, value: String(v), checked: valore === v, class: "sr-only" });
    input.addEventListener("change", () => aggiornaProfilo((p) => { p.risposte[id] = v; }));
    return h("label", {
      class: "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-linea bg-foglio font-bold " +
        "hover:border-inchiostro has-checked:border-inchiostro has-checked:bg-inchiostro has-checked:text-carta " +
        "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-accento",
    }, input, etichetta);
  };
  return h("fieldset", { class: "py-4" },
    h("legend", { class: "float-left w-full font-bold leading-snug" }, testo),
    aiuto && h("p", { class: "clear-both pt-1 text-sm text-tenue" }, aiuto),
    h("div", { class: "clear-both grid grid-cols-2 gap-2 pt-3" }, opzione(true, "Sì"), opzione(false, "No")),
  );
}

/** Pulsante del riepilogo che porta alla sezione: le ancore cambierebbero la scheda (usiamo l'hash per navigare). */
function vaiA(id: string, numero: number, etichetta: string, colore: string): HTMLElement {
  const b = h("button", {
    type: "button", disabled: numero === 0,
    class: `${C.scheda} flex cursor-pointer flex-col items-start p-3 text-left disabled:cursor-default disabled:opacity-60 sm:p-4`,
  },
    h("span", { class: `text-2xl font-bold sm:text-3xl ${colore}` }, String(numero)),
    h("span", { class: "text-sm font-bold text-tenue" }, etichetta),
  );
  b.addEventListener("click", () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  return b;
}

function renderSituazione(): void {
  const s = situazione(catalogo, profilo);
  const domande = domandeVisibili(catalogo.domande, profilo.risposte);
  const risposte = domande.filter((d) => profilo.risposte[d.id] !== undefined).length;

  const versoRisultati = h("button", { type: "button", class: `${C.pulsante} mt-2 w-full lg:hidden` },
    `Vedi cosa ti riguarda (${s.devi.length + s.puoi.length})`);
  versoRisultati.addEventListener("click", () =>
    document.getElementById("risultati")?.scrollIntoView({ behavior: "smooth", block: "start" }));

  app.replaceChildren(
    h("div", { class: "mb-6" },
      h("h2", { class: C.titoloPagina }, "Cosa ti riguarda, a seconda di come vivi"),
      h("p", { class: C.intro }, "Rispondi a poche domande: ti diciamo cosa devi fare e cosa puoi chiedere allo Stato, con le fonti ufficiali."),
    ),
    h("div", { class: "grid items-start gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-10" },
      h("form", {
        class: `${C.scheda} p-4 sm:p-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto`,
        "aria-label": "Le tue risposte",
      },
        h("div", { class: "mb-4 flex items-baseline justify-between gap-3" },
          h("h2", { class: "text-lg font-bold" }, "Le tue risposte"),
          h("span", { class: "text-sm text-tenue" }, `${risposte} di ${domande.length}`),
        ),
        selettoreLuogo(),
        h("div", { class: "divide-y divide-linea" }, ...domande.map((d) => domandaSiNo(d.id, d.testo, d.aiuto))),
        versoRisultati,
      ),
      h("div", { id: "risultati", class: "min-w-0 scroll-mt-20 space-y-8" },
        h("div", {},
          h("p", { class: "sr-only", "aria-live": "polite" },
            `Devi fare ${s.devi.length} cose, puoi chiederne ${s.puoi.length}.`),
          h("div", { class: "grid grid-cols-3 gap-2 sm:gap-3" },
            vaiA("devi", s.devi.length, "Devi", "text-dovere"),
            vaiA("puoi", s.puoi.length, "Puoi", "text-diritto"),
            vaiA("strumenti", s.strumenti.length, "Strumenti", "text-accento"),
          ),
        ),
        s.devi.length + s.puoi.length === 0 &&
          h("p", { class: `${C.scheda} p-4 text-tenue` },
            "Rispondi alle domande: qui compariranno i doveri e i diritti che ti riguardano."),
        gruppoVoci("devi", "Devi", "Obblighi: se non li rispetti rischi sanzioni.", s.devi, "text-dovere"),
        gruppoVoci("puoi", "Puoi", "Diritti e agevolazioni: se non li chiedi, li perdi.", s.puoi, "text-diritto"),
        s.strumenti.length > 0 &&
          h("details", { id: "strumenti", class: "group/strumenti scroll-mt-20" },
            h("summary", { class: "flex min-h-11 cursor-pointer items-center gap-2" },
              icona("freccia", "size-5 text-accento transition-transform group-open/strumenti:rotate-90"),
              h("h2", { class: "text-xl font-bold text-accento sm:text-2xl" }, "Strumenti di base",
                h("span", { class: "ml-2 text-base text-tenue" }, `(${s.strumenti.length})`)),
            ),
            h("p", { class: "mb-3 mt-1 text-tenue" }, "Valgono per tutti: servono per fare quasi tutto il resto online."),
            elencoSchede(s.strumenti),
          ),
      ),
    ),
  );
}

// --- Sto per… ---
function elencoEventi(): HTMLElement {
  const trovati = cercaEventi(catalogo, ricerca, ETICHETTE_CATEGORIA);
  if (!trovati.length) {
    return h("p", { class: `${C.scheda} p-4 text-tenue` }, "Nessun evento trovato. Prova con un'altra parola.");
  }
  const perCategoria = new Map<string, Evento[]>();
  for (const e of trovati) perCategoria.set(e.categoria, [...(perCategoria.get(e.categoria) ?? []), e]);
  return h("div", { class: "space-y-8" },
    ...[...perCategoria].map(([cat, eventi]) =>
      h("section", {},
        h("h3", { class: "mb-3 text-sm font-bold uppercase tracking-wide text-tenue" }, ETICHETTE_CATEGORIA[cat] ?? cat),
        h("ul", { class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" },
          ...eventi.map((e) => h("li", { class: "flex" },
            h("a", {
              href: `#evento-${e.id}`,
              class: `${C.scheda} group flex w-full items-start gap-3 p-4 text-inchiostro no-underline hover:border-accento`,
            },
              h("span", { class: "min-w-0 flex-1" },
                h("span", { class: "block font-bold leading-snug group-hover:text-accento" }, e.titolo),
                h("span", { class: "mt-1 block text-sm leading-snug text-tenue" }, e.descrizione),
              ),
              icona("freccia", "mt-0.5 size-5 shrink-0 text-tenue group-hover:text-accento"),
            ),
          )),
        ),
      )),
  );
}

function renderEventi(): void {
  const cerca = h("input", {
    type: "search", id: "cerca-eventi", value: ricerca, autocomplete: "off",
    placeholder: "Cerca: casa, figlio, pensione…", class: `${C.campo} pl-10`,
  });
  const contenitore = h("div", { "aria-live": "polite" }, elencoEventi());
  cerca.addEventListener("input", () => {
    ricerca = cerca.value;
    contenitore.replaceChildren(elencoEventi());
  });

  app.replaceChildren(
    h("div", { class: "mb-6" },
      h("h2", { class: C.titoloPagina }, "Cosa sta per succederti?"),
      h("p", { class: C.intro }, "Scegli un evento: ti diciamo cosa fare prima, durante e dopo."),
    ),
    h("div", { class: "relative mb-8 max-w-xl" },
      h("label", { for: "cerca-eventi", class: "sr-only" }, "Cerca un evento"),
      icona("cerca", "pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tenue"),
      cerca,
    ),
    contenitore,
  );
}

function renderEvento(id: string): void {
  const evento = catalogo.eventi.find((e) => e.id === id);
  if (!evento) return renderEventi();
  const fasi = vociEvento(catalogo, evento, profilo);
  const luogo = !profilo.regione &&
    h("p", { class: C.avviso },
      "Indica dove vivi in ", h("a", { href: "#situazione", class: C.link }, "La mia situazione"), " per vedere i dettagli locali.");
  const presenti = FASI.filter((f) => fasi[f]);

  app.replaceChildren(
    h("article", { class: "mx-auto max-w-3xl" },
      h("a", { href: "#eventi", class: `${C.link} inline-flex min-h-11 items-center gap-1 font-bold no-underline` },
        icona("indietro", "size-4"), "Tutti gli eventi"),
      h("p", { class: "mt-2 text-sm font-bold uppercase tracking-wide text-tenue" }, ETICHETTE_CATEGORIA[evento.categoria] ?? evento.categoria),
      h("h2", { class: `${C.titoloPagina} mt-1` }, evento.titolo),
      h("p", { class: C.intro }, evento.descrizione),
      luogo,
      h("ol", { class: "mt-8 space-y-10" },
        ...presenti.map((f, i) =>
          h("li", {},
            h("h3", { class: "flex items-center gap-3 text-xl font-bold" },
              h("span", {
                class: "grid size-9 shrink-0 place-items-center rounded-full bg-inchiostro text-base text-carta", "aria-hidden": "true",
              }, String(i + 1)),
              ETICHETTE_FASE[f],
            ),
            h("div", { class: `mt-4 sm:ml-[1.125rem] sm:pl-7 ${i < presenti.length - 1 ? "sm:border-l-2 sm:border-linea" : ""}` },
              elencoSchede(fasi[f]!, evento)),
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
    const input = h("input", { type: "date", id: `data-${d.id}`, value: mie[d.id], class: C.campo });
    input.addEventListener("change", () => {
      const aggiornate = { ...mie, [d.id]: input.value };
      if (!input.value) delete aggiornate[d.id];
      date = { ...date, [evento.id]: aggiornate };
      salvaDate(date);
      renderEvento(evento.id);
      app.querySelector<HTMLElement>(`#data-${d.id}`)?.focus({ preventScroll: true });
    });
    return h("div", {}, h("label", { for: input.id, class: C.etichetta }, d.domanda), input);
  });

  const scarica = h("button", { type: "button", class: `${C.pulsante} w-full sm:w-auto`, disabled: !scadenze.length },
    icona("scarica", "size-5"), "Aggiungi al calendario (.ics)");
  scarica.addEventListener("click", () => scaricaCalendario(evento, calendarioIcs(scadenze, new Date())));

  return h("section", { class: `${C.scheda} mt-12 p-4 sm:p-6` },
    h("h3", { class: "flex items-center gap-2 text-xl font-bold" }, icona("calendario", "size-6 text-accento"), "Le scadenze"),
    h("p", { class: "mt-1 text-sm text-tenue" },
      "Indica le date e scarica il file da importare nel tuo calendario. Le date restano in questo browser."),
    campi.length > 0 && h("div", { class: "mt-4 grid gap-3 sm:grid-cols-2" }, ...campi),
    scadenze.length > 0 && h("ol", { class: "mt-5 divide-y divide-linea border-y border-linea" },
      ...scadenze.map((s) => h("li", { class: "flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4" },
        h("time", { datetime: s.data, class: "shrink-0 font-bold sm:w-40" }, formattaData(s.data)),
        h("span", { class: "leading-snug" }, s.titolo,
          s.annuale && h("span", { class: "ml-2 whitespace-nowrap rounded-full bg-accento-fondo px-2 py-0.5 text-xs font-bold text-accento" }, "ogni anno")),
      )),
    ),
    richieste.some((d) => !mie[d.id]) && h("p", { class: "mt-3 text-sm text-tenue" }, "Indica le date mancanti per calcolare le altre scadenze."),
    h("div", { class: "mt-5" }, scarica),
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

window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
});
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
