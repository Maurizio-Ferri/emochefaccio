# Contribuire a E mo' che faccio?

## Cosa entra nel catalogo

Una voce entra se:

1. deriva da una **norma**;
2. la controparte è un **ente pubblico**, oppure l'obbligo è **imposto per legge** anche se lo si adempie con un privato (es. RCA);
3. non farla comporta una **sanzione** o la **perdita di un diritto**.

Restano fuori: servizi per aziende, buone pratiche non obbligatorie, comportamenti quotidiani senza scadenze, consulenza sul caso specifico.

## Regole per scrivere una voce

1. **Almeno una fonte primaria**: enti pubblici, Normattiva, Gazzetta Ufficiale. Niente blog o giornali come unica fonte.
2. **In bozza niente numeri precisi** (importi, soglie, percentuali, giorni): si dice che la cosa esiste e si rimanda alla fonte. `npm run validate` blocca importi, percentuali e termini in `descrizione` e `passi`. Fanno eccezione le `scadenze` (vedi sotto).
3. **Linguaggio semplice**: frasi brevi, seconda persona, nessun termine tecnico non spiegato.
4. Livelli di maturità:
   - `bozza`: appena scritta, da controllare;
   - `controllata`: un controllo automatico (AI), diverso da chi ha scritto la bozza, ha confermato ogni affermazione, fonte e scadenza su pagine ufficiali. Si compila `controllato_il`. Il sito la mostra come "Controllata sulle fonti (AI)";
   - `verificata`: una persona ha aperto le fonti e controllato che dicano quello che scriviamo. Si compila `verificato_il` (AAAA-MM-GG);
   - `completa`: guida di livello 2 verificata da una persona.
5. Se una voce cambia da regione a regione o da comune a comune, scrivi la regola generale nella voce e i dettagli in `content/locale/`. L'id di un comune è quello di `content/comuni.json` (nome ISTAT in minuscolo, con i trattini: `reggio-nell-emilia`).

## Aggiungere una voce

1. Crea `content/voci/<id>.yaml` (l'id deve coincidere con il nome del file). Usa una voce esistente come modello.
2. Se deve comparire in "La mia situazione", indica in `quando` i flag di `content/profilo.yaml` che la attivano. `quando: []` = vale per tutti. Senza `quando` compare solo dentro gli eventi.
3. Se fa parte di un evento, aggiungi l'id nella fase giusta di `content/eventi/<evento>.yaml`.
4. `npm run validate` e apri una Pull Request.

## Portare una voce al livello 2

- `passi`: cosa fare, in ordine, in frasi brevi. Valgono le stesse regole della descrizione.
- `scadenze`: ognuna ha un `titolo` (l'azione), una `fonte` (la norma o la pagina che la fissa) e una data:
  - `ogni_anno: "MM-GG"` per una scadenza fissa ogni anno;
  - `dal` più `giorni` o `mesi` per una scadenza contata da un fatto (`dal: nascita`, `giorni: 10`). La data di partenza la chiede l'evento, nel suo elenco `date` (`id`, `domanda`, `riferimento`). Negli eventi che non chiedono quella data la scadenza non compare.
- Le scadenze contengono giorni e date anche in bozza, ma il sito le mostra e le esporta nel calendario (`.ics`) solo quando la voce è almeno `controllata`. Verificare una voce di livello 2 significa controllare anche ogni scadenza sulla sua fonte.
