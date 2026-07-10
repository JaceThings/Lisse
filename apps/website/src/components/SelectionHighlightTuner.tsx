import { useEffect, useState } from "react";
import {
  DEFAULT_OPTIONS,
  setHighlightOptions,
  type SelectionHighlightOptions,
} from "./selectionHighlightOptions.ts";

// ponytail: dev-only tuning surface. Colour/blend/vivid are bespoke controls;
// every numeric knob is a schema-driven slider (see NUM) seeded at the library's
// real default so it starts where the shipped marker sits. The JSON box is the
// escape hatch for the long tail (streakiness, dryout, glow, animation…).
// Persisted so a reload keeps your tuning; never mounted in production.

const KEY = "lisse:selection-highlight-opts";
const BLEND_MODES = ["multiply", "normal", "darken", "screen", "overlay", "color-burn"];

// { dotted path, label, range, and the library's own default at that path }.
const NUM: { path: string; label: string; min: number; max: number; step: number; def: number }[] = [
  { path: "opacity", label: "opacity", min: 0, max: 1, step: 0.01, def: 0.45 },
  { path: "tip.angle", label: "angle°", min: -90, max: 90, step: 1, def: 35 },
  { path: "tip.overshoot", label: "edge offset px", min: -6, max: 12, step: 0.5, def: 2 },
  { path: "tip.overshootJitter", label: "offset jitter", min: 0, max: 6, step: 0.5, def: 1 },
  { path: "tip.angleJitter", label: "angle jitter°", min: 0, max: 30, step: 1, def: 0 },
  { path: "edge.waviness", label: "waviness px", min: 0, max: 8, step: 0.1, def: 1 },
  { path: "edge.frequency", label: "wave spacing px", min: 2, max: 60, step: 1, def: 22 },
  { path: "edge.roughness", label: "roughness", min: 0, max: 1, step: 0.05, def: 0.2 },
  { path: "edge.radius", label: "corner radius px", min: 0, max: 24, step: 0.5, def: 5 },
  { path: "ink.flow", label: "flow", min: 0, max: 1.5, step: 0.05, def: 0.45 },
  { path: "ink.feathering", label: "feathering", min: 0, max: 3, step: 0.05, def: 0.2 },
  { path: "paper.absorbency", label: "absorbency", min: 0, max: 1, step: 0.05, def: 0.3 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPath(obj: any, path: string): unknown {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj: SelectionHighlightOptions, path: string, value: number): SelectionHighlightOptions {
  const keys = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next: any = { ...obj };
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] ?? {}) };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return next;
}

function toHex(color: SelectionHighlightOptions["color"]): string {
  if (typeof color !== "string") return "#73574a";
  if (color.startsWith("#")) return color.length === 7 ? color : "#73574a";
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return "#73574a";
  const [r, g, b] = m[1].split(",").map((n) => parseInt(n, 10));
  const h = (n: number) => (n || 0).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function SelectionHighlightTuner() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<SelectionHighlightOptions>(DEFAULT_OPTIONS);
  const [text, setText] = useState(JSON.stringify(DEFAULT_OPTIONS, null, 2));
  const [err, setErr] = useState<string | null>(null);

  // Restore persisted tuning on mount and apply it live.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as SelectionHighlightOptions;
      setOpts(parsed);
      setText(JSON.stringify(parsed, null, 2));
      setHighlightOptions(parsed);
    } catch {
      /* ignore malformed cache */
    }
  }, []);

  // Structured edits: apply + reserialise the JSON view.
  function push(next: SelectionHighlightOptions) {
    setOpts(next);
    setText(JSON.stringify(next, null, 2));
    setErr(null);
    setHighlightOptions(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  // Raw JSON edits: apply on valid parse, leave the text as typed.
  function onJson(raw: string) {
    setText(raw);
    try {
      const parsed = JSON.parse(raw) as SelectionHighlightOptions;
      setErr(null);
      setOpts(parsed);
      setHighlightOptions(parsed);
      localStorage.setItem(KEY, raw);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const vivid = opts.vivid === true ? "true" : opts.vivid === "screen" ? "screen" : "off";

  const row: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11 };
  const control: React.CSSProperties = { font: "inherit", fontSize: 11 };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ position: "fixed", right: 12, bottom: 12, zIndex: 2147483000, padding: "6px 10px", borderRadius: 8, border: "1px solid #0002", background: "#fff", boxShadow: "0 2px 8px #0002", font: "500 11px system-ui", cursor: "pointer" }}
      >
        🖊 Highlighter
      </button>
    );
  }

  return (
    <div
      style={{ position: "fixed", right: 12, bottom: 12, zIndex: 2147483000, width: 264, maxHeight: "86vh", overflow: "auto", display: "flex", flexDirection: "column", gap: 7, padding: 12, borderRadius: 10, border: "1px solid #0002", background: "#fff", boxShadow: "0 4px 16px #0003", font: "400 11px system-ui", color: "#222" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 12 }}>Selection highlighter</strong>
        <button type="button" onClick={() => setOpen(false)} style={{ ...control, cursor: "pointer", border: "none", background: "none", fontSize: 14 }}>×</button>
      </div>

      <label style={row}>
        <span>colour</span>
        <input type="color" value={toHex(opts.color)} onChange={(e) => push({ ...opts, color: e.target.value })} style={control} />
      </label>

      <label style={row}>
        <span>blend</span>
        <select value={opts.blendMode ?? "multiply"} onChange={(e) => push({ ...opts, blendMode: e.target.value as SelectionHighlightOptions["blendMode"] })} style={control}>
          {BLEND_MODES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>

      <label style={row}>
        <span>vivid</span>
        <select
          value={vivid}
          onChange={(e) => {
            const v = e.target.value;
            push({ ...opts, vivid: v === "true" ? true : v === "screen" ? "screen" : false });
          }}
          style={control}
        >
          <option value="off">off</option>
          <option value="true">on</option>
          <option value="screen">screen</option>
        </select>
      </label>

      <div style={{ height: 1, background: "#0001", margin: "3px 0" }} />

      {NUM.map(({ path, label, min, max, step, def }) => {
        const val = (getPath(opts, path) as number | undefined) ?? def;
        return (
          <label key={path} style={row}>
            <span style={{ whiteSpace: "nowrap" }}>{label} {typeof val === "number" ? +val.toFixed(2) : val}</span>
            <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => push(setPath(opts, path, Number(e.target.value)))} style={{ ...control, width: 118 }} />
          </label>
        );
      })}

      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3 }}>Raw options (streakiness · dryout · glow · animation…):</div>
      <textarea value={text} onChange={(e) => onJson(e.target.value)} spellCheck={false} rows={7} style={{ ...control, fontFamily: "ui-monospace, monospace", resize: "vertical", padding: 6, borderRadius: 6, border: `1px solid ${err ? "#d33" : "#0002"}` }} />
      {err ? <div style={{ color: "#d33", fontSize: 10 }}>{err}</div> : null}

      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={() => navigator.clipboard?.writeText(JSON.stringify(opts, null, 2))} style={{ ...control, flex: 1, cursor: "pointer", padding: "5px 8px", borderRadius: 6, border: "1px solid #0002", background: "#f6f6f4" }}>Copy</button>
        <button type="button" onClick={() => { localStorage.removeItem(KEY); push(DEFAULT_OPTIONS); }} style={{ ...control, flex: 1, cursor: "pointer", padding: "5px 8px", borderRadius: 6, border: "1px solid #0002", background: "#f6f6f4" }}>Reset</button>
      </div>
      <div style={{ fontSize: 10, opacity: 0.55 }}>Select text on the page to preview. Dev-only; persisted locally.</div>
    </div>
  );
}
