// Legge i contenuti YAML, li valida e genera src/generated/catalogo.json.
// Uso: node scripts/build-content.mjs [--check]
//   --check  valida soltanto, senza scrivere il catalogo (usato in CI sulle PR)

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const content = join(root, "content");
const soloControllo = process.argv.includes("--check");

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
for (const f of readdirSync(join(content, "schema"))) {
  ajv.addSchema(JSON.parse(readFileSync(join(content, "schema", f), "utf8")));
}

const errori = [];
const errore = (file, msg) => errori.push(`${file}: ${msg}`);

function leggi(file) {
  try {
    // JSON_SCHEMA evita conversioni implicite di YAML (date, "no" → false, ecc.)
    return yaml.load(readFileSync(file, "utf8"), { schema: yaml.JSON_SCHEMA });
  } catch (e) {
    errore(file, `YAML non valido: ${e.message}`);
    return null;
  }
}

function leggiJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    errore(basename(file), `JSON non valido o mancante: ${e.message}`);
    return null;
  }
}

function caricaCartella(cartella, schemaId) {
  const dir = join(content, cartella);
  if (!existsSync(dir)) return [];
  const valida = ajv.getSchema(schemaId);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => {
      const file = join(cartella, f);
      const dato = leggi(join(dir, f));
      if (!dato) return null;
      if (!valida(dato)) {
        for (const e of valida.errors) errore(file, `${e.instancePath || "/"} ${e.message}`);
        return null;
      }
      if (dato.id !== basename(f, ".yaml")) errore(file, `l'id "${dato.id}" deve coincidere con il nome del file`);
      return dato;
    })
    .filter(Boolean);
}

// --- caricamento e validazione con JSON Schema ---
const profilo = leggi(join(content, "profilo.yaml"));
const validaProfilo = ajv.getSchema("profilo.schema.json");
if (profilo && !validaProfilo(profilo)) {
  for (const e of validaProfilo.errors) errore("profilo.yaml", `${e.instancePath || "/"} ${e.message}`);
}
const voci = caricaCartella("voci", "voce.schema.json");
const eventi = caricaCartella("eventi", "evento.schema.json");
const regioni = caricaCartella("locale/regioni", "override.schema.json");
const comuni = caricaCartella("locale/comuni", "override.schema.json");

// --- controlli incrociati ---
const idVoci = new Set(voci.map((v) => v.id));
const flag = new Set((profilo?.domande ?? []).map((d) => d.id));
const idRegioni = new Set((profilo?.regioni ?? []).map((r) => r.id));

for (const d of profilo?.domande ?? []) {
  for (const f of d.mostra_se ?? []) {
    if (!flag.has(f)) errore("profilo.yaml", `la domanda "${d.id}" dipende dal flag sconosciuto "${f}"`);
  }
}
for (const v of voci) {
  for (const f of v.quando ?? []) {
    if (!flag.has(f)) errore(`voci/${v.id}.yaml`, `flag sconosciuto in "quando": "${f}"`);
  }
  // finché una persona non verifica la voce, importi, percentuali e termini stanno solo nelle scadenze
  if (v.maturita === "bozza" || v.maturita === "controllata") {
    for (const testo of [v.descrizione, ...(v.passi ?? [])]) {
      const numero = testo.match(/(€\s*\d|\d[\d.,]*\s*(%|€|euro|per cento|giorn|settiman|mes[ei]|ann[oi]\b))/i);
      if (numero) errore(`voci/${v.id}.yaml`, `prima della verifica niente importi, percentuali o termini: "${numero[0]}"`);
    }
  }
  for (const s of v.scadenze ?? []) {
    if (!s.ogni_anno) continue;
    const [mese, giorno] = s.ogni_anno.split("-").map(Number);
    // un anno non bisestile: il 29 febbraio non è una scadenza annuale
    if (new Date(Date.UTC(2025, mese - 1, giorno)).getUTCDate() !== giorno) {
      errore(`voci/${v.id}.yaml`, `scadenza "${s.titolo}": "${s.ogni_anno}" non è una data valida ogni anno`);
    }
  }
}
for (const e of eventi) {
  // una voce compare una sola volta per evento: la pagina usa l'id della voce per la casella "fatto"
  const viste = new Set();
  for (const [fase, elenco] of Object.entries(e.fasi)) {
    for (const id of elenco) {
      if (!idVoci.has(id)) errore(`eventi/${e.id}.yaml`, `fase "${fase}": voce inesistente "${id}"`);
      if (viste.has(id)) errore(`eventi/${e.id}.yaml`, `fase "${fase}": la voce "${id}" compare già in un'altra fase`);
      viste.add(id);
    }
  }
  const idDate = (e.date ?? []).map((d) => d.id);
  if (new Set(idDate).size !== idDate.length) errore(`eventi/${e.id}.yaml`, `id ripetuto in "date"`);
}
// una scadenza "dal" si calcola solo negli eventi che chiedono quella data: almeno uno deve farlo
for (const v of voci) {
  const eventiConVoce = eventi.filter((e) => Object.values(e.fasi).some((elenco) => elenco.includes(v.id)));
  for (const s of v.scadenze ?? []) {
    if (s.dal && !eventiConVoce.some((e) => (e.date ?? []).some((d) => d.id === s.dal))) {
      errore(`voci/${v.id}.yaml`, `scadenza "${s.titolo}": nessun evento che contiene la voce chiede la data "${s.dal}"`);
    }
  }
}
for (const r of regioni) {
  if (r.livello !== "regione") errore(`locale/regioni/${r.id}.yaml`, `livello deve essere "regione"`);
  if (!idRegioni.has(r.id)) errore(`locale/regioni/${r.id}.yaml`, `regione non presente in profilo.yaml`);
}
// elenco ufficiale dei comuni, generato da scripts/aggiorna-comuni.mjs
const elencoComuni = leggiJson(join(content, "comuni.json"));
const comuniPerRegione = elencoComuni?.regioni ?? {};
for (const id of idRegioni) {
  if (!comuniPerRegione[id]?.length) errore("comuni.json", `nessun comune per la regione "${id}"`);
}
for (const [regione, elenco] of Object.entries(comuniPerRegione)) {
  if (!idRegioni.has(regione)) errore("comuni.json", `regione non presente in profilo.yaml: "${regione}"`);
  const ids = new Set();
  for (const voce of elenco) {
    const [id, nome, sito] = voce;
    if (typeof id !== "string" || typeof nome !== "string" || (sito !== undefined && !/^https?:\/\//.test(sito))) {
      errore("comuni.json", `${regione}: voce non valida ${JSON.stringify(voce)}`);
    }
    if (ids.has(id)) errore("comuni.json", `${regione}: id ripetuto "${id}"`);
    ids.add(id);
  }
}
for (const c of comuni) {
  if (c.livello !== "comune") errore(`locale/comuni/${c.id}.yaml`, `livello deve essere "comune"`);
  if (!idRegioni.has(c.regione)) errore(`locale/comuni/${c.id}.yaml`, `regione sconosciuta "${c.regione}"`);
  else if (!(comuniPerRegione[c.regione] ?? []).some(([id]) => id === c.id)) {
    errore(`locale/comuni/${c.id}.yaml`, `"${c.id}" non è nell'elenco ISTAT dei comuni di ${c.regione}`);
  }
}
for (const o of [...regioni, ...comuni]) {
  for (const ov of o.override) {
    if (!idVoci.has(ov.voce)) errore(`locale/${o.id}`, `override di una voce inesistente "${ov.voce}"`);
  }
}

if (errori.length) {
  console.error(`\n✗ ${errori.length} errori nei contenuti:\n`);
  for (const e of errori) console.error("  - " + e);
  process.exit(1);
}

const catalogo = {
  generato_il: new Date().toISOString(),
  domande: profilo.domande,
  regioni: profilo.regioni,
  voci,
  eventi,
  locale: { regioni, comuni },
};

const conteggio = `${voci.length} voci, ${eventi.length} eventi, ${regioni.length} regioni e ${comuni.length} comuni con override`;
if (soloControllo) {
  console.log(`✓ Contenuti validi: ${conteggio}`);
} else {
  mkdirSync(join(root, "src", "generated"), { recursive: true });
  writeFileSync(join(root, "src", "generated", "catalogo.json"), JSON.stringify(catalogo, null, 2));
  // a parte: l'interfaccia lo carica dopo, tutto intero, così non si rivela quale regione interessa
  writeFileSync(join(root, "src", "generated", "comuni.json"), JSON.stringify(comuniPerRegione));
  console.log(`✓ Catalogo generato: ${conteggio}`);
}
