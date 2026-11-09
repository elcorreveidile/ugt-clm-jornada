import { useEffect, useState } from "react";
import { api, getAsignaciones, type Asignacion } from "../api";
import { Notice } from "../components/Layout";
import ImportarActa from "../components/ImportarActa";
import { fechaCorta } from "../../shared/acta";
import { DIAS, asignacionSchema } from "../../shared/events";
import { useMe } from "../me";
import { hoy } from "../format";

const DIA_NOMBRE: Record<string, string> = { L: "Lun", M: "Mar", X: "Mié", J: "Jue", V: "Vie", S: "Sáb", D: "Dom" };

const vacio = () => ({ grupo: "", aula: "", dias: [] as string[], horaInicio: "", horaFin: "", desde: hoy(), hasta: "", nota: "" });

export default function Horario() {
  const { perfil, horario } = useMe();
  const [list, setList] = useState<Asignacion[] | null>(null);
  const [f, setF] = useState(vacio());
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => getAsignaciones().then((r) => setList(r.asignaciones)).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const p = asignacionSchema.safeParse(f);
    if (!p.success) return setError(p.error.issues[0]?.message ?? "Revisa los datos");
    setBusy(true);
    try {
      await api("/asignaciones", { method: "POST", json: p.data });
      setOk(`${p.data.grupo} añadido. Queda constancia en tu registro.`);
      setF({ ...vacio(), desde: f.desde, hasta: f.hasta });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function quitar(a: Asignacion) {
    if (!confirm(`¿Quitar «${a.grupo}» de tu horario? Lo ya registrado no cambia.`)) return;
    try {
      await api(`/asignaciones/${a.id}`, { method: "DELETE", json: {} });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const toggle = (d: string) => setF({ ...f, dias: f.dias.includes(d) ? f.dias.filter((x) => x !== d) : [...f.dias, d] });

  return (
    <>
      <div>
        <h1 className="text-lg font-bold">{perfil.textos.horarioTitulo}</h1>
        <p className="text-sm text-gray-600">{perfil.textos.horarioIntro}</p>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {perfil.id === "DOCENCIA" && <ImportarActa existentes={list ?? []} onDone={load} />}
      {ok && <Notice kind="ok">{ok}</Notice>}

      {list && list.length > 0 && (
        <section className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className="card flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{perfil.campos.grupo}: {a.grupo}{a.aula ? ` · ${perfil.campos.aula}: ${a.aula}` : ""}</p>
                <p className="text-sm text-gray-600">
                  {DIAS.filter((d) => a.dias.includes(d)).map((d) => DIA_NOMBRE[d]).join(", ")} · {a.horaInicio}–{a.horaFin}
                </p>
                <p className="text-xs text-gray-500">Del {fechaCorta(a.desde)} al {fechaCorta(a.hasta)}{a.nota ? ` · ${a.nota}` : ""}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1 text-sm">
                <button className="text-gray-700 underline" onClick={() => setF({ ...a, nota: a.nota ?? "" })}>Duplicar</button>
                <button className="text-ugt underline" onClick={() => quitar(a)}>Quitar</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <form onSubmit={guardar} className="card space-y-3">
        <h2 className="font-semibold">{perfil.textos.horarioAnadir}</h2>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="g">{perfil.campos.grupo}</label>
            <input id="g" className="input" value={f.grupo} placeholder={perfil.campos.grupoEj} onChange={(e) => setF({ ...f, grupo: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="a">{perfil.campos.aula}{perfil.planificado === "CLASE" ? "" : " (opcional)"}</label>
            <input id="a" className="input" value={f.aula} placeholder={perfil.campos.aulaEj} onChange={(e) => setF({ ...f, aula: e.target.value })} />
          </div>
        </div>
        <div>
          <span className="label">Días</span>
          <div className="flex flex-wrap gap-1">
            {DIAS.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => toggle(d)}
                aria-pressed={f.dias.includes(d)}
                className={`h-10 w-12 rounded-xl text-sm font-medium ring-1 ${f.dias.includes(d) ? "bg-ugt text-white ring-ugt" : "bg-white ring-gray-300"}`}
              >
                {DIA_NOMBRE[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="hi">Empieza</label>
            <input id="hi" type="time" min={horario.apertura ?? undefined} max={horario.cierre ?? undefined} className="input" value={f.horaInicio} onChange={(e) => setF({ ...f, horaInicio: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="hf">Termina</label>
            <input id="hf" type="time" className="input" value={f.horaFin} onChange={(e) => setF({ ...f, horaFin: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="d">Desde</label>
            <input id="d" type="date" className="input" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="h">Hasta</label>
            <input id="h" type="date" className="input" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="n">Nota (opcional)</label>
          <input id="n" className="input" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="Ej.: temporada de invierno" />
        </div>
        <button className="btn-primary w-full" disabled={busy}>Añadir al horario</button>
      </form>
    </>
  );
}
