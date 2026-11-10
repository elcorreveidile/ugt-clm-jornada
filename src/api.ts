// Cliente de la API. En la web la sesión va en una cookie httpOnly; en la app
// móvil (Capacitor) se guarda el token y se manda como Authorization.
import type { DerivedActivity, LedgerEntry } from "../shared/derive";
import type { EntryInput } from "../shared/events";

// Vacío en la web (misma web y API); en las apps móviles, la URL pública de la API.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
const TOKEN_KEY = "jornada_token";

export function nativeToken(): string | null {
  try {
    return BASE ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}
export function saveNativeToken(t: string | null) {
  if (!BASE) return;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const t = nativeToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers,
    credentials: "include",
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  if (res.status === 401) {
    if (!location.pathname.startsWith("/entrar") && !location.pathname.startsWith("/verificar")) location.href = "/entrar";
    throw new ApiError("Tienes que entrar de nuevo", 401);
  }
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new ApiError(data?.error ?? `Error ${res.status}`, res.status);
  return data as T;
}

/** Descarga un fichero de la API (PDF o JSON) respetando la sesión. */
export async function download(path: string, filename: string) {
  const headers = new Headers();
  const t = nativeToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const res = await fetch(`${BASE}/api${path}`, { headers, credentials: "include" });
  if (!res.ok) throw new ApiError((await res.json().catch(() => null))?.error ?? "No se pudo descargar", res.status);
  const blob = await res.blob();
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    // En el móvil no hay «descargas»: se guarda el fichero y se abre el menú de compartir
    // (guardar en Archivos, enviar por correo, a la nube…).
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const data = await new Promise<string>((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(",")[1] ?? "");
      r.onerror = () => ko(r.error);
      r.readAsDataURL(blob);
    });
    const file = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title: filename, url: file.uri });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export interface Me {
  id: string;
  email: string;
  name: string;
  nif: string | null;
  perfil: string | null;
  centro: string;
  apertura: string | null;
  cierre: string | null;
  inicioTarde: string;
  tsa: string;
}
export interface Registro {
  entries: LedgerEntry[];
  activities: DerivedActivity[];
}
export interface Asignacion {
  id: string;
  grupo: string;
  aula: string;
  dias: string[];
  horaInicio: string;
  horaFin: string;
  desde: string;
  hasta: string;
  nota: string | null;
}

export const updateMe = (data: Partial<Omit<Me, "id" | "email" | "tsa">>) => api<Me>("/me", { method: "PATCH", json: data });

export const getMe = () => api<Me>("/me");
export const getRegistro = () => api<Registro>("/registro");
export const addEntry = (input: EntryInput) => api<{ entry: LedgerEntry }>("/registro", { method: "POST", json: input });
export const getAsignaciones = () => api<{ asignaciones: Asignacion[] }>("/asignaciones");
