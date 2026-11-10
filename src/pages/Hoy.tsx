import { useEffect, useState } from "react";
import { Link } from "react-router";
import { addEntry, getAsignaciones, getRegistro, updateMe, type Asignacion, type Registro } from "../api";
import ActivityForm, { type FormInitial } from "../components/ActivityForm";
import { Notice } from "../components/Layout";
import ActivityCard from "../components/ActivityCard";
import { clasesDelDia, type ClasePrevista } from "../../shared/planner";
import { localToIso } from "../../shared/centro";
import { isPausa, type ActivityKind, type EntryInput } from "../../shared/events";
import { PERFILES, PERFIL_IDS, etiqueta, type PerfilId } from "../../shared/perfiles";
import { fechaLarga, fechaLocal, hoy } from "../format";
import { useMe } from "../me";

function Cronometro({ desde }: { desde: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const min = Math.max(0, Math.floor((now - Date.parse(desde)) / 60000));
  return <span>{Math.floor(min / 60)} h {String(min % 60).padStart(2, "0")} min</span>;
}

/** Primera vez: cada persona elige su colectivo. */
function ElegirColectivo() {
  const { reload } = useMe();
  const [busy, setBusy] = useState(false);
  async function elegir(id: PerfilId) {
    setBusy(true);
    const h = PERFILES[id].horario;
    await updateMe({ perfil: id, apertura: h.apertura ?? "", cierre: h.cierre ?? "", inicioTarde: h.inicioTarde });
    await reload();
  }
  return (
    <section className="card space-y-3">
      <h1 className="text-lg font-bold">¿En qué trabajas?</h1>
      <p className="text-sm text-gray-600">Así la app usa tus palabras (clase, turno, servicio…). Puedes cambiarlo en Ajustes.</p>
      <div className="grid gap-2">
        {PERFIL_IDS.map((id) => (
          <button key={id} disabled={busy} onClick={() => elegir(id)} className="rounded-xl bg-white p-3 text-left ring-1 ring-gray-300 hover:ring-ugt">
            <p className="font-semibold">{PERFILES[id].nombre}</p>
            <p className="text-sm text-gray-600">{PERFILES[id].descripcion}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function Hoy() {
  const { me, perfil } = useMe();
  const [reg, setReg] = useState<Registro | null>(null);
  const [asig, setAsig] = useState<Asignacion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormInitial | null>(null);
  const [noDada, setNoDada] = useState<ClasePrevista | null>(null);
  const [motivo, setMotivo] = useState("");

  const load = () =>
    Promise.all([getRegistro(), getAsignaciones()])
      .then(([r, a]) => {
        setReg(r);
        setAsig(a.asignaciones);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  if (!me.perfil) return <ElegirColectivo />;

  async function send(input: EntryInput, msg: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const { entry } = await addEntry(input);
      setOk(`${msg} Anotación nº ${entry.seq}${entry.tsa ? ", sellada" : " (el sello se añadirá en breve)"}.`);
      setForm(null);
      setNoDada(null);
      setMotivo("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const fecha = hoy();
  const abiertas = (reg?.activities ?? []).filter((a) => a.status === "EN_CURSO");
  const enCurso = abiertas.find((a) => a.kind === "NO_IMPARTIDA" || !isPausa(a.kind));
  const pausa = abiertas.find((a) => a.kind !== "NO_IMPARTIDA" && isPausa(a.kind));
  const deHoy = (reg?.activities ?? []).filter((a) => fechaLocal(a.start) === fecha && a.status !== "EN_CURSO");
  const previstas = clasesDelDia(asig, fecha).filter(
    (c) =>
      !reg?.activities.some((a) => a.activity?.asignacionId === c.asignacionId && fechaLocal(a.start) === fecha) &&
      !reg?.activities.some((a) => a.status === "NO_IMPARTIDA" && a.grupo === c.grupo && fechaLocal(a.start) === fecha),
  );
  const otros = perfil.kinds.filter((k) => !isPausa(k));
  const empezar = (kind: ActivityKind) => setForm({ activity: { kind } });
  const lugar = (c: ClasePrevista) => [c.grupo && `${perfil.campos.grupo}: ${c.grupo}`, c.aula && `${perfil.campos.aula}: ${c.aula}`].filter(Boolean).join(" · ");

  return (
    <>
      <h1 className="text-xl font-bold first-letter:uppercase">{fechaLarga(fecha)}</h1>
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}
      {!reg && !error && <p className="text-sm text-gray-500">Cargando…</p>}

      {enCurso && (
        <section className="card ring-2 ring-ugt">
          <p className="text-xs font-bold uppercase tracking-wide text-ugt">En curso</p>
          <ActivityCard a={enCurso} bare />
          <p className="mt-1 text-sm text-gray-600">Llevas <Cronometro desde={enCurso.start} /></p>
          {pausa ? (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="text-sm font-semibold text-amber-900">En pausa desde hace <Cronometro desde={pausa.start} /></p>
              <button className="btn-dark mt-2 w-full" disabled={busy} onClick={() => send({ type: "FIN", ref: pausa.rootId }, "Pausa terminada.")}>
                Terminar la pausa
              </button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn-ghost" disabled={busy} onClick={() => send({ type: "INICIO", activity: { kind: "PAUSA" } }, "Pausa empezada.")}>
                Empezar pausa
              </button>
              <button className="btn-dark" disabled={busy} onClick={() => send({ type: "FIN", ref: enCurso.rootId }, "Terminado.")}>
                {perfil.textos.terminar}
              </button>
            </div>
          )}
        </section>
      )}

      {form && !enCurso && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Empezar ahora</h2>
          <ActivityForm mode="inicio" initial={form} busy={busy} onCancel={() => setForm(null)} onSubmit={(i) => send(i, "Empezado.")} />
        </section>
      )}

      {reg && !enCurso && !form && (
        <section className="card space-y-3">
          <h2 className="font-semibold">{perfil.textos.previstosHoy}</h2>
          {previstas.length === 0 && (
            <p className="text-sm text-gray-500">
              No hay nada previsto pendiente para hoy.{" "}
              {asig.length === 0 && <Link className="text-ugt underline" to="/horario">Añade tu {perfil.textos.horarioTitulo.replace("Mi ", "")}</Link>}
            </p>
          )}
          {previstas.map((c) => (
            <div key={c.asignacionId} className="rounded-xl bg-gray-50 p-3">
              <p className="font-medium">{c.horaInicio}–{c.horaFin} · {c.grupo}</p>
              <p className="text-sm text-gray-600">{lugar(c)}</p>
              <div className="mt-2 flex gap-2">
                <button
                  className="btn-primary flex-1"
                  disabled={busy}
                  onClick={() =>
                    send(
                      { type: "INICIO", activity: { kind: perfil.planificado, grupo: c.grupo, aula: c.aula || undefined, asignacionId: c.asignacionId } },
                      "Empezado.",
                    )
                  }
                >
                  {perfil.textos.empezar}
                </button>
                <button className="btn-ghost" onClick={() => setNoDada(c)}>{perfil.textos.noHecho}</button>
              </div>
              {noDada?.asignacionId === c.asignacionId && (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!motivo.trim()) return setError("Indica el motivo");
                    const start = localToIso(fecha, c.horaInicio);
                    // Un turno de noche termina al día siguiente.
                    const endSameDay = localToIso(fecha, c.horaFin);
                    const end = endSameDay > start ? endSameDay : new Date(Date.parse(endSameDay) + 86400_000).toISOString();
                    send(
                      { type: "NO_IMPARTIDA", grupo: c.grupo, aula: c.aula || undefined, start, end, motivo, asignacionId: c.asignacionId },
                      `Apuntado como «${etiqueta(perfil, "NO_IMPARTIDA").toLowerCase()}».`,
                    );
                  }}
                >
                  <label className="label" htmlFor="motivo">{perfil.textos.noHechoMotivo}</label>
                  <input id="motivo" className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <button className="btn-dark w-full" disabled={busy}>Guardar</button>
                </form>
              )}
            </div>
          ))}
        </section>
      )}

      {reg && !enCurso && !form && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Empezar otra cosa</h2>
          <div className="grid grid-cols-2 gap-2">
            {otros.map((k) => (
              <button key={k} className="btn-ghost" onClick={() => empezar(k)}>
                {k === perfil.planificado ? `Otro: ${etiqueta(perfil, k).toLowerCase()}` : etiqueta(perfil, k)}
              </button>
            ))}
          </div>
          <Link to="/apuntar" className="mt-3 block text-center text-sm text-ugt underline">
            Se me olvidó fichar: apuntarlo ahora con sus horas
          </Link>
        </section>
      )}

      {deHoy.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Apuntado hoy</h2>
          {deHoy.map((a) => (
            <ActivityCard key={a.rootId} a={a} />
          ))}
        </section>
      )}
    </>
  );
}
