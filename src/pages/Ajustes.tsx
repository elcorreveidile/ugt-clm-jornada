import { useState } from "react";
import { Link } from "react-router";
import { api, saveNativeToken, updateMe } from "../api";
import { Notice } from "../components/Layout";
import { useMe } from "../me";
import { CREDITO } from "../../shared/centro";
import { PERFILES, PERFIL_IDS, type PerfilId } from "../../shared/perfiles";

export default function Ajustes() {
  const { me, reload } = useMe();
  const [name, setName] = useState(me.name);
  const [nif, setNif] = useState(me.nif ?? "");
  const [perfil, setPerfil] = useState<PerfilId | "">((me.perfil as PerfilId) ?? "");
  const [centro, setCentro] = useState(me.centro);
  const [apertura, setApertura] = useState(me.apertura ?? "");
  const [cierre, setCierre] = useState(me.cierre ?? "");
  const [inicioTarde, setInicioTarde] = useState(me.inicioTarde);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await updateMe({ name, nif, centro, apertura, cierre, inicioTarde, ...(perfil ? { perfil } : {}) });
      await reload();
      setOk("Datos guardados.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function cambiarPerfil(id: PerfilId) {
    setPerfil(id);
    // Propone el horario típico del colectivo; se puede cambiar antes de guardar.
    const h = PERFILES[id].horario;
    setApertura(h.apertura ?? "");
    setCierre(h.cierre ?? "");
  }

  async function salir() {
    await api("/auth/logout", { method: "POST", json: {} }).catch(() => {});
    saveNativeToken(null);
    location.href = "/entrar";
  }

  async function borrar() {
    if (!window.confirm("Se borrará tu cuenta y TODO tu registro, sin posibilidad de recuperarlo. ¿Has descargado antes tus informes y evidencias?")) return;
    try {
      await api("/me", { method: "DELETE", json: { confirm } });
      saveNativeToken(null);
      location.href = "/entrar";
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <h1 className="text-lg font-bold">Ajustes</h1>
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}
      <form onSubmit={guardar} className="space-y-4">
        <section className="card space-y-3">
          <p className="text-sm text-gray-600">Cuenta: <strong>{me.email}</strong></p>
          <div>
            <label className="label" htmlFor="name">Nombre y apellidos (salen en los informes)</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="nif">DNI/NIE (opcional)</label>
            <input id="nif" className="input" value={nif} onChange={(e) => setNif(e.target.value)} />
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Tu trabajo</h2>
          <div>
            <label className="label" htmlFor="perfil">Colectivo</label>
            <select id="perfil" className="input" value={perfil} onChange={(e) => cambiarPerfil(e.target.value as PerfilId)}>
              {!perfil && <option value="">Elige…</option>}
              {PERFIL_IDS.map((id) => (
                <option key={id} value={id}>{PERFILES[id].nombre}</option>
              ))}
            </select>
            {perfil && <p className="mt-1 text-xs text-gray-500">{PERFILES[perfil].descripcion} Lo ya registrado no cambia.</p>}
          </div>
          <div>
            <label className="label" htmlFor="centro">Centro de trabajo y empresa (sale en los informes)</label>
            <input id="centro" className="input" value={centro} onChange={(e) => setCentro(e.target.value)} placeholder="Ej.: Hotel Alhambra · Empresa S.L." />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label" htmlFor="ap">Abre</label>
              <input id="ap" type="time" className="input" value={apertura} onChange={(e) => setApertura(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ci">Cierra</label>
              <input id="ci" type="time" className="input" value={cierre} onChange={(e) => setCierre(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="it">Tarde desde</label>
              <input id="it" type="time" className="input" value={inicioTarde} onChange={(e) => setInicioTarde(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Si indicas apertura y cierre, lo que quede fuera se marcará en el informe. Déjalos vacíos si tu centro abre 24 horas o no tiene horario fijo.
          </p>
        </section>
        <button className="btn-primary w-full">Guardar</button>
      </form>

      <section className="card space-y-2 text-sm">
        <p>Sello de tiempo: <strong>{me.tsa}</strong></p>
        <Link to="/aviso" className="block text-ugt underline">Aviso legal, privacidad y valor probatorio</Link>
        <Link to="/verificar" className="block text-ugt underline">Comprobar una huella</Link>
        <button className="btn-ghost w-full" onClick={salir}>Cerrar sesión</button>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold text-red-700">Borrar mi cuenta</h2>
        <p className="text-sm text-gray-600">Borra la cuenta y todo el registro. Descarga antes tus informes y evidencias. Escribe tu correo para confirmar.</p>
        <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={me.email} aria-label="Confirma con tu correo" />
        <button className="btn w-full bg-red-700 text-white hover:bg-red-800" disabled={confirm.trim().toLowerCase() !== me.email} onClick={borrar}>
          Borrar definitivamente
        </button>
      </section>

      <p className="pb-2 text-center text-xs text-gray-400">{CREDITO}</p>
    </>
  );
}
