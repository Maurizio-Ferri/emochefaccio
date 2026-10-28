import "./style.css";
import catalogoJson from "./generated/catalogo.json";
import type { Catalogo, Evento, Fase, Profilo, VoceRisolta } from "./types";
import { FASI, comuniDellaRegione, domandeVisibili, situazione, vociEvento } from "./engine";
import { cancellaTutto, caricaFatti, caricaProfilo, salvaFatti, salvaProfilo } from "./storage";

const catalogo = catalogoJson as Catalogo;
const app = document.getElementById("app")!;

let profilo: Profilo = caricaProfilo();
let fatti = new Set(caricaFatti());

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
  verificata: "Verificata",
  completa: "Guida completa",
};
const ETICHETTE_FASE: Record<Fase, string> = { prima: "Prima", durante: "Durante", dopo: "Dopo" };
const ETICHETTE_CATEGORIA: Record<string, string> = {
  lavoro: "Lavoro", casa: "Casa", famiglia: "Famiglia", mobilita: "Mobilità", patrimonio: "Patrimonio",
  previdenza: "Previdenza", salute: "Salute", cittadinanza: "Cittadinanza e documenti", fisco: "Rapporti con il fisco", lutto: "Lutto in famiglia",
};

// --- schede voce ---
function schedaVoce(v: VoceRisolta): HTMLElement {
  const idCheckbox = `fatto-${v.id}`;
  const casella = h("input", { type: "checkbox", id: idCheckbox, checked: fatti.has(v.id) });
  casella.addEventListener("change", () => {
    casella.checked ? fatti.add(v.id) : fatti.delete(v.id);
    salvaFatti([...fatti]);
    voce.classList.toggle("fatta", casella.checked);
  });

  const luogoMancante =
    v.dettaglio_locale_mancante &&
    h("p", { class: "avviso" },
      v.livello_territoriale === "regionale"
        ? "Scadenze e modalità cambiano da regione a regione: verifica sul sito della tua Regione."
        : "Modalità e scadenze cambiano da comune a comune: verifica sul sito del tuo Comune.");

  const voce = h("li", { class: `voce ${v.tipo}${fatti.has(v.id) ? " fatta" : ""}` },
    h("div", { class: "riga-titolo" },
      casella,
      h("label", { for: idCheckbox }, h("span", { class: "titolo-voce" }, v.titolo)),
    ),
    h("p", { class: "descrizione" }, v.descrizione.trim()),
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
    h("ul", { class: "voci" }, ...voci.map(schedaVoce)),
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

  const comuniMappati = comuniDellaRegione(catalogo, profilo.regione);
  const comune = comuniMappati.length
    ? (() => {
        const sel = h("select", { id: "comune" },
          h("option", { value: "" }, "Un altro comune"),
          ...comuniMappati.map((c) => h("option", { value: c.id, selected: c.id === profilo.comune }, c.nome)),
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
            h("ul", { class: "voci" }, ...fasi[f]!.map(schedaVoce)),
          )),
      ),
    ),
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
  render();
});

render();
