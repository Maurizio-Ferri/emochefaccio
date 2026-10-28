import { describe, expect, it } from "vitest";
import catalogoJson from "./generated/catalogo.json";
import type { Catalogo } from "./types";
import { domandeVisibili, flagAttivi, situazione, vociEvento } from "./engine";

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
    expect(ids(s.devi)).toEqual([]);
    expect(ids(s.puoi)).toEqual(["identita-digitale"]);
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
    expect(rifiuti.fonti[0].url).toContain("comune.re.it");
  });

  it("segnala il dettaglio mancante per un luogo non mappato", () => {
    const s = situazione(catalogo, { risposte, regione: "lazio" });
    const bollo = s.devi.find((v) => v.id === "bollo-auto")!;
    expect(bollo.ente).toBe("Regione di residenza");
    expect(bollo.dettaglio_locale_mancante).toBe(true);
  });

  it("ignora un comune che non appartiene alla regione scelta", () => {
    const s = situazione(catalogo, { risposte, regione: "lazio", comune: "reggio-emilia" });
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
});
