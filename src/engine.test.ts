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
    const perTutti = catalogo.voci.filter((v) => v.quando?.length === 0);
    expect(ids(s.devi)).toEqual([]);
    expect(ids(s.puoi)).toEqual(ids(perTutti));
    expect(ids(s.puoi)).toEqual(expect.arrayContaining(["identita-digitale", "isee", "app-io"]));
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
