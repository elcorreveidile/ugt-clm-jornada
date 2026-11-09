// Datos de la persona (colectivo, centro y horario) disponibles en toda la app.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, type Me } from "./api";
import { perfilDe, type Perfil } from "../shared/perfiles";
import type { Horario } from "../shared/centro";

interface MeCtx {
  me: Me;
  perfil: Perfil;
  horario: Horario;
  reload: () => Promise<void>;
}

const Ctx = createContext<MeCtx | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => getMe().then(setMe).catch((e) => setError(e.message)), []);
  useEffect(() => {
    reload();
  }, [reload]);
  if (error) return <p className="p-6 text-sm text-red-700">{error}</p>;
  if (!me) return <p className="p-6 text-sm text-gray-500">Cargando…</p>;
  const value: MeCtx = {
    me,
    perfil: perfilDe(me.perfil),
    horario: { apertura: me.apertura, cierre: me.cierre, inicioTarde: me.inicioTarde },
    reload,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMe(): MeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMe fuera de MeProvider");
  return v;
}
