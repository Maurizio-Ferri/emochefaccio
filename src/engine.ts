import type { Catalogo, Domanda, Evento, Fase, FileLocale, Profilo, Voce, VoceRisolta } from "./types";

/** Domande da mostrare, date le risposte già date. */
export function domandeVisibili(domande: Domanda[], risposte: Profilo["risposte"]): Domanda[] {
  return domande.filter((d) => (d.mostra_se ?? []).every((f) => risposte[f] === true));
}

/** Flag veri, ignorando le risposte a domande che ora sono nascoste. */
export function flagAttivi(domande: Domanda[], risposte: Profilo["risposte"]): Set<string> {
  const attivi = new Set<string>();
  // le domande sono ordinate: una domanda dipende solo da quelle precedenti
  for (const d of domande) {
    const visibile = (d.mostra_se ?? []).every((f) => attivi.has(f));
    if (visibile && risposte[d.id] === true) attivi.add(d.id);
  }
  return attivi;
}

function localiPerProfilo(catalogo: Catalogo, profilo: Profilo): FileLocale[] {
  const regione = catalogo.locale.regioni.find((r) => r.id === profilo.regione);
  const comune = catalogo.locale.comuni.find((c) => c.id === profilo.comune && c.regione === profilo.regione);
  // dal meno al più specifico: il comune vince sulla regione
  return [regione, comune].filter((x): x is FileLocale => Boolean(x));
}

/** Applica alla voce generica gli override della regione e del comune dell'utente. */
export function risolviVoce(voce: Voce, catalogo: Catalogo, profilo: Profilo): VoceRisolta {
  const risolta: VoceRisolta = { ...voce, fonti: [...voce.fonti], note_locali: [], dettaglio_locale_mancante: false };
  const livelliCoperti = new Set<string>();

  for (const locale of localiPerProfilo(catalogo, profilo)) {
    const ov = locale.override.find((o) => o.voce === voce.id);
    if (!ov) continue;
    livelliCoperti.add(locale.livello === "regione" ? "regionale" : "comunale");
    if (ov.ente) risolta.ente = ov.ente;
    if (ov.nota_locale) risolta.note_locali.push({ luogo: locale.nome, testo: ov.nota_locale.trim() });
    // le fonti locali vengono prima: sono le più utili per agire
    if (ov.fonti) risolta.fonti = [...ov.fonti, ...risolta.fonti];
  }

  if (voce.livello_territoriale !== "nazionale") {
    risolta.dettaglio_locale_mancante = !livelliCoperti.has(voce.livello_territoriale);
  }
  return risolta;
}

export interface Situazione {
  devi: VoceRisolta[];
  puoi: VoceRisolta[];
  /** diritti che valgono per tutti (`quando: []`): strumenti di base come SPID o ISEE */
  strumenti: VoceRisolta[];
}

/** Voci attive per il profilo: quelle con `quando` i cui flag sono tutti veri. */
export function situazione(catalogo: Catalogo, profilo: Profilo): Situazione {
  const attivi = flagAttivi(catalogo.domande, profilo.risposte);
  const voci = catalogo.voci
    .filter((v) => v.quando !== undefined && v.quando.every((f) => attivi.has(f)))
    .map((v) => risolviVoce(v, catalogo, profilo));
  const perTutti = (v: VoceRisolta) => v.quando!.length === 0;
  return {
    devi: voci.filter((v) => v.tipo === "dovere"),
    puoi: voci.filter((v) => v.tipo === "diritto" && !perTutti(v)),
    strumenti: voci.filter((v) => v.tipo === "diritto" && perTutti(v)),
  };
}

export const FASI: Fase[] = ["prima", "durante", "dopo"];

/** Voci di un evento, divise per fase e risolte sul luogo dell'utente. */
export function vociEvento(catalogo: Catalogo, evento: Evento, profilo: Profilo): Partial<Record<Fase, VoceRisolta[]>> {
  const perId = new Map(catalogo.voci.map((v) => [v.id, v]));
  const risultato: Partial<Record<Fase, VoceRisolta[]>> = {};
  for (const fase of FASI) {
    const ids = evento.fasi[fase];
    if (!ids) continue;
    risultato[fase] = ids.map((id) => risolviVoce(perId.get(id)!, catalogo, profilo));
  }
  return risultato;
}

export function comuniDellaRegione(catalogo: Catalogo, regione?: string): FileLocale[] {
  return catalogo.locale.comuni.filter((c) => c.regione === regione);
}
