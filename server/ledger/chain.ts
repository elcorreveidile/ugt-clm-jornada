// Cadena de hashes del registro de cada persona.
//
// Cada anotación guarda la huella (SHA-256) de la anterior. La huella de una
// anotación se calcula sobre su «material» en JSON canónico, que incluye esa
// huella anterior: si alguien cambia o borra una anotación, la huella deja de
// cuadrar con la siguiente y la rotura se detecta. Las huellas además se sellan
// con una autoridad de sellado de tiempo (RFC 3161), que prueba que la cadena
// existía en esa fecha (ver server/tsa).
import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical";

export const GENESIS = "0".repeat(64);
export const HASH_VERSION = 1;

export type EntryMode = "MOMENTO" | "POSTERIOR";

/** Todo lo que se resume en la huella de una anotación. */
export interface HashMaterial {
  v: number;
  user: string;
  seq: number;
  prev: string;
  type: string;
  payload: unknown;
  start: string | null;
  end: string | null;
  recordedAt: string;
  mode: EntryMode;
}

export function materialJson(m: HashMaterial): string {
  return canonicalJson(m);
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function entryHash(m: HashMaterial): string {
  return sha256Hex(materialJson(m));
}

/** Anotación tal como se guarda (lo necesario para verificar la cadena). */
export interface ChainEntry {
  userId: string;
  seq: number;
  prevHash: string;
  hash: string;
  type: string;
  payload: unknown;
  start: string | null;
  end: string | null;
  recordedAt: string;
  mode: EntryMode;
}

export function materialOf(e: ChainEntry): HashMaterial {
  return {
    v: HASH_VERSION,
    user: e.userId,
    seq: e.seq,
    prev: e.prevHash,
    type: e.type,
    payload: e.payload,
    start: e.start,
    end: e.end,
    recordedAt: e.recordedAt,
    mode: e.mode,
  };
}

export type ChainCheck =
  | { ok: true; count: number; head: string }
  | { ok: false; seq: number; reason: string };

/**
 * Comprueba la cadena completa de una persona (ordenada por seq, empezando en 1):
 * numeración sin huecos, enlace con la anterior, huella recalculada y orden temporal.
 */
export function verifyChain(entries: ChainEntry[]): ChainCheck {
  let prev = GENESIS;
  let prevTime = "";
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i + 1) return { ok: false, seq: e.seq, reason: `Falta la anotación nº ${i + 1}` };
    if (e.prevHash !== prev) return { ok: false, seq: e.seq, reason: "No enlaza con la anotación anterior" };
    if (entryHash(materialOf(e)) !== e.hash) return { ok: false, seq: e.seq, reason: "Su contenido no coincide con su huella" };
    if (prevTime && e.recordedAt < prevTime) return { ok: false, seq: e.seq, reason: "Fecha de anotación anterior a la previa" };
    prev = e.hash;
    prevTime = e.recordedAt;
  }
  return { ok: true, count: entries.length, head: prev };
}
