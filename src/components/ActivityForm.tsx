import { useState } from "react";
import {
  CAT_LABEL,
  activitySchema,
  type Activity,
  type ActivityKind,
  type EntryInput,
  type IncidenciaCat,
} from "../../shared/events";
import { fueraDeHorario, localToIso } from "../../shared/centro";
import { etiqueta } from "../../shared/perfiles";
import { useMe } from "../me";
import { hoy } from "../format";
import { Notice } from "./Layout";

export type FormMode = "inicio" | "registro" | "correccion";

export interface FormInitial {
  activity?: Partial<Activity>;
  fecha?: string;
  horaInicio?: string;
  horaFin?: string;
}

export default function ActivityForm({
  mode,
  initial,
  refId,
  busy,
  onSubmit,
  onCancel,
}: {
  mode: FormMode;
  initial?: FormInitial;
  refId?: string;
  busy?: boolean;
  onSubmit: (input: EntryInput) => void;
  onCancel?: () => void;
}) {
  const { perfil, horario } = useMe();
  const a0 = initial?.activity ?? {};
  // Las pausas se fichan con su propio botón; al apuntar después sí se ofrecen.
  const kinds = perfil.kinds.filter((k) => mode !== "inicio" || k !== "PAUSA");
  const [kind, setKind] = useState<ActivityKind>(a0.kind ?? kinds[0]);
  const [cantidad, setCantidad] = useState(a0.cantidad !== undefined ? String(a0.cantidad) : "");
  const [grupo, setGrupo] = useState(a0.grupo ?? "");
  const [aula, setAula] = useState(a0.aula ?? "");
  const [sustituye, setSustituye] = useState(a0.sustituye ?? "");
  const [categoria, setCategoria] = useState<IncidenciaCat | "">(a0.categoria ?? "");
  const [descripcion, setDescripcion] = useState(a0.descripcion ?? "");
  const [fecha, setFecha] = useState(initial?.fecha ?? hoy());
  const [horaInicio, setHoraInicio] = useState(initial?.horaInicio ?? "");
  const [horaFin, setHoraFin] = useState(initial?.horaFin ?? "");
  const [texto, setTexto] = useState(""); // nota o motivo
  const [error, setError] = useState<string | null>(null);

  const conHoras = mode !== "inicio";
  const showGrupo = kind !== "PAUSA" && kind !== "INCIDENCIA";
  const grupoOpcional = kind !== "CLASE" && kind !== "SUSTITUCION";
  const incidencias = perfil.incidencias.includes(categoria as IncidenciaCat) || !categoria ? perfil.incidencias : [...perfil.incidencias, categoria as IncidenciaCat];

  const start = conHoras && fecha && horaInicio ? localToIso(fecha, horaInicio) : null;
  // Si la hora de fin es anterior a la de inicio, termina al día siguiente (turno de noche).
  const nocturno = !!(conHoras && horaInicio && horaFin && horaFin < horaInicio);
  const end =
    conHoras && fecha && horaFin
      ? nocturno
        ? new Date(Date.parse(localToIso(fecha, horaFin)) + 86400_000).toISOString()
        : localToIso(fecha, horaFin)
      : null;
  const fuera = start && kind !== "PAUSA" ? fueraDeHorario(start, end, horario) : false;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const activity = activitySchema.safeParse({
      kind,
      grupo,
      aula,
      sustituye: kind === "SUSTITUCION" ? sustituye : undefined,
      categoria: kind === "INCIDENCIA" ? categoria || undefined : undefined,
      descripcion: kind === "INCIDENCIA" || descripcion ? descripcion : undefined,
      asignacionId: a0.asignacionId,
      cantidad: cantidad.trim() ? Number(cantidad) : undefined,
    });
    if (!activity.success) return setError(activity.error.issues[0]?.message ?? "Revisa los datos");
    if (mode === "inicio") return onSubmit({ type: "INICIO", activity: activity.data });
    if (!start) return setError("Indica la fecha y la hora de inicio");
    if (!end && kind !== "INCIDENCIA") return setError("Indica la hora de fin");
    if (mode === "registro")
      return onSubmit({ type: "REGISTRO", activity: activity.data, start, end: end ?? undefined, nota: texto || undefined });
    if (!texto.trim()) return setError("Explica brevemente el motivo de la corrección");
    onSubmit({ type: "CORRECCION", ref: refId!, activity: activity.data, start, end: end ?? undefined, motivo: texto });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <span className="label">Tipo</span>
        <div className="grid grid-cols-2 gap-2">
          {kinds.map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ring-1 ${kind === k ? "bg-ugt text-white ring-ugt" : "bg-white text-gray-800 ring-gray-300"}`}
            >
              {etiqueta(perfil, k)}
            </button>
          ))}
        </div>
      </div>

      {showGrupo && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="grupo">{perfil.campos.grupo}{grupoOpcional ? " (opcional)" : ""}</label>
            <input id="grupo" className="input" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder={perfil.campos.grupoEj} />
          </div>
          <div>
            <label className="label" htmlFor="aula">{perfil.campos.aula}{grupoOpcional ? " (opcional)" : ""}</label>
            <input id="aula" className="input" value={aula} onChange={(e) => setAula(e.target.value)} placeholder={perfil.campos.aulaEj} />
          </div>
        </div>
      )}

      {kind === "SUSTITUCION" && (
        <div>
          <label className="label" htmlFor="sustituye">¿A quién sustituyes?</label>
          <input id="sustituye" className="input" value={sustituye} onChange={(e) => setSustituye(e.target.value)} />
        </div>
      )}

      {kind === "INCIDENCIA" && (
        <div>
          <label className="label" htmlFor="cat">Qué ha pasado</label>
          <select id="cat" className="input" value={categoria} onChange={(e) => setCategoria(e.target.value as IncidenciaCat)}>
            <option value="">Elige…</option>
            {incidencias.map((c) => (
              <option key={c} value={c}>{CAT_LABEL[c]}</option>
            ))}
          </select>
        </div>
      )}

      {perfil.cantidad && showGrupo && (
        <div>
          <label className="label" htmlFor="cantidad">{perfil.cantidad}</label>
          <input id="cantidad" type="number" inputMode="numeric" min={0} className="input" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </div>
      )}

      <div>
        <label className="label" htmlFor="desc">{kind === "INCIDENCIA" ? "Descripción" : "Observaciones (opcional)"}</label>
        <textarea id="desc" className="input" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </div>

      {conHoras && (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1">
            <label className="label" htmlFor="fecha">Fecha</label>
            <input id="fecha" type="date" className="input" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="hi">Inicio</label>
            <input id="hi" type="time" className="input" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="hf">Fin{kind === "INCIDENCIA" ? " (opc.)" : ""}</label>
            <input id="hf" type="time" className="input" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
          </div>
        </div>
      )}

      {nocturno && <Notice>Termina al día siguiente (turno de noche).</Notice>}

      {fuera && (
        <Notice kind="warn">
          Queda fuera del horario del centro ({horario.apertura}–{horario.cierre}). Se puede apuntar igualmente y saldrá marcado en el informe.
        </Notice>
      )}

      {mode !== "inicio" && (
        <div>
          <label className="label" htmlFor="texto">{mode === "correccion" ? "Motivo de la corrección" : "Por qué lo apuntas ahora (opcional)"}</label>
          <input id="texto" className="input" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
      )}

      {mode !== "inicio" && (
        <p className="text-xs text-gray-500">
          {mode === "correccion"
            ? "La anotación original no se borra: la corrección queda como una anotación nueva y las dos aparecen en el informe."
            : "Quedará marcado como «apuntado después». Fichar en el momento con el botón tiene más fuerza como prueba."}
        </p>
      )}

      {error && <Notice kind="error">{error}</Notice>}

      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy}>
          {mode === "inicio" ? perfil.textos.empezar.replace("Empezar clase", "Empezar ahora") : mode === "registro" ? "Guardar" : "Guardar corrección"}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
        )}
      </div>
    </form>
  );
}
