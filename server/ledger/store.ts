// Lectura y escritura del registro en la base de datos.
import type { Entry, Prisma, Stamp } from "@prisma/client";
import { prisma } from "../db";
import { checkEntry, type LedgerEntry } from "../../shared/derive";
import type { EntryInput, EntryType } from "../../shared/events";
import { GENESIS, HASH_VERSION, entryHash, materialJson, type ChainEntry, type EntryMode, type HashMaterial } from "./chain";
import { requestTimestamp } from "../tsa/stamp";

type Row = Entry & { stamp: Stamp | null };

export function toLedger(r: Row): LedgerEntry {
  return {
    id: r.id,
    seq: r.seq,
    type: r.type as EntryType,
    payload: r.payload as Record<string, unknown>,
    start: r.start?.toISOString() ?? null,
    end: r.end?.toISOString() ?? null,
    recordedAt: r.recordedAt.toISOString(),
    mode: r.mode as EntryMode,
    prevHash: r.prevHash,
    hash: r.hash,
    tsa: r.stamp
      ? { genTime: r.stamp.genTime.toISOString(), provider: r.stamp.provider, qualified: r.stamp.qualified }
      : null,
  };
}

export function toChain(r: Row): ChainEntry {
  const l = toLedger(r);
  return { ...l, userId: r.userId };
}

export async function loadRows(userId: string): Promise<Row[]> {
  return prisma.entry.findMany({ where: { userId }, orderBy: { seq: "asc" }, include: { stamp: true } });
}

export class RuleError extends Error {}

/** Lo que se guarda de cada tipo de entrada: datos, horas y modo. */
function shape(input: EntryInput | { type: "HORARIO"; payload: Record<string, unknown> }, now: string) {
  switch (input.type) {
    case "INICIO":
      return { payload: { activity: input.activity }, start: now, end: null, mode: "MOMENTO" as const };
    case "FIN":
      return { payload: { ref: input.ref }, start: null, end: now, mode: "MOMENTO" as const };
    case "REGISTRO":
      return {
        payload: { activity: input.activity, nota: input.nota },
        start: input.start,
        end: input.end ?? null,
        mode: "POSTERIOR" as const,
      };
    case "NO_IMPARTIDA":
      return {
        payload: { grupo: input.grupo, aula: input.aula, motivo: input.motivo, asignacionId: input.asignacionId },
        start: input.start,
        end: input.end,
        mode: "POSTERIOR" as const,
      };
    case "CORRECCION":
      return {
        payload: { ref: input.ref, activity: input.activity, motivo: input.motivo },
        start: input.start,
        end: input.end ?? null,
        mode: "POSTERIOR" as const,
      };
    case "ANULACION":
      return { payload: { ref: input.ref, motivo: input.motivo }, start: null, end: null, mode: "POSTERIOR" as const };
    case "HORARIO":
      return { payload: input.payload, start: null, end: null, mode: "POSTERIOR" as const };
  }
}

/** Quita los `undefined` para que lo guardado en JSON sea idéntico a lo resumido. */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Añade una anotación al final de la cadena de la persona y la sella.
 * Si otra petición añadió a la vez, la clave única (userId, seq) choca y se
 * reintenta con la cadena actualizada.
 */
export async function appendEntry(
  userId: string,
  input: EntryInput | { type: "HORARIO"; payload: Record<string, unknown> },
  opts: { stamp?: boolean } = {},
): Promise<LedgerEntry> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const rows = await loadRows(userId);
    const now = new Date();
    if (input.type !== "HORARIO") {
      const err = checkEntry(rows.map(toLedger), input, now);
      if (err) throw new RuleError(err);
    }
    const last = rows.at(-1);
    // La hora de anotación nunca retrocede respecto a la anterior.
    const recordedAt = new Date(Math.max(now.getTime(), last ? last.recordedAt.getTime() : 0)).toISOString();
    const s = shape(input, recordedAt);
    const material: HashMaterial = {
      v: HASH_VERSION,
      user: userId,
      seq: (last?.seq ?? 0) + 1,
      prev: last?.hash ?? GENESIS,
      type: input.type,
      payload: clean(s.payload),
      start: s.start,
      end: s.end,
      recordedAt,
      mode: s.mode,
    };
    const hash = entryHash(material);
    try {
      const row = await prisma.entry.create({
        data: {
          userId,
          seq: material.seq,
          type: material.type,
          payload: material.payload as Prisma.InputJsonValue,
          start: s.start ? new Date(s.start) : null,
          end: s.end ? new Date(s.end) : null,
          recordedAt: new Date(recordedAt),
          mode: s.mode,
          prevHash: material.prev,
          hash,
          material: materialJson(material),
        },
        include: { stamp: true },
      });
      if (opts.stamp !== false) {
        const stamp = await stampEntry(row.id, hash);
        if (stamp) row.stamp = stamp;
      }
      return toLedger(row);
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("No se pudo añadir la anotación: inténtalo de nuevo.");
}

/** Sella una anotación. No lanza: si la TSA falla, queda pendiente para el cron. */
export async function stampEntry(entryId: string, hash: string): Promise<Stamp | null> {
  try {
    const t = await requestTimestamp(hash);
    return await prisma.stamp.create({
      data: {
        entryId,
        provider: t.provider,
        qualified: t.qualified,
        genTime: new Date(t.genTime),
        serial: t.serial,
        policy: t.policy,
        token: Buffer.from(t.token),
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return null; // ya sellada por otra vía
    console.warn(`[tsa] sin sello para ${entryId}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Sella las anotaciones que se quedaron sin sello (cron o botón). */
export async function stampPending(where: { userId?: string } = {}, limit = 50): Promise<{ done: number; left: number }> {
  const pending = await prisma.entry.findMany({
    where: { ...where, stamp: null, createdAt: { lt: new Date(Date.now() - 30_000) } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, hash: true },
  });
  let done = 0;
  for (const p of pending) if (await stampEntry(p.id, p.hash)) done++;
  return { done, left: pending.length - done };
}
