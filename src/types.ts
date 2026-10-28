export type TipoVoce = "dovere" | "diritto";
export type Maturita = "bozza" | "verificata" | "completa";
export type Fase = "prima" | "durante" | "dopo";

export interface Fonte {
  titolo: string;
  url: string;
}

export interface Voce {
  id: string;
  titolo: string;
  tipo: TipoVoce;
  descrizione: string;
  dettagli?: string;
  ente: string;
  livello_territoriale: "nazionale" | "regionale" | "comunale";
  quando?: string[];
  fonti: Fonte[];
  verificato_il?: string | null;
  maturita: Maturita;
}

export interface Evento {
  id: string;
  titolo: string;
  categoria: string;
  descrizione: string;
  fasi: Partial<Record<Fase, string[]>>;
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

export interface Catalogo {
  generato_il: string;
  domande: Domanda[];
  regioni: { id: string; nome: string }[];
  voci: Voce[];
  eventi: Evento[];
  locale: { regioni: FileLocale[]; comuni: FileLocale[] };
}

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
