import { createEngine } from "./engine.js";

// --- User-editable settings (userscript build has no popup) ---
const SMOOTHING = 0.6; // 0 (arc) to 1 (max squircle)
// --------------------------------------------------------------

createEngine({ enabled: true, smoothing: SMOOTHING });
