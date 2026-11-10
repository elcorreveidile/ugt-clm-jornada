// Punto de entrada de la API en Vercel. vercel.json reescribe /api/* aquí.
import { handle } from "hono/vercel";
import app from "../server/app";

const h = handle(app);
export const GET = h;
export const POST = h;
export const PATCH = h;
export const DELETE = h;
export const OPTIONS = h;
