# Contribuire a E mo' che faccio?

## Cosa entra nel catalogo

Una voce entra se:

1. deriva da una **norma**;
2. la controparte è un **ente pubblico**, oppure l'obbligo è **imposto per legge** anche se lo si adempie con un privato (es. RCA);
3. non farla comporta una **sanzione** o la **perdita di un diritto**.

Restano fuori: servizi per aziende, buone pratiche non obbligatorie, comportamenti quotidiani senza scadenze, consulenza sul caso specifico.

## Regole per scrivere una voce

1. **Almeno una fonte primaria**: enti pubblici, Normattiva, Gazzetta Ufficiale. Niente blog o giornali come unica fonte.
2. **In bozza niente numeri precisi** (importi, soglie, percentuali, giorni): si dice che la cosa esiste e si rimanda alla fonte.
3. **Linguaggio semplice**: frasi brevi, seconda persona, nessun termine tecnico non spiegato.
4. Per passare da `bozza` a `verificata`: apri la fonte, controlla che dica quello che scriviamo e compila `verificato_il` (AAAA-MM-GG).
5. Se una voce cambia da regione a regione o da comune a comune, scrivi la regola generale nella voce e i dettagli in `content/locale/`.

## Aggiungere una voce

1. Crea `content/voci/<id>.yaml` (l'id deve coincidere con il nome del file). Usa una voce esistente come modello.
2. Se deve comparire in "La mia situazione", indica in `quando` i flag di `content/profilo.yaml` che la attivano. `quando: []` = vale per tutti. Senza `quando` compare solo dentro gli eventi.
3. Se fa parte di un evento, aggiungi l'id nella fase giusta di `content/eventi/<evento>.yaml`.
4. `npm run validate` e apri una Pull Request.
