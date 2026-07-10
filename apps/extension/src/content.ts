import { createEngine } from "./engine.js";
import { loadSettings, enabledKey, SMOOTHING_KEY } from "./settings.js";

const host = location.hostname;

loadSettings(host).then((settings) => {
  const engine = createEngine(settings);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes[enabledKey(host)]) {
      engine.setEnabled(changes[enabledKey(host)].newValue !== false);
    }
    if (changes[SMOOTHING_KEY]) {
      const next = changes[SMOOTHING_KEY].newValue;
      if (typeof next === "number") engine.setSmoothing(next);
    }
  });
});
