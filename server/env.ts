export const appUrl = () => (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
export const isProd = () => process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
