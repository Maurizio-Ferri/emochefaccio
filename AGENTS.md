# Istruzioni per agenti AI

Progetto: sito statico che elenca doveri e diritti amministrativi e tributari dei cittadini italiani verso lo Stato. Piano completo in `docs/PIANO.md`, regole sui contenuti in `CONTRIBUTING.md`: leggile prima di modificare `content/`.

## Comandi

- `npm run validate`: valida i contenuti. Va eseguito dopo ogni modifica a `content/`.
- `npm test`: test del motore. Va eseguito dopo ogni modifica a `src/engine.ts` o ai contenuti.
- `npm run build`: controllo dei tipi e build.
- `npm run comuni`: riscarica l'elenco dei comuni (ISTAT) e i loro siti (IndicePA) in `content/comuni.json`. Va in rete: lancialo solo quando serve aggiornare l'elenco.

## Regole sui contenuti

- Ogni voce nuova nasce con `maturita: bozza` e `verificato_il: null`. Non passare mai una voce a `verificata` o `completa`: lo fa solo un umano dopo aver controllato la fonte.
- Puoi passare una voce a `controllata`, con `controllato_il`, solo dopo un controllo indipendente sulle fonti: lo fa un agente diverso da quello che ha scritto la bozza, e ogni affermazione, fonte e scadenza deve essere confermata da una pagina ufficiale letta. Se resta un dubbio, la voce rimane in `bozza`. Il sito la mostra come "Controllata sulle fonti (AI)".
- Le fonti devono essere pagine di enti pubblici, Normattiva o Gazzetta Ufficiale. Non inventare URL: se non hai trovato la pagina esatta, usa la home dell'ente e segnalalo nella descrizione della PR.
- In bozza e in `controllata` niente importi, soglie, percentuali o termini in giorni. Unica eccezione: il campo `scadenze` (livello 2), che il sito non mostra finché la voce è in bozza. Ogni scadenza cita la fonte che la fissa.
- Indica nella PR, per ogni voce, se l'informazione è confermata da una fonte letta o è una tua deduzione.

## Codice

- `src/engine.ts` contiene solo funzioni pure: niente DOM, niente localStorage. Ogni nuovo comportamento ha un test in `src/engine.test.ts`.
- Nessun dato dell'utente esce dal browser. Non aggiungere chiamate di rete, analytics o servizi esterni senza una decisione esplicita.
