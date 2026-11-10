import { useEffect, useState } from "react";
import { api, download } from "../api";
import { Notice } from "../components/Layout";
import { mesActual, nombreMes, sumarMes } from "../format";

type Integridad = { ok: true; count: number; head: string; unstamped: number } | { ok: false; seq: number; reason: string; unstamped: number };

export default function Exportar() {
  const [mes, setMes] = useState(mesActual());
  const [integ, setInteg] = useState<Integridad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<Integridad>("/integridad").then(setInteg).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-lg font-bold">Exportar</h1>
      {error && <Notice kind="error">{error}</Notice>}
      {msg && <Notice kind="ok">{msg}</Notice>}

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <button className="btn-ghost px-3" onClick={() => setMes(sumarMes(mes, -1))} aria-label="Mes anterior">‹</button>
          <p className="font-semibold first-letter:uppercase">{nombreMes(mes)}</p>
          <button className="btn-ghost px-3" onClick={() => setMes(sumarMes(mes, 1))} disabled={mes >= mesActual()} aria-label="Mes siguiente">›</button>
        </div>
        <button className="btn-primary w-full" disabled={busy} onClick={() => run(() => download(`/export/pdf?mes=${mes}`, `registro-jornada-${mes}.pdf`))}>
          Descargar informe PDF
        </button>
        <button className="btn-ghost w-full" disabled={busy} onClick={() => run(() => download(`/export/evidencia?mes=${mes}`, `evidencias-jornada-${mes}.json`))}>
          Descargar paquete de evidencias (JSON)
        </button>
        <p className="text-xs text-gray-600">
          El PDF es para leerlo y presentarlo. El paquete de evidencias contiene el texto exacto de cada anotación y sus
          sellos de tiempo: permite a un perito, a la Inspección o a un juzgado comprobar que nada se ha cambiado, sin
          depender de esta aplicación. Guarda los dos.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Integridad de tu registro</h2>
        {!integ && <p className="text-sm text-gray-500">Comprobando…</p>}
        {integ?.ok && (
          <Notice kind="ok">
            Cadena íntegra: {integ.count} anotaciones sin alteraciones.
            <span className="mono mt-1 block break-all text-[10px]">Última huella: {integ.head}</span>
          </Notice>
        )}
        {integ && !integ.ok && <Notice kind="error">La cadena falla en la anotación nº {integ.seq}: {integ.reason}. Avisa a la sección sindical.</Notice>}
        {integ && integ.unstamped > 0 && (
          <>
            <Notice kind="warn">Hay {integ.unstamped} anotaciones esperando su sello de tiempo.</Notice>
            <button
              className="btn-ghost w-full"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await api<{ done: number; left: number }>("/sellar", { method: "POST", json: {} });
                  setMsg(`Selladas ${r.done}${r.left ? `; quedan ${r.left}` : ""}.`);
                  await load();
                })
              }
            >
              Sellar ahora
            </button>
          </>
        )}
      </section>
    </>
  );
}
