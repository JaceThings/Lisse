import { setSmoothing, SMOOTHING_KEY } from "./settings.js";
import { DEFAULT_SMOOTHING } from "./plan.js";

const slider = document.getElementById("smoothing") as HTMLInputElement;
const value = document.getElementById("value") as HTMLOutputElement;

function show(v: number): void {
  slider.value = String(v);
  value.textContent = v.toFixed(2);
}

chrome.storage.sync.get([SMOOTHING_KEY]).then((store) => {
  const v = store[SMOOTHING_KEY];
  show(typeof v === "number" ? v : DEFAULT_SMOOTHING);
});

slider.addEventListener("input", () => {
  const v = parseFloat(slider.value);
  show(v);
  void setSmoothing(v); // content scripts pick it up via storage.onChanged
});
