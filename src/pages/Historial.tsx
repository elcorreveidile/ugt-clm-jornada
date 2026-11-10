import { useEffect, useState } from "react";
import { Link } from "react-router";
import { addEntry, getRegistro, type Registro } from "../api";
import ActivityCard from "../components/ActivityCard";
import ActivityForm from "../components/ActivityForm";
import { Notice } from "../components/Layout";
import { tiempos, type DerivedActivity } from "../../shared/derive";
import { avisosLegales } from "../../shared/avisos";
import { ENTRY_LABEL } from "../../shared/events";
import { duracion, fechaHora, fechaLarga, fechaLocal, horaLocal, mesActual, nombreMes, sumarMes } from "../format";

export default function Historial() {
  const [mes, setMes] = useState(mesActual());
  const [reg, setReg] = useState<Registro | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [action, setAction] = useState<{ id: string; kind: "corregir" | "anular" } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => getRegistro().then(setReg).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function send(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setAction(null);
      setMotivo("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const acts = (reg?.activities ?? []).filter((a) => fechaLocal(a.start).startsWith(mes)).sort((a, b) => b.start.localeCompare(a.start));
  const byDay = new Map<string, DerivedActivity[]>();
  for (const a of acts) {
    const d = fechaLocal(a.start);
    byDay.set(d, [...(byDay.get(d) ?? []), a]);
  }
  const t = tiempos(acts);
  const avisos = avisosLegales(acts);
  const entryBySeq = new Map((reg?.entries ?? []).map((e) => [e.seq, e]));

  return (
    <>
      <div className="flex items-center justify-between">
        <button className="btn-ghost px-3" onClick={() => setMes(sumarMes(mes, -1))} aria-label="Mes anterior">‹</button>
        <div className="text-center">
          <h1 className="text-lg font-bold first-letter:uppercase">{nombreMes(mes)}</h1>
          <p className="text-sm text-gray-600">{duracion(t.efectivo)} de trabajo efectivo{t.pausas ? ` · ${duracion(t.pausas)} de pausas` : ""}</p>
        </div>
        <button className="btn-ghost px-3" onClick={() => setMes(sumarMes(mes, 1))} disabled={mes >= mesActual()} aria-label="Mes siguiente">›</button>
      </div>
      <Link to="/apuntar" className="btn-primary w-full">Apuntar algo con sus horas</Link>
      {error && <Notice kind="error">{error}</Notice>}
      {avisos.length > 0 && (
        <Notice kind="warn">
          <strong className="block">Posibles incumplimientos a revisar con tu convenio</strong>
          <ul className="mt-1 list-disc pl-4">
            {avisos.map((a, i) => (
              <li key={i}><span className="first-letter:uppercase">{fechaLarga(a.fecha)}</span>: {a.texto}</li>
            ))}
          </ul>
        </Notice>
      )}
      {reg && acts.length === 0 && <p className="text-center text-sm text-gray-500">No hay nada apuntado este mes.</p>}

      {[...byDay.entries()].map(([dia, list]) => (
        <section key={dia} className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 first-letter:uppercase">{fechaLarga(dia)}</h2>
          {list.map((a) => (
            <ActivityCard key={a.rootId} a={a}>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <button className="text-gray-700 underline" onClick={() => setOpen(open === a.rootId ? null : a.rootId)}>
                  {open === a.rootId ? "Ocultar anotaciones" : "Ver anotaciones y sellos"}
                </button>
                {a.status !== "ANULADA" && a.status !== "EN_CURSO" && (
                  <>
                    <button className="text-ugt underline" onClick={() => setAction({ id: a.rootId, kind: "corregir" })}>Corregir</button>
                    <button className="text-ugt underline" onClick={() => setAction({ id: a.rootId, kind: "anular" })}>Anular</button>
                  </>
                )}
              </div>

              {open === a.rootId && (
                <ol className="mt-3 space-y-2 border-t pt-3">
                  {a.seqs.map((s) => {
                    const e = entryBySeq.get(s)!;
                    return (
                      <li key={s} className="text-xs text-gray-700">
                        <p className="font-semibold">Nº {e.seq} · {ENTRY_LABEL[e.type]} · {e.mode === "MOMENTO" ? "en el momento" : "posterior"}</p>
                        <p>Anotada: {fechaHora(e.recordedAt)}</p>
                        <p>Sello: {e.tsa ? `${fechaHora(e.tsa.genTime)} · ${e.tsa.provider}` : "pendiente"}</p>
                        <p className="mono break-all text-[10px] text-gray-500">{e.hash}</p>
                      </li>
                    );
                  })}
                </ol>
              )}

              {action?.id === a.rootId && action.kind === "corregir" && (
                <div className="mt-3 border-t pt-3">
                  <ActivityForm
                    mode="correccion"
                    refId={a.rootId}
                    busy={busy}
                    initial={{
                      activity: a.activity ?? { kind: "CLASE", grupo: a.grupo ?? "", aula: a.aula ?? "" },
                      fecha: fechaLocal(a.start),
                      horaInicio: horaLocal(a.start),
                      horaFin: a.end ? horaLocal(a.end) : "",
                    }}
                    onCancel={() => setAction(null)}
                    onSubmit={(input) => send(() => addEntry(input))}
                  />
                </div>
              )}

              {action?.id === a.rootId && action.kind === "anular" && (
                <form
                  className="mt-3 space-y-2 border-t pt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!motivo.trim()) return setError("Indica el motivo de la anulación");
                    send(() => addEntry({ type: "ANULACION", ref: a.rootId, motivo }));
                  }}
                >
                  <label className="label" htmlFor={`m-${a.rootId}`}>Motivo de la anulación</label>
                  <input id={`m-${a.rootId}`} className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <p className="text-xs text-gray-500">La actividad no se borra: queda tachada y la anulación figura en el informe.</p>
                  <div className="flex gap-2">
                    <button className="btn-dark flex-1" disabled={busy}>Anular</button>
                    <button type="button" className="btn-ghost" onClick={() => setAction(null)}>Cancelar</button>
                  </div>
                </form>
              )}
            </ActivityCard>
          ))}
        </section>
      ))}
    </>
  );
}
