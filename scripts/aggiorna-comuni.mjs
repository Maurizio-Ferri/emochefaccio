// Scarica l'elenco ufficiale dei comuni (ISTAT) e il sito istituzionale di ciascuno (IndicePA)
// e scrive content/comuni.json. Si lancia a mano quando cambiano i comuni: il build non va in rete.
// Uso: node scripts/aggiorna-comuni.mjs

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ISTAT = "https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv";
const IPA = "https://indicepa.gov.it/ipa-dati/datastore/dump/d09adf99-dc10-4349-8c53-27b1e5aa97b6?format=csv";
const destinazione = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "comuni.json");

/** CSV con campi tra virgolette che possono contenere separatori e a capo. */
function leggiCsv(testo, separatore) {
  const righe = [];
  let riga = [];
  let campo = "";
  let tra = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (tra) {
      if (c === '"' && testo[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') tra = false;
      else campo += c;
    } else if (c === '"') tra = true;
    else if (c === separatore) { riga.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && testo[i + 1] === "\n") i++;
      riga.push(campo); righe.push(riga); riga = []; campo = "";
    } else campo += c;
  }
  if (campo || riga.length) { riga.push(campo); righe.push(riga); }
  const [intestazione, ...dati] = righe.filter((r) => r.some((x) => x.trim()));
  const nomi = intestazione.map((n) => n.replace(/\s+/g, " ").trim());
  return dati.map((r) => Object.fromEntries(nomi.map((n, i) => [n, (r[i] ?? "").trim()])));
}

const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const compatto = (s) => slug(s).replace(/-/g, "");

async function scarica(url, codifica) {
  const risposta = await fetch(url);
  if (!risposta.ok) throw new Error(`${url}: HTTP ${risposta.status}`);
  return new TextDecoder(codifica).decode(await risposta.arrayBuffer());
}

const istat = leggiCsv(await scarica(ISTAT, "latin1"), ";");
const enti = leggiCsv(await scarica(IPA, "utf-8"), ",").filter((e) => e.Codice_Categoria === "L6");

const perCatastale = new Map();
for (const e of enti) perCatastale.set(e.Codice_catastale_comune, [...(perCatastale.get(e.Codice_catastale_comune) ?? []), e]);

/** L'ente IPA del comune: stesso codice catastale e nome che corrisponde; in mancanza, "Comune di <nome>" ovunque. */
function enteDelComune(nome, catastale) {
  const candidati = perCatastale.get(catastale) ?? [];
  const perNome = candidati.filter((e) => compatto(e.Denominazione_ente).includes(compatto(nome)));
  if (perNome.length === 1) return perNome[0];
  const comuni = candidati.filter((e) => /^comune\b/i.test(e.Denominazione_ente));
  if (comuni.length === 1) return comuni[0];
  const altrove = enti.filter((e) => compatto(e.Denominazione_ente) === compatto(`Comune di ${nome}`));
  return altrove.length === 1 ? altrove[0] : null;
}

/** Sito come lo registra IndicePA; senza schema si assume https. Gli indirizzi non validi si scartano. */
function sito(s) {
  if (!s) return undefined;
  const conSchema = /^https?:\/\//i.test(s) ? s.replace(/^https?/i, (m) => m.toLowerCase()) : `https://${s}`;
  try {
    return new URL(conSchema).href.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

const regioni = {};
let senzaSito = 0;
for (const r of istat) {
  const nome = r["Denominazione in italiano"];
  const regione = slug(r["Denominazione Regione"].split("/")[0]);
  const ente = enteDelComune(nome, r["Codice Catastale del comune"]);
  const url = sito(ente?.Sito_istituzionale);
  if (!url) senzaSito++;
  (regioni[regione] ??= []).push(url ? [slug(nome), nome, url] : [slug(nome), nome]);
}
for (const elenco of Object.values(regioni)) elenco.sort((a, b) => a[1].localeCompare(b[1], "it"));

const dati = {
  aggiornato_il: new Date().toISOString().slice(0, 10),
  fonti: [
    { titolo: "ISTAT – Codici statistici delle unità amministrative territoriali", url: ISTAT },
    { titolo: "IndicePA – Enti (sito istituzionale)", url: IPA },
  ],
  // per regione: [id, nome, sito istituzionale se noto]
  regioni: Object.fromEntries(Object.entries(regioni).sort(([a], [b]) => a.localeCompare(b))),
};
writeFileSync(destinazione, JSON.stringify(dati, null, 0).replace(/\],\[/g, "],\n["));
console.log(`✓ ${istat.length} comuni in ${Object.keys(regioni).length} regioni, ${senzaSito} senza sito istituzionale`);
