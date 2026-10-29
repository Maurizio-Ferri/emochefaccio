export type TipoVoce = "dovere" | "diritto";
/** `controllata`: fonti ricontrollate da un controllo automatico (AI); `verificata` e `completa` le assegna una persona. */
export type Maturita = "bozza" | "controllata" | "verificata" | "completa";
export type Fase = "prima" | "durante" | "dopo";

export interface Fonte {
  titolo: string;
  url: string;
}

/** Una scadenza fissa ogni anno (`ogni_anno`, MM-GG) oppure contata da una data chiesta dall'evento (`dal`). */
export interface Scadenza {
  titolo: string;
  ogni_anno?: string;
  dal?: string;
  giorni?: number;
  mesi?: number;
  fonte: Fonte;
}

export interface Voce {
  id: string;
  titolo: string;
  tipo: TipoVoce;
  descrizione: string;
  passi?: string[];
  ente: string;
  livello_territoriale: "nazionale" | "regionale" | "comunale";
  quando?: string[];
  fonti: Fonte[];
  scadenze?: Scadenza[];
  controllato_il?: string | null;
  verificato_il?: string | null;
  maturita: Maturita;
}

export interface DataEvento {
  id: string;
  /** etichetta del campo, es. «Data di nascita» */
  domanda: string;
  /** es. «dalla nascita», come in «entro 10 giorni dalla nascita» */
  riferimento: string;
}

export interface Evento {
  id: string;
  titolo: string;
  categoria: string;
  descrizione: string;
  fasi: Partial<Record<Fase, string[]>>;
  date?: DataEvento[];
}

export interface Domanda {
  id: string;
  testo: string;
  aiuto?: string;
  mostra_se?: string[];
}

export interface OverrideVoce {
  voce: string;
  ente?: string;
  nota_locale?: string;
  fonti?: Fonte[];
  verificato_il?: string | null;
}

export interface FileLocale {
  livello: "regione" | "comune";
  id: string;
  nome: string;
  regione?: string;
  override: OverrideVoce[];
}

/** Un comune dell'elenco ISTAT: id, nome e sito istituzionale (da IndicePA) se noto. */
export type ComuneElenco = [id: string, nome: string, sito?: string];
/** Comuni per regione */
export type ElencoComuni = Record<string, ComuneElenco[]>;

export interface Catalogo {
  generato_il: string;
  domande: Domanda[];
  regioni: { id: string; nome: string }[];
  voci: Voce[];
  eventi: Evento[];
  locale: { regioni: FileLocale[]; comuni: FileLocale[] };
}

/** Date indicate dall'utente, per evento: { "nascita-figlio": { nascita: "2026-11-03" } } */
export type DateEventi = Record<string, Record<string, string>>;

export interface Profilo {
  risposte: Record<string, boolean>;
  regione?: string;
  comune?: string;
}

export interface NotaLocale {
  luogo: string;
  testo: string;
}

export interface VoceRisolta extends Voce {
  note_locali: NotaLocale[];
  /** true se la voce dipende dal territorio ma per il luogo dell'utente non abbiamo ancora dettagli */
  dettaglio_locale_mancante: boolean;
}
