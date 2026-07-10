import { createEngine } from "./engine.js";
import { loadSettings, enabledKey } from "./settings.js";

const host = location.hostname;

loadSettings(host).then((settings) => {
  const engine = createEngine({ enabled: settings.enabled });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes[enabledKey(host)]) {
      engine.setEnabled(changes[enabledKey(host)].newValue !== false);
    }
  });
});
