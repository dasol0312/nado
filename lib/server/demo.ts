import "server-only";
import { fail } from "./api";

// Demo routes (app/api/demo/*) are on unless NADO_DEMO=0
export const demoOff = () => (process.env.NADO_DEMO === "0" ? fail(404, "DEMO_OFF", "Demo controls are turned off.") : null);
