# E mo' che faccio?

Cosa devi fare e cosa puoi fare nei rapporti con lo Stato italiano, a seconda di come vivi.

Rispondi a poche domande (o scegli un evento come "comprare casa") e ottieni, per punti, i tuoi **doveri** e i tuoi **diritti** amministrativi e tributari, ciascuno con il link alla fonte ufficiale dove agire.

> Indicazioni orientative, non consulenza. Verifica sempre sulle fonti ufficiali indicate.

## Come funziona

- **Sito statico**, nessun server: GitHub Pages.
- **Le tue risposte restano nel tuo browser** (localStorage). Nessun account, nessun dato inviato.
- **I contenuti sono file YAML** in [`content/`](content/), validati con JSON Schema. Ogni modifica passa da una Pull Request: la cronologia di Git è lo storico delle regole.
- Ogni voce ha un **livello di maturità**: `bozza`, `verificata`, `completa`.

Il piano completo del progetto è in [`docs/PIANO.md`](docs/PIANO.md).

## Sviluppo

Serve Node 22.

```bash
npm install
npm run dev        # genera il catalogo e avvia il sito in locale
npm test           # test del motore delle regole
npm run validate   # valida solo i contenuti
npm run build      # build di produzione in dist/
```

## Struttura

```
content/
  schema/            JSON Schema di voci, eventi, profilo e override
  profilo.yaml       domande di "La mia situazione" e regioni
  voci/              un file per ogni dovere o diritto
  eventi/            eventi di vita, divisi in prima / durante / dopo
  locale/regioni/    override regionali (es. bollo auto)
  locale/comuni/     override comunali (es. tributo rifiuti)
scripts/
  build-content.mjs  valida i YAML e genera src/generated/catalogo.json
src/
  engine.ts          motore delle regole (funzioni pure, testate)
  main.ts            interfaccia
```

## Contribuire

Leggi [`CONTRIBUTING.md`](CONTRIBUTING.md). Il modo più semplice è aprire una issue: "Segnala un errore" o "Proponi una voce".

## Licenze

- Codice: [MIT](LICENSE)
- Contenuti in `content/`: [CC BY-SA 4.0](LICENSE-CONTENUTI.md)
