import type {
  Catalogo, ComuneElenco, DataEvento, Domanda, ElencoComuni, Evento, Fase, FileLocale, Fonte, Profilo, Scadenza, Voce, VoceRisolta,
} from "./types";

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

/** Il comune del profilo nell'elenco ufficiale, se c'è. */
export function comuneDelProfilo(elenco: ElencoComuni, profilo: Profilo): ComuneElenco | undefined {
  if (!profilo.regione || !profilo.comune) return undefined;
  return elenco[profilo.regione]?.find(([id]) => id === profilo.comune);
}

// --- scadenze e calendario ---

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/**
 * Scadenze da mostrare per una voce. In bozza nessuna: giorni e date non sono ancora controllati sulla fonte.
 * Quelle contate da una data (`dal`) valgono solo dentro un evento che chiede quella data.
 */
export function scadenzeVisibili(voce: Voce, evento?: Evento): Scadenza[] {
  if (voce.maturita === "bozza") return [];
  const date = new Set((evento?.date ?? []).map((d) => d.id));
  return (voce.scadenze ?? []).filter((s) => s.ogni_anno !== undefined || date.has(s.dal!));
}

/** «ogni anno entro il 16 giugno», «entro 10 giorni dalla nascita» */
export function descriviScadenza(s: Scadenza, evento?: Evento): string {
  if (s.ogni_anno) {
    const [mese, giorno] = s.ogni_anno.split("-").map(Number);
    const articolo = giorno === 8 || giorno === 11 ? "l'" : "il ";
    return `ogni anno entro ${articolo}${giorno === 1 ? "1°" : giorno} ${MESI[mese - 1]}`;
  }
  const quanti = s.giorni !== undefined
    ? `${s.giorni} ${s.giorni === 1 ? "giorno" : "giorni"}`
    : `${s.mesi} ${s.mesi === 1 ? "mese" : "mesi"}`;
  const riferimento = evento?.date?.find((d) => d.id === s.dal)?.riferimento;
  return riferimento ? `entro ${quanti} ${riferimento}` : `entro ${quanti}`;
}

function daIso(data: string): Date {
  const [anno, mese, giorno] = data.split("-").map(Number);
  return new Date(Date.UTC(anno, mese - 1, giorno));
}

/** Aggiunge giorni o mesi a una data AAAA-MM-GG. Con i mesi si resta nel mese giusto: 31 gennaio + 1 mese = fine febbraio. */
export function aggiungi(data: string, { giorni = 0, mesi = 0 }: { giorni?: number; mesi?: number }): string {
  const d = daIso(data);
  if (mesi) {
    const giorno = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + mesi);
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(giorno, ultimo));
  }
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/** Prossima ricorrenza di una data annuale (MM-GG), oggi compreso. */
function prossimaRicorrenza(meseGiorno: string, oggi: string): string {
  const anno = Number(oggi.slice(0, 4));
  const questAnno = `${anno}-${meseGiorno}`;
  return questAnno >= oggi ? questAnno : `${anno + 1}-${meseGiorno}`;
}

function vociDellEvento(catalogo: Catalogo, evento: Evento): Voce[] {
  const perId = new Map(catalogo.voci.map((v) => [v.id, v]));
  return FASI.flatMap((f) => evento.fasi[f] ?? []).map((id) => perId.get(id)!);
}

/** Le date da chiedere all'utente: solo quelle da cui si conta almeno una scadenza visibile. */
export function dateRichieste(catalogo: Catalogo, evento: Evento): DataEvento[] {
  const usate = new Set(vociDellEvento(catalogo, evento).flatMap((v) => scadenzeVisibili(v, evento).map((s) => s.dal)));
  return (evento.date ?? []).filter((d) => usate.has(d.id));
}

export interface ScadenzaCalcolata {
  /** stabile tra un export e l'altro: reimportando, il calendario aggiorna invece di duplicare */
  uid: string;
  data: string;
  titolo: string;
  voce: string;
  annuale: boolean;
  fonte: Fonte;
}

/**
 * Scadenze visibili dell'evento con la loro data, in ordine.
 * Quelle contate da una data che l'utente non ha ancora indicato restano fuori.
 */
export function scadenzeEvento(catalogo: Catalogo, evento: Evento, dateUtente: Record<string, string>, oggi: string): ScadenzaCalcolata[] {
  const risultato: ScadenzaCalcolata[] = [];
  for (const voce of vociDellEvento(catalogo, evento)) {
    for (const s of scadenzeVisibili(voce, evento)) {
      const inizio = s.dal && dateUtente[s.dal];
      const data = s.ogni_anno ? prossimaRicorrenza(s.ogni_anno, oggi) : inizio ? aggiungi(inizio, s) : null;
      if (!data) continue;
      risultato.push({
        uid: `${evento.id}-${voce.id}-${voce.scadenze!.indexOf(s)}`,
        data,
        titolo: s.titolo,
        voce: voce.titolo,
        annuale: s.ogni_anno !== undefined,
        fonte: s.fonte,
      });
    }
  }
  return risultato.sort((a, b) => a.data.localeCompare(b.data));
}

const testoIcs = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Spezza le righe oltre i 75 byte, come chiede RFC 5545: la continuazione comincia con uno spazio. */
function piega(riga: string): string {
  const byte = (t: string) => new TextEncoder().encode(t).length;
  const parti: string[] = [];
  let corrente = "";
  for (const c of riga) {
    if (byte(corrente + c) > 75) {
      parti.push(corrente);
      corrente = " ";
    }
    corrente += c;
  }
  parti.push(corrente);
  return parti.join("\r\n");
}

/** File .ics con un evento di un giorno per scadenza; quelle annuali si ripetono ogni anno. */
export function calendarioIcs(scadenze: ScadenzaCalcolata[], adesso: Date): string {
  const timbro = adesso.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const giorno = (data: string) => data.replace(/-/g, "");
  const righe = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//E mo' che faccio?//IT", "CALSCALE:GREGORIAN"];
  for (const s of scadenze) {
    righe.push(
      "BEGIN:VEVENT",
      `UID:${s.uid}@emochefaccio`,
      `DTSTAMP:${timbro}`,
      `DTSTART;VALUE=DATE:${giorno(s.data)}`,
      `DTEND;VALUE=DATE:${giorno(aggiungi(s.data, { giorni: 1 }))}`,
      ...(s.annuale ? ["RRULE:FREQ=YEARLY"] : []),
      `SUMMARY:${testoIcs(s.titolo)}`,
      `DESCRIPTION:${testoIcs(`${s.voce}. Verifica sulla fonte: ${s.fonte.titolo}.`)}`,
      `URL:${s.fonte.url}`,
      "END:VEVENT",
    );
  }
  righe.push("END:VCALENDAR");
  return righe.map(piega).join("\r\n") + "\r\n";
}
