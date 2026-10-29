import { describe, expect, it } from "vitest";
import catalogoJson from "./generated/catalogo.json";
import type { Catalogo, Evento, Voce } from "./types";
import {
  aggiungi, calendarioIcs, dateRichieste, descriviScadenza, domandeVisibili, flagAttivi,
  scadenzeEvento, scadenzeVisibili, situazione, vociEvento,
} from "./engine";

const catalogo = catalogoJson as Catalogo;
const ids = (vs: { id: string }[]) => vs.map((v) => v.id);

describe("domande", () => {
  it("nasconde le domande che dipendono da risposte negative", () => {
    const visibili = domandeVisibili(catalogo.domande, { occupa_immobile: false });
    expect(ids(visibili)).not.toContain("in_affitto");
  });

  it("ignora le risposte a domande ora nascoste", () => {
    const attivi = flagAttivi(catalogo.domande, { occupa_immobile: false, in_affitto: true });
    expect(attivi.has("in_affitto")).toBe(false);
  });
});

describe("la mia situazione", () => {
  it("senza risposte mostra solo le voci valide per tutti", () => {
    const s = situazione(catalogo, { risposte: {} });
    const perTutti = catalogo.voci.filter((v) => v.quando?.length === 0);
    expect(ids(s.devi)).toEqual([]);
    expect(ids(s.puoi)).toEqual([]);
    expect(ids(s.strumenti)).toEqual(ids(perTutti));
    expect(ids(s.strumenti)).toEqual(expect.arrayContaining(["identita-digitale", "isee", "app-io"]));
  });

  it("gli strumenti per tutti restano separati dai diritti legati alle risposte", () => {
    const s = situazione(catalogo, { risposte: { occupa_immobile: true, in_affitto: true } });
    expect(ids(s.puoi)).toContain("detrazioni-inquilini");
    expect(ids(s.puoi)).not.toContain("identita-digitale");
    expect(ids(s.strumenti)).toContain("identita-digitale");
  });

  it("la patente si rinnova anche senza un veicolo intestato", () => {
    const s = situazione(catalogo, { risposte: { ha_patente: true } });
    expect(ids(s.devi)).toContain("rinnovo-patente");
    expect(ids(s.devi)).not.toContain("bollo-auto");
  });

  it("chi possiede altri immobili paga l'IMU e li dichiara, anche se vive con i genitori", () => {
    const s = situazione(catalogo, { risposte: { occupa_immobile: false, possiede_altri_immobili: true } });
    expect(ids(s.devi)).toEqual(expect.arrayContaining(["imu-altri-immobili", "redditi-immobili-dichiarazione"]));
    expect(ids(s.devi)).not.toContain("tributo-rifiuti");
  });

  it("la registrazione del contratto riguarda solo chi è in affitto", () => {
    const proprietario = situazione(catalogo, { risposte: { occupa_immobile: true, proprietario_abitazione: true } });
    expect(ids(proprietario.devi)).not.toContain("registrazione-contratto-affitto");
    const affitto = situazione(catalogo, { risposte: { occupa_immobile: true, in_affitto: true } });
    expect(ids(affitto.devi)).toContain("registrazione-contratto-affitto");
  });

  it("con un veicolo mostra bollo, RCA e revisione tra i doveri", () => {
    const s = situazione(catalogo, { risposte: { possiede_veicolo: true } });
    expect(ids(s.devi)).toEqual(expect.arrayContaining(["bollo-auto", "rca-obbligatoria", "revisione-veicolo"]));
  });

  it("le detrazioni per l'affitto richiedono casa e affitto", () => {
    const soloCasa = situazione(catalogo, { risposte: { occupa_immobile: true } });
    expect(ids(soloCasa.puoi)).not.toContain("detrazioni-inquilini");
    const affitto = situazione(catalogo, { risposte: { occupa_immobile: true, in_affitto: true } });
    expect(ids(affitto.puoi)).toContain("detrazioni-inquilini");
  });
});

describe("override locali", () => {
  const risposte = { possiede_veicolo: true, occupa_immobile: true };

  it("applica regione e comune quando sono mappati", () => {
    const s = situazione(catalogo, { risposte, regione: "emilia-romagna", comune: "reggio-emilia" });
    const bollo = s.devi.find((v) => v.id === "bollo-auto")!;
    const rifiuti = s.devi.find((v) => v.id === "tributo-rifiuti")!;
    expect(bollo.ente).toBe("Regione Emilia-Romagna");
    expect(bollo.dettaglio_locale_mancante).toBe(false);
    expect(rifiuti.ente).toMatch(/Iren/);
    expect(rifiuti.note_locali[0].luogo).toBe("Reggio Emilia");
    expect(rifiuti.fonti[0].url).toContain("comune.reggioemilia.it");
  });

  it("a Roma applica sia la regione Lazio sia il comune", () => {
    const s = situazione(catalogo, { risposte, regione: "lazio", comune: "roma" });
    const bollo = s.devi.find((v) => v.id === "bollo-auto")!;
    const rifiuti = s.devi.find((v) => v.id === "tributo-rifiuti")!;
    expect(bollo.ente).toBe("Regione Lazio");
    expect(rifiuti.ente).toMatch(/AMA/);
    expect(rifiuti.note_locali[0].luogo).toBe("Roma");
    expect(rifiuti.dettaglio_locale_mancante).toBe(false);
  });

  it("segnala il dettaglio mancante per un luogo non mappato", () => {
    const s = situazione(catalogo, { risposte, regione: "toscana" });
    const bollo = s.devi.find((v) => v.id === "bollo-auto")!;
    expect(bollo.ente).toBe("Regione di residenza");
    expect(bollo.dettaglio_locale_mancante).toBe(true);
  });

  it("ignora un comune che non appartiene alla regione scelta", () => {
    const s = situazione(catalogo, { risposte, regione: "toscana", comune: "reggio-emilia" });
    const rifiuti = s.devi.find((v) => v.id === "tributo-rifiuti")!;
    expect(rifiuti.note_locali).toEqual([]);
  });
});

describe("eventi", () => {
  it("comprare casa ha tutte e tre le fasi", () => {
    const evento = catalogo.eventi.find((e) => e.id === "comprare-casa")!;
    const fasi = vociEvento(catalogo, evento, { risposte: {} });
    expect(Object.keys(fasi)).toEqual(["prima", "durante", "dopo"]);
    expect(ids(fasi.dopo!)).toContain("tributo-rifiuti");
  });

  it("ogni evento risolve tutte le sue voci, senza doppioni tra le fasi", () => {
    for (const evento of catalogo.eventi) {
      const tutte = Object.values(vociEvento(catalogo, evento, { risposte: {} })).flat();
      expect(tutte.every((v) => v?.id)).toBe(true);
      expect(new Set(ids(tutte)).size).toBe(tutte.length);
    }
  });

  it("comprare casa applica gli override in un comune mappato e avvisa in uno non mappato", () => {
    const evento = catalogo.eventi.find((e) => e.id === "comprare-casa")!;
    const rifiuti = (profilo: { regione?: string; comune?: string }) =>
      vociEvento(catalogo, evento, { risposte: {}, ...profilo }).dopo!.find((v) => v.id === "tributo-rifiuti")!;

    const mappato = rifiuti({ regione: "emilia-romagna", comune: "reggio-emilia" });
    expect(mappato.ente).toMatch(/Iren/);
    expect(mappato.dettaglio_locale_mancante).toBe(false);

    const nonMappato = rifiuti({ regione: "emilia-romagna" });
    expect(nonMappato.note_locali).toEqual([]);
    expect(nonMappato.dettaglio_locale_mancante).toBe(true);
  });
});

describe("scadenze", () => {
  const fonte = { titolo: "Fonte di prova", url: "https://www.normattiva.it" };
  const voce = (id: string, maturita: Voce["maturita"]): Voce => ({
    id, titolo: `Voce ${id}`, tipo: "dovere", descrizione: "Descrizione di prova.", ente: "Ente",
    livello_territoriale: "nazionale", fonti: [fonte], verificato_il: maturita === "bozza" ? null : "2026-10-29", maturita,
    scadenze: [
      { titolo: "Dichiara la nascita", dal: "nascita", giorni: 10, fonte },
      { titolo: "Paga la rata, con calma", ogni_anno: "06-16", fonte },
    ],
  });
  const evento: Evento = {
    id: "prova", titolo: "Prova", categoria: "famiglia", descrizione: "Evento di prova.",
    fasi: { durante: ["verificata"], dopo: ["in-bozza"] },
    date: [{ id: "nascita", domanda: "Data di nascita", riferimento: "dalla nascita" }],
  };
  const prova: Catalogo = { ...catalogo, voci: [voce("verificata", "verificata"), voce("in-bozza", "bozza")], eventi: [evento] };

  it("in bozza restano nascoste, anche nel catalogo vero", () => {
    expect(scadenzeVisibili(voce("x", "bozza"), evento)).toEqual([]);
    for (const e of catalogo.eventi) {
      expect(scadenzeEvento(catalogo, e, { nascita: "2026-11-03", rogito: "2026-11-03" }, "2026-10-29")).toEqual([]);
      expect(dateRichieste(catalogo, e)).toEqual([]);
    }
  });

  it("quelle contate da una data valgono solo negli eventi che la chiedono", () => {
    const v = voce("x", "verificata");
    expect(scadenzeVisibili(v, evento).map((s) => s.titolo)).toEqual(["Dichiara la nascita", "Paga la rata, con calma"]);
    expect(scadenzeVisibili(v).map((s) => s.titolo)).toEqual(["Paga la rata, con calma"]);
  });

  it("si descrivono senza bisogno di date", () => {
    const [nascita, rata] = voce("x", "verificata").scadenze!;
    expect(descriviScadenza(nascita, evento)).toBe("entro 10 giorni dalla nascita");
    expect(descriviScadenza(rata)).toBe("ogni anno entro il 16 giugno");
    expect(descriviScadenza({ titolo: "x", ogni_anno: "08-01", fonte })).toBe("ogni anno entro il 1° agosto");
    expect(descriviScadenza({ titolo: "x", dal: "rogito", mesi: 1, fonte })).toBe("entro 1 mese");
  });

  it("conta giorni e mesi senza uscire dal mese", () => {
    expect(aggiungi("2026-12-25", { giorni: 10 })).toBe("2027-01-04");
    expect(aggiungi("2026-01-31", { mesi: 1 })).toBe("2026-02-28");
    expect(aggiungi("2028-01-31", { mesi: 1 })).toBe("2028-02-29");
    expect(aggiungi("2026-05-15", { mesi: 18 })).toBe("2027-11-15");
  });

  it("calcola le date dell'evento in ordine e chiede solo le date che servono", () => {
    expect(dateRichieste(prova, evento).map((d) => d.id)).toEqual(["nascita"]);
    const senzaData = scadenzeEvento(prova, evento, {}, "2026-10-29");
    expect(senzaData.map((s) => [s.data, s.titolo])).toEqual([["2027-06-16", "Paga la rata, con calma"]]);
    const conData = scadenzeEvento(prova, evento, { nascita: "2026-11-03" }, "2026-06-16");
    expect(conData.map((s) => [s.data, s.uid])).toEqual([["2026-06-16", "prova-verificata-1"], ["2026-11-13", "prova-verificata-0"]]);
  });

  it("esporta un calendario .ics valido", () => {
    const ics = calendarioIcs(scadenzeEvento(prova, evento, { nascita: "2026-11-03" }, "2026-10-29"), new Date("2026-10-29T08:30:00Z"));
    const righe = ics.split("\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(righe.filter((r) => r === "BEGIN:VEVENT")).toHaveLength(2);
    expect(righe).toContain("DTSTAMP:20261029T083000Z");
    expect(righe).toContain("DTSTART;VALUE=DATE:20261113");
    expect(righe).toContain("DTEND;VALUE=DATE:20261114");
    expect(righe.filter((r) => r === "RRULE:FREQ=YEARLY")).toHaveLength(1);
    expect(righe).toContain("SUMMARY:Paga la rata\\, con calma");
    expect(righe.every((r) => new TextEncoder().encode(r).length <= 75)).toBe(true);
  });

  it("le tre guide di livello 2 calcolano le scadenze attese quando le voci saranno verificate", () => {
    const verificato: Catalogo = { ...catalogo, voci: catalogo.voci.map((v) => ({ ...v, maturita: "verificata", verificato_il: "2026-10-29" })) };
    const date = (id: string, mie: Record<string, string>) => {
      const e = verificato.eventi.find((x) => x.id === id)!;
      return Object.fromEntries(scadenzeEvento(verificato, e, mie, "2026-10-29").filter((s) => !s.annuale).map((s) => [s.uid, s.data]));
    };

    const casa = verificato.eventi.find((e) => e.id === "comprare-casa")!;
    expect(dateRichieste(verificato, casa).map((d) => d.id)).toEqual(["rogito", "trasferimento"]);
    expect(date("comprare-casa", { rogito: "2026-11-20", trasferimento: "2026-12-01" })).toMatchObject({
      "comprare-casa-residenza-anagrafica-0": "2026-12-21",
      "comprare-casa-agevolazioni-prima-casa-0": "2028-05-20",
      "comprare-casa-detrazione-interessi-mutuo-0": "2027-11-20",
    });
    expect(date("nascita-figlio", { nascita: "2026-11-03" })).toMatchObject({
      "nascita-figlio-dichiarazione-nascita-0": "2026-11-13",
      "nascita-figlio-bonus-nuovi-nati-0": "2027-03-03",
    });
    expect(date("cambio-lavoro", { dimissioni: "2026-11-02" })).toEqual({ "cambio-lavoro-dimissioni-telematiche-0": "2026-11-09" });
  });

  it("spezza le righe lunghe senza rompere le lettere accentate", () => {
    const titolo = "Comunica al nuovo datore di lavoro le detrazioni per i familiari a carico, così non perdi niente è già";
    const [s] = scadenzeEvento(prova, evento, {}, "2026-10-29");
    const ics = calendarioIcs([{ ...s, titolo }], new Date("2026-10-29T08:30:00Z"));
    const righe = ics.split("\r\n");
    expect(righe.every((r) => new TextEncoder().encode(r).length <= 75)).toBe(true);
    // ricomponendo le continuazioni si ritrova il testo intero
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${titolo.replace(",", "\\,")}`);
  });
});
