# E mo' che faccio? — Documento di progetto

> Versione 0.1 · ottobre 2026 · documento di partenza, da aggiornare man mano

---

## 1. Il problema

Passando dalla scuola al lavoro, andando a vivere da soli o affrontando un evento importante (comprare casa, avere un figlio, aprire una partita IVA) la domanda è sempre la stessa: **"che cosa devo fare?"**.

Le informazioni esistono, ma sono sparse tra decine di enti e scritte per chi sa già cosa cercare. Anche l'AI risponde bene solo se sai quale domanda fare: **se non sai che un obbligo esiste, non lo chiederai mai.**

## 2. La soluzione

Un sito che, con poche domande semplici, ti dice **per punti** cosa devi fare (doveri) e cosa puoi fare (diritti) nei rapporti con lo Stato, rimandando sempre alle fonti ufficiali dove agire.

Il sito **non si sostituisce** allo Stato, a un professionista o al buon senso: orienta, spiega e ricorda.

## 3. Perimetro

### Dentro

Diritti e doveri **amministrativi e tributari** nel rapporto **cittadino ↔ Stato** (Stato centrale, enti previdenziali, Regioni, Comuni).

### Criterio d'ingresso

Una voce entra nel catalogo se:

1. **deriva da una norma**;
2. la controparte è un **ente pubblico**, oppure l'obbligo è **imposto per legge** anche se lo si adempie con un privato (es. RCA auto);
3. non farla comporta una **sanzione** o la **perdita di un diritto**.

### Fuori

- Aziende e professionisti come clienti del servizio: esistono già soluzioni e figure dedicate. La partita IVA del singolo cittadino resta dentro come evento di vita.
- Adempimenti di buona pratica non obbligatori (es. tagliando dell'auto).
- Comportamenti quotidiani senza scadenze (es. come si fa la raccolta differenziata): al massimo un link al gestore.
- Consulenza sul caso specifico.

## 4. Principi guida

- **Zero costi, zero server**: sito statico.
- **Local-first**: i dati dell'utente restano nel suo browser. Nessun account nell'MVP.
- **Nessuna AI a runtime**: le regole sono deterministiche e versionate. L'AI si usa in fase di sviluppo per scrivere codice e bozze di contenuti.
- **Fonte ufficiale obbligatoria** per ogni voce.
- **Onestà sullo stato dei contenuti**: ogni voce mostra il suo livello di maturità.
- **Open source**: codice e contenuti pubblici, contributi tramite GitHub.

## 5. Architettura tecnica

| Componente | Scelta |
|---|---|
| Repository | GitHub, pubblico |
| Licenze | MIT per il codice, CC BY-SA 4.0 per i contenuti |
| Hosting | GitHub Pages (o Cloudflare Pages), gratuito |
| CI/CD | GitHub Actions: validazione contenuti + build + deploy a ogni push su `main` |
| Framework | Da decidere: Astro, Svelte o Vite + vanilla, quello che fa scrivere meno |
| Contenuti | File YAML nel repo, fonte di verità |
| Validazione | JSON Schema; una PR con YAML non valido non passa |
| Build | YAML → JSON statici serviti al client |
| Dati utente | localStorage / IndexedDB, con pulsante "cancella i miei dati" |
| Scadenze | Export `.ics` da importare nel proprio calendario |
| Installabilità | PWA (manifest + offline) |
| Statistiche | Opzionale: GoatCounter o simili, senza tracciamento invasivo |

### Evoluzioni previste (solo se il progetto regge)

- Account opzionale con **sincronizzazione cifrata end-to-end** (modello password manager: chiave derivata dalla password, server che salva solo blob cifrati, chiave di recupero).
- Notifiche con **promemoria "ciechi"**: il server conosce solo data e ID opaco, il contenuto resta cifrato o ricostruito dal client.
- Generazione di un file SQLite in build, interrogabile nel browser (sql.js), se le query diventano complesse.

## 6. Modello dati

### Concetti

- **Profilo**: risposte dell'utente alla modalità "La mia situazione" (flag come `possiede_auto`, `lavoratore_dipendente`, `comune_residenza`).
- **Evento di vita**: qualcosa che sta per succedere o è appena successo ("comprare casa", "nascita di un figlio"). Diviso in fasi: **prima**, **durante**, **dopo**.
- **Voce**: un singolo dovere o diritto.
- **Override locale**: specializzazione regionale o comunale di una voce generica.

### Campi di una voce

| Campo | Descrizione |
|---|---|
| `id` | identificativo univoco |
| `titolo` | breve, in linguaggio semplice |
| `tipo` | `dovere` \| `diritto` |
| `descrizione` | 1-2 righe (livello 1) o testo completo (livello 2) |
| `ente` | chi la gestisce |
| `livello_territoriale` | `nazionale` \| `regionale` \| `comunale` |
| `condizioni` | flag del profilo o fase dell'evento che la attivano |
| `scadenze` | ricorrenti o relative a un evento (solo livello 2) |
| `fonti` | almeno un link a fonte primaria |
| `verificato_il` | data dell'ultima verifica sulla fonte |
| `maturita` | `bozza` \| `verificata` \| `completa` |

### Esempio (struttura, contenuto segnaposto)

```yaml
# eventi/comprare-casa.yaml
id: comprare-casa
titolo: Comprare casa
categoria: casa
fasi:
  prima:
    - agevolazioni-prima-casa
    - verifica-requisiti-mutuo
  durante:
    - imposte-acquisto
  dopo:
    - trasferimento-residenza
    - detrazione-interessi-mutuo
```

```yaml
# voci/agevolazioni-prima-casa.yaml
id: agevolazioni-prima-casa
titolo: Agevolazioni "prima casa"
tipo: diritto
descrizione: >
  Se hai i requisiti, all'acquisto paghi imposte ridotte.
  Verifica requisiti e condizioni sulla fonte ufficiale.
ente: Agenzia delle Entrate
livello_territoriale: nazionale
fonti:
  - titolo: Agenzia delle Entrate — agevolazioni prima casa
    url: <url fonte ufficiale>
verificato_il: null
maturita: bozza
```

```yaml
# locale/comuni/reggio-emilia.yaml
comune: Reggio Emilia
override:
  - voce: tributo-rifiuti
    tipo_prelievo: <tributo | tariffa corrispettiva>
    ente: <Comune | gestore>
    fonti:
      - url: <url fonte ufficiale>
```

### Pattern "obbligo nazionale + override locale"

Una voce generica vale ovunque ("se occupi un immobile devi dichiararlo e pagare il prelievo sui rifiuti"). Se il comune dell'utente è mappato, l'override aggiunge ente, modalità e scadenze locali. Altrimenti l'utente vede la voce generica con l'invito a verificare sul sito del proprio comune. Lo stesso pattern vale per bollo auto (regionale), IMU, addizionali IRPEF, TARI.

## 7. Modalità d'uso

1. **"La mia situazione"**: questionario breve → elenco di doveri e diritti attivi oggi, divisi tra "devi" e "puoi".
2. **"Sto per…"**: esplorazione di un evento di vita futuro → cosa fare prima, durante e dopo.

## 8. Livelli di maturità dei contenuti

| Livello | Contenuto | Etichetta |
|---|---|---|
| **1 — Catalogo** | titolo, 1-2 righe, ente, fonte | `bozza` → `verificata` |
| **2 — Guida completa** | passi, scadenze, override locali, `.ics` | `completa` |

Obiettivo MVP: **ampiezza al livello 1**, profondità al livello 2 solo su pochi eventi.

## 9. Regole redazionali

1. **Nessuna voce senza fonte primaria** (enti pubblici, Normattiva, Gazzetta Ufficiale).
2. **Al livello 1 niente numeri precisi** (soglie, importi, percentuali): si dice che la cosa esiste e si rimanda alla fonte. Sono i dati che invecchiano e si sbagliano più facilmente.
3. **`verificato_il` sempre compilato** prima di passare a `verificata`. La verifica consiste nell'aprire la fonte e controllare che dica quello che scriviamo.
4. Le bozze prodotte con l'AI restano `bozza` finché non sono verificate.
5. Linguaggio semplice, frasi brevi, niente gergo non spiegato.
6. Disclaimer visibile su ogni pagina.

### Disclaimer (bozza)

> E mo' che faccio? offre indicazioni orientative e non costituisce consulenza fiscale, legale o amministrativa. Le informazioni possono essere incomplete o non aggiornate: verifica sempre sulle fonti ufficiali indicate o rivolgiti a un professionista.

## 10. Fonti primarie di riferimento

- Agenzia delle Entrate — agenziaentrate.gov.it
- INPS — inps.it
- Normattiva — normattiva.it (portale Open Data per l'accesso strutturato)
- Gazzetta Ufficiale — gazzettaufficiale.it
- Portale dell'Automobilista — ilportaledellautomobilista.it
- ANPR / anagrafe — anagrafenazionale.interno.it
- Ministero della Salute — salute.gov.it
- Regione Emilia-Romagna — regione.emilia-romagna.it
- Siti dei Comuni e dei gestori dei servizi locali

---

## 11. Catalogo dei temi per l'MVP

Temi da trasformare in voci di livello 1. Le singole voci elencate sono **spunti da verificare**, non contenuti già validati.

### 11.1 Strumenti di base (trasversali)

- Codice fiscale e tessera sanitaria
- SPID e CIE: cosa sono e a cosa servono
- App IO
- Area riservata e cassetto fiscale dell'Agenzia delle Entrate
- Domicilio digitale (INAD) e PEC
- Fascicolo sanitario elettronico
- ISEE e DSU: cos'è, quando serve, come si ottiene

### 11.2 "La mia situazione" (profilo ricorrente)

**Lavoratore dipendente**
- Certificazione Unica dal datore di lavoro
- Dichiarazione precompilata / modello 730
- Spese detraibili e deducibili da conservare
- Addizionali regionali e comunali

**Possiedo un'auto o una moto**
- Bollo (regionale)
- RCA obbligatoria
- Revisione periodica
- Rinnovo della patente

**Vivo in affitto**
- Residenza e iscrizione anagrafica
- Tributo sui rifiuti (TARI o tariffa corrispettiva)
- Detrazioni per inquilini
- Registrazione del contratto

**Sono proprietario di un immobile**
- IMU (quando è dovuta e quando no)
- Tributo sui rifiuti
- Redditi da immobili in dichiarazione

**Utenze e casa**
- Canone RAI: come si paga, esenzioni

**Possiedo un animale**
- Anagrafe degli animali d'affezione e microchip

### 11.3 "Sto per…" (eventi di vita)

**Lavoro**
- Primo impiego
- Cambio lavoro (TFR, più CU nello stesso anno, conguaglio)
- Dimissioni (procedura telematica)
- Licenziamento e NASpI
- Aprire una partita IVA (regime forfettario, contributi, fatturazione elettronica)
- Prestazione occasionale
- Chiudere una partita IVA
- Lavorare all'estero / frontalieri

**Casa**
- Comprare casa (agevolazioni prima casa, imposte, residenza, catasto, IMU)
- Accendere un mutuo (detrazione interessi)
- Ristrutturare (bonus edilizi, pratiche comunali)
- Affittare un immobile come proprietario (registrazione, cedolare secca, dichiarazione)
- Vendere casa (plusvalenze, agevolazioni da riacquisto)
- Cambiare residenza

**Famiglia**
- Convivenza di fatto (registrazione anagrafica)
- Matrimonio o unione civile (pubblicazioni, regime patrimoniale)
- Nascita di un figlio (dichiarazione di nascita, codice fiscale, pediatra, assegno unico, congedi, bonus)
- Adozione
- Figli a scuola (iscrizioni, detrazioni per spese di istruzione)
- Separazione e divorzio (aspetti fiscali)
- Assistere un familiare non autosufficiente (permessi, agevolazioni)

**Mobilità**
- Comprare un'auto (passaggio di proprietà, documento unico)
- Vendere un'auto
- Rottamare un veicolo
- Trasferirsi all'estero (AIRE, residenza fiscale)
- Rientrare in Italia (regimi per chi rientra)

**Patrimonio e finanza**
- Ricevere un'eredità (dichiarazione di successione, volture)
- Ricevere o fare una donazione
- Investire (regime amministrato e dichiarativo)
- Conti e attività all'estero (quadro RW e imposte collegate)
- Criptovalute in dichiarazione

**Previdenza**
- Estratto conto contributivo INPS
- Previdenza complementare (deducibilità)
- Riscatto della laurea
- Andare in pensione (domanda)

**Salute**
- Scegliere o cambiare medico di base
- Esenzioni dal ticket
- Invalidità civile: come si richiede
- Spese sanitarie in dichiarazione

**Cittadinanza e documenti**
- Rinnovo carta d'identità e passaporto
- Votare (tessera elettorale, voto fuori sede)
- Albi di scrutatori e presidenti di seggio

**Rapporti con il fisco**
- Avviso bonario
- Cartella esattoriale e rateizzazione
- Ravvedimento operoso
- Multe e sanzioni amministrative: pagamento e ricorso

**Lutto in famiglia**
- Adempimenti anagrafici
- Successione
- Pensione di reversibilità

### 11.4 Proposta per il livello 2

Tre eventi da portare a guida completa nell'MVP (da confermare):

1. **Comprare casa**: primo evento di prova dello schema
2. **Nascita di un figlio**
3. **Cambio lavoro**

Override locali iniziali: **Regione Emilia-Romagna**, **Comune di Reggio Emilia** e un secondo comune per testare il meccanismo.

---

## 12. Roadmap

Tempo disponibile: **~4 ore a settimana**, budget zero.

### Fase 0 — Fondamenta (settimane 1-2)

- [ ] Repo GitHub pubblico, licenze, README con scopo, perimetro, criterio d'ingresso e disclaimer
- [ ] Scelta del framework e scaffold
- [ ] Deploy automatico su GitHub Pages

**Fatto quando**: un push su `main` pubblica il sito.

### Fase 1 — Modello dati (settimane 3-4)

- [ ] Schema per profilo, eventi (con fasi), voci, override locali e maturità
- [ ] JSON Schema + validazione in CI
- [ ] Prova sul campo con l'evento "comprare casa"

**Fatto quando**: "comprare casa" passa la validazione senza forzature nello schema.

### Fase 2 — Motore e interfaccia (settimane 5-7)

- [ ] Questionario generato dai dati, non scritto a mano
- [ ] Motore che valuta le condizioni e applica gli override
- [ ] Pagina risultati "devi / puoi" con fonti ed etichette di maturità
- [ ] Modalità "La mia situazione" e "Sto per…"
- [ ] Salvataggio in localStorage e "cancella i miei dati"
- [ ] Test unitari del motore

**Fatto quando**: l'evento di prova produce l'elenco atteso, per un comune mappato e per uno non mappato.

### Fase 3 — Catalogo (settimane 8-16)

- [ ] 20-25 eventi e il profilo ricorrente al livello 1
- [ ] 3 eventi al livello 2
- [ ] Override per Emilia-Romagna e comuni di prova
- [ ] Flusso di lavoro: bozza YAML preparata con l'AI → verifica della fonte → `verificata`

**Fatto quando**: il catalogo è navigabile e tutte le voci pubblicate hanno una fonte primaria.

### Fase 4 — Rifinitura (settimane 17-18)

- [ ] Export `.ics`
- [ ] PWA installabile e offline
- [ ] Controllo da mobile e accessibilità di base
- [ ] Template issue: "segnala un errore", "proponi una voce"

**Fatto quando**: una persona esterna lo usa da telefono e importa le scadenze senza aiuto.

### Fase 5 — Validazione (settimane 19-22)

- [ ] Prova con 5-10 persone che stanno vivendo o hanno vissuto di recente un passaggio
- [ ] Domanda chiave: *"hai scoperto qualcosa che non sapevi di dover fare?"*
- [ ] Post su r/ItaliaPersonalFinance o r/italy
- [ ] Raccolta di feedback e issue

### Punto di decisione (~6 mesi)

- **Stop** se nessuno torna e nessuno segnala nulla: resta un progetto da portfolio.
- **Continua** se arrivano feedback, issue o contributi spontanei.

### Fase 6+ — Crescita (solo se il progetto regge)

1. Altri eventi e più voci al livello 2
2. Altri comuni e regioni, soprattutto tramite contributi della community
3. Agente che monitora Normattiva e le novità dell'Agenzia delle Entrate e **apre PR** da revisionare (mai pubblicazione automatica)
4. Revisione da parte di un esperto (commercialista, CAF)
5. Account opzionale con sincronizzazione cifrata end-to-end
6. Notifiche push con promemoria "ciechi"

---

## 13. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Informazioni errate o superate | Fonte primaria obbligatoria, niente numeri al livello 1, `verificato_il`, etichetta di maturità, disclaimer |
| Variabilità locale ingestibile | Pattern nazionale + override, fallback "verifica sul sito del tuo comune" |
| Tempo limitato | Sito statico senza backend, priorità all'ampiezza al livello 1 |
| Calo di motivazione | Eventi utili a chi sviluppa il progetto, traguardi brevi con "fatto quando" |
| Privacy | Nessun dato lato server nell'MVP |
| Responsabilità | Il sito orienta e rimanda alle fonti, non si sostituisce a enti o professionisti |

## 14. Decisioni aperte

- [ ] Framework front-end
- [x] Nome: "E mo' che faccio?" (repo `emochefaccio`)
- [ ] Dominio proprio (per ora `maurizio-ferri.github.io/emochefaccio`)
- [ ] Conferma dei tre eventi di livello 2
- [ ] Secondo comune per testare gli override
- [ ] Statistiche d'uso sì/no
