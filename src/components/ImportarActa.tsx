// Importar el horario desde las actas de la intranet: pegando su texto o
// subiendo el PDF. Se lee en el propio dispositivo; al servidor solo llega el
// horario (grupo, aula, días, horas y período), nunca la lista del alumnado.
import { useState } from "react";
import { api, type Asignacion } from "../api";
import { leerActas, type ActaLeida } from "../../shared/acta";
import { Notice } from "./Layout";

async function textoDelPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    for (const it of content.items) if ("str" in it) out += it.str + (it.hasEOL ? "\n" : " ");
    out += "\n";
  }
  return out;
}

const mismaAsignacion = (a: ActaLeida["asignacion"], b: Asignacion) =>
  a.grupo === b.grupo && a.horaInicio === b.horaInicio && a.horaFin === b.horaFin && a.desde === b.desde && a.hasta === b.hasta && a.dias.join() === b.dias.join();

export default function ImportarActa({ existentes, onDone }: { existentes: Asignacion[]; onDone: () => void }) {
  const [texto, setTexto] = useState("");
  const [leidas, setLeidas] = useState<ActaLeida[] | null>(null);
  const [marcadas, setMarcadas] = useState<boolean[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  function leer(t: string) {
    setOk(null);
    const r = leerActas(t);
    setErrores(r.errores);
    setLeidas(r.ok ? r.actas : null);
    if (r.ok) setMarcadas(r.actas.map((a) => !existentes.some((e) => mismaAsignacion(a.asignacion, e))));
  }

  async function pdf(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const t = await textoDelPdf(file);
      setTexto("");
      leer(t);
    } catch {
      setErrores(["No he podido leer ese PDF. Prueba a copiar el texto del acta y pegarlo aquí."]);
      setLeidas(null);
    } finally {
      setBusy(false);
    }
  }

  async function importar() {
    if (!leidas) return;
    setBusy(true);
    let n = 0;
    const fallos: string[] = [];
    for (const [i, a] of leidas.entries()) {
      if (!marcadas[i]) continue;
      try {
        await api("/asignaciones", { method: "POST", json: a.asignacion });
        n++;
      } catch (e) {
        fallos.push(`${a.resumen}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    setErrores(fallos);
    setLeidas(null);
    setTexto("");
    setOk(n ? `Añadidos ${n} al horario. Queda constancia en tu registro.` : null);
    onDone();
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Importar desde el acta</h2>
      <p className="text-sm text-gray-600">
        Sube el PDF del acta o copia su texto de la intranet y pégalo aquí (puedes pegar varias seguidas). La app toma el
        grupo, el aula, el horario y el período. La lista del alumnado y los nombres no se guardan.
      </p>
      <label className="btn-ghost w-full cursor-pointer">
        Subir el PDF del acta
        <input type="file" accept="application/pdf" className="sr-only" disabled={busy} onChange={(e) => pdf(e.target.files?.[0])} />
      </label>
      <textarea
        className="input min-h-28 text-sm"
        placeholder={"Curso Académico: …\nGrupo: …\nAula: …\nHorario: 10:30 - 12:30: L, M, X, J, V"}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-label="Texto del acta"
      />
      <button className="btn-ghost w-full" disabled={busy || !texto.trim()} onClick={() => leer(texto)}>
        Leer el texto pegado
      </button>

      {errores.length > 0 && (
        <Notice kind={leidas ? "warn" : "error"}>
          {errores.map((e, i) => (
            <span key={i} className="block">{e}</span>
          ))}
        </Notice>
      )}
      {ok && <Notice kind="ok">{ok}</Notice>}

      {leidas && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Comprueba lo que he leído:</p>
          {leidas.map((a, i) => {
            const ya = existentes.some((e) => mismaAsignacion(a.asignacion, e));
            return (
              <label key={i} className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={marcadas[i] ?? false}
                  onChange={(e) => setMarcadas(marcadas.map((m, j) => (j === i ? e.target.checked : m)))}
                />
                <span>
                  {a.resumen}
                  {a.asignacion.nota && <span className="block text-xs text-gray-500">{a.asignacion.nota}</span>}
                  {ya && <span className="block text-xs text-amber-700">Ya está en tu horario.</span>}
                </span>
              </label>
            );
          })}
          <button className="btn-primary w-full" disabled={busy || !marcadas.some(Boolean)} onClick={importar}>
            Añadir al horario
          </button>
        </div>
      )}
    </section>
  );
}
