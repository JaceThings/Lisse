import { DEFAULT_SMOOTHING } from "./plan.js";

export interface SiteSettings {
  enabled: boolean;
  smoothing: number;
}

/** Per-site enabled flag is keyed by hostname; smoothing is global. */
function enabledKey(host: string): string {
  return `enabled:${host}`;
}

const SMOOTHING_KEY = "smoothing";

export async function loadSettings(host: string): Promise<SiteSettings> {
  const store = await chrome.storage.sync.get([enabledKey(host), SMOOTHING_KEY]);
  return {
    enabled: store[enabledKey(host)] ?? true, // default ON
    smoothing: store[SMOOTHING_KEY] ?? DEFAULT_SMOOTHING,
  };
}

export async function setEnabled(host: string, enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [enabledKey(host)]: enabled });
}

export async function setSmoothing(smoothing: number): Promise<void> {
  await chrome.storage.sync.set({ [SMOOTHING_KEY]: smoothing });
}

export { enabledKey, SMOOTHING_KEY };
