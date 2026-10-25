// Preset activities. Claude maps custom names onto these (app/api/open-rooms imports this name).
import { CATALOG } from "./catalog";

export const PRESET_ACTIVITIES = CATALOG.map((a) => a.name);
