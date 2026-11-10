import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api, saveNativeToken } from "../api";
import { Notice } from "../components/Layout";
import { CREDITO } from "../../shared/centro";

export default function Entrar() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const tried = useRef(false);

  useEffect(() => {
    if (!token || tried.current) return;
    tried.current = true;
    api<{ token: string }>("/auth/verify", { method: "POST", json: { token } })
      .then((r) => {
        saveNativeToken(r.token);
        nav("/", { replace: true });
      })
      .catch((e) => setError(e.message));
  }, [token, nav]);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/request", { method: "POST", json: { email } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function conCodigo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ token: string }>("/auth/verify", { method: "POST", json: { email, code } });
      saveNativeToken(r.token);
      nav("/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <div className="mb-6 text-center">
        <img src="/icon.svg" alt="" className="mx-auto h-16 w-16" />
        <h1 className="mt-3 text-2xl font-bold">Registro de jornada</h1>
        <p className="mt-1 text-sm text-gray-600">
          Tu registro personal de horas, turnos, pausas e incidencias, con valor de prueba. Para cualquier colectivo: docencia, hostelería, comercio, limpieza, cuidados…
        </p>
      </div>
      {token && !error && <Notice>Entrando…</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {!token && sent && (
        <>
          <Notice kind="ok">
            Te hemos enviado un correo a <strong>{email}</strong> con un enlace y un código. Abre el enlace en este
            dispositivo o escribe aquí el código. Caducan en 20 minutos.
          </Notice>
          <form onSubmit={conCodigo} className="card mt-3 space-y-3">
            <label className="label" htmlFor="code">Código de 6 cifras</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="input mono text-center text-2xl tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button className="btn-primary w-full" disabled={busy || code.length !== 6}>Entrar</button>
            <button type="button" className="w-full text-sm text-gray-600 underline" onClick={() => { setSent(false); setCode(""); }}>
              Usar otro correo o pedir otro código
            </button>
          </form>
        </>
      )}
      {(!token || error) && !sent && (
        <form onSubmit={pedir} className="card mt-3 space-y-3">
          <div>
            <label className="label" htmlFor="email">Tu correo personal</label>
            <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-gray-500">Mejor uno personal que el del trabajo: así el acceso es solo tuyo.</p>
          </div>
          <button className="btn-primary w-full" disabled={busy}>Enviarme el enlace</button>
        </form>
      )}
      <p className="mt-6 text-center text-xs text-gray-500">
        <Link to="/aviso" className="underline">Aviso legal y privacidad</Link> · <Link to="/verificar" className="underline">Comprobar una huella</Link>
      </p>
      <p className="mt-2 text-center text-[11px] text-gray-400">{CREDITO}</p>
    </div>
  );
}
