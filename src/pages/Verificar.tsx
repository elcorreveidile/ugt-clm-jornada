import { useState } from "react";
import { Link } from "react-router";
import { api } from "../api";
import { Notice } from "../components/Layout";
import { fechaHora } from "../format";

type R = { existe: false } | { existe: true; numero: number; anotada: string; sello: null | { fecha: string; proveedor: string; cualificado: boolean } };

export default function Verificar() {
  const [hash, setHash] = useState("");
  const [r, setR] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setR(null);
    try {
      setR(await api<R>(`/verificar/${hash.trim().toLowerCase()}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Comprobar una huella</h1>
      <p className="text-sm text-gray-600">
        Escribe una huella (64 caracteres) de un informe de registro de jornada. Verás si existe y cuándo quedó sellada.
        No se muestra el contenido ni a quién pertenece.
      </p>
      <form onSubmit={buscar} className="card space-y-3">
        <input className="input mono text-sm" value={hash} onChange={(e) => setHash(e.target.value)} placeholder="p. ej. a84a8480b5e96d…" aria-label="Huella" />
        <button className="btn-primary w-full">Comprobar</button>
      </form>
      {error && <Notice kind="error">{error}</Notice>}
      {r && !r.existe && <Notice kind="warn">Esa huella no figura en este registro.</Notice>}
      {r?.existe && (
        <Notice kind="ok">
          Existe: anotación nº {r.numero}, hecha el {fechaHora(r.anotada)}.{" "}
          {r.sello
            ? `Sellada el ${fechaHora(r.sello.fecha)} por ${r.sello.proveedor}${r.sello.cualificado ? " (sello cualificado)" : ""}.`
            : "Aún sin sello de tiempo."}
        </Notice>
      )}
      <p className="text-xs text-gray-500">
        La comprobación completa e independiente se hace con el paquete de evidencias que descarga el titular. <Link to="/aviso" className="underline">Más información</Link>
      </p>
    </div>
  );
}
