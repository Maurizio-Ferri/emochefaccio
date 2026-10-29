# E mo' che faccio?

Cosa devi fare e cosa puoi fare nei rapporti con lo Stato italiano, a seconda di come vivi.

Rispondi a poche domande (o scegli un evento come "comprare casa") e ottieni, per punti, i tuoi **doveri** e i tuoi **diritti** amministrativi e tributari, ciascuno con il link alla fonte ufficiale dove agire.

> Indicazioni orientative, non consulenza. Verifica sempre sulle fonti ufficiali indicate.

## Come funziona

- **Sito statico**, nessun server: GitHub Pages.
- **Le tue risposte restano nel tuo browser** (localStorage). Nessun account, nessun dato inviato.
- **I contenuti sono file YAML** in [`content/`](content/), validati con JSON Schema. Ogni modifica passa da una Pull Request: la cronologia di Git è lo storico delle regole.
- Ogni voce ha un **livello di maturità**: `bozza`, `controllata` (fonti ricontrollate con l'AI), `verificata` e `completa` (controllate da una persona).
- **Tutti i comuni italiani** si possono scegliere: l'elenco viene da ISTAT e il sito di ciascun Comune da IndicePA. I dettagli locali ci sono solo per i comuni in `content/locale/comuni/`.

Il piano completo del progetto è in [`docs/PIANO.md`](docs/PIANO.md).

## Sviluppo

Serve Node 22.

```bash
npm install
npm run dev        # genera il catalogo e avvia il sito in locale
npm test           # test del motore delle regole
npm run validate   # valida solo i contenuti
npm run build      # build di produzione in dist/
npm run comuni     # riscarica l'elenco dei comuni (va in rete)
```

## Struttura

```
content/
  schema/            JSON Schema di voci, eventi, profilo e override
  profilo.yaml       domande di "La mia situazione" e regioni
  comuni.json        elenco ISTAT dei comuni con il sito istituzionale (generato)
  voci/              un file per ogni dovere o diritto
  eventi/            eventi di vita, divisi in prima / durante / dopo
  locale/regioni/    override regionali (es. bollo auto)
  locale/comuni/     override comunali (es. tributo rifiuti)
scripts/
  build-content.mjs  valida i YAML e genera src/generated/catalogo.json e comuni.json
  aggiorna-comuni.mjs  scarica l'elenco dei comuni da ISTAT e IndicePA
src/
  engine.ts          motore delle regole (funzioni pure, testate)
  main.ts            interfaccia
```

## Contribuire

Leggi [`CONTRIBUTING.md`](CONTRIBUTING.md). Il modo più semplice è aprire una issue: "Segnala un errore" o "Proponi una voce".

## Licenze

- Codice: [MIT](LICENSE)
- Contenuti in `content/`: [CC BY-SA 4.0](LICENSE-CONTENUTI.md)
