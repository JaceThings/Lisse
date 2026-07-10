import { loadSettings, setEnabled, enabledKey } from "./settings.js";

// Green (on) and grey (off) sets rasterised from assets/*.svg at build time.
const iconPaths = (state: "on" | "off") => ({
  16: `icons/${state}16.png`,
  32: `icons/${state}32.png`,
  48: `icons/${state}48.png`,
  128: `icons/${state}128.png`,
});

/** Hostname for http(s) tabs only; null for chrome://, about:, file:, etc. */
function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.hostname : null;
  } catch {
    return null;
  }
}

/** Green icon when the tab's site is smoothed, grey otherwise (incl. non-http). */
async function refreshIcon(tabId: number, url: string | undefined): Promise<void> {
  const host = hostOf(url);
  const on = host ? (await loadSettings(host)).enabled : false;
  await chrome.action.setIcon({ tabId, path: iconPaths(on ? "on" : "off") });
}

// Click toggles smoothing for the active tab's site; storage.onChanged then
// tells the content script to re-apply/undo live and refreshes every icon.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  const host = hostOf(tab.url);
  if (!host) return; // no-op on chrome://, about:, file:, etc.
  const { enabled } = await loadSettings(host);
  await setEnabled(host, !enabled);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await refreshIcon(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status) refreshIcon(tabId, tab.url);
});

// A site's flag can flip from any tab or window — resync every tab's icon.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  const prefix = enabledKey("");
  if (!Object.keys(changes).some((k) => k.startsWith(prefix))) return;
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id != null) refreshIcon(tab.id, tab.url);
  }
});
