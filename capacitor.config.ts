import type { CapacitorConfig } from "@capacitor/cli";

// Apps de Android (Google Play) e iOS (App Store). Empaquetan la web ya
// construida (dist/) y hablan con la API pública por HTTPS (VITE_API_BASE).
const config: CapacitorConfig = {
  appId: "org.ugtclmgranada.jornada",
  appName: "Registro de jornada",
  webDir: "dist",
  ios: { contentInset: "always" },
};

export default config;
