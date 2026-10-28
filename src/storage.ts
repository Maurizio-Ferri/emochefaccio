import type { Profilo } from "./types";

const CHIAVE_PROFILO = "emochefaccio:profilo";
const CHIAVE_FATTI = "emochefaccio:fatti";

function leggi<T>(chiave: string, predefinito: T): T {
  try {
    const grezzo = localStorage.getItem(chiave);
    return grezzo ? (JSON.parse(grezzo) as T) : predefinito;
  } catch {
    return predefinito;
  }
}

function scrivi(chiave: string, valore: unknown): void {
  try {
    localStorage.setItem(chiave, JSON.stringify(valore));
  } catch {
    // archiviazione non disponibile (navigazione privata, quota piena): il sito funziona lo stesso
  }
}

export const caricaProfilo = (): Profilo => leggi<Profilo>(CHIAVE_PROFILO, { risposte: {} });
export const salvaProfilo = (p: Profilo): void => scrivi(CHIAVE_PROFILO, p);

export const caricaFatti = (): string[] => leggi<string[]>(CHIAVE_FATTI, []);
export const salvaFatti = (ids: string[]): void => scrivi(CHIAVE_FATTI, ids);

export function cancellaTutto(): void {
  try {
    localStorage.removeItem(CHIAVE_PROFILO);
    localStorage.removeItem(CHIAVE_FATTI);
  } catch {
    /* niente da fare */
  }
}
