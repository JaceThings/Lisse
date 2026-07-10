import { DEFAULT_SMOOTHING } from "./plan.js";

export interface SiteSettings {
  enabled: boolean;
  smoothing: number;
}

/** Per-site enabled flag, keyed by hostname. */
export function enabledKey(host: string): string {
  return `enabled:${host}`;
}

export async function loadSettings(host: string): Promise<SiteSettings> {
  const store = await chrome.storage.sync.get([enabledKey(host)]);
  return {
    enabled: store[enabledKey(host)] ?? true, // default ON
    smoothing: DEFAULT_SMOOTHING,
  };
}

export async function setEnabled(host: string, enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [enabledKey(host)]: enabled });
}
