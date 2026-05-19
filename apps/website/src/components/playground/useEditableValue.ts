import { useEffect, useRef, useState } from "react";
import { clamp, snap } from "./slider-utils.ts";

interface UseEditableValueOptions {
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  /** Optional seed formatter for the editable input — falls back to `format`.
   *  Use this when `format` returns a non-parseable display string (e.g. a
   *  decorated label) but the input should still seed with a clean number. */
  formatSeed?: (value: number) => string;
  onChange: (next: number, fromDrag?: boolean) => void;
}

export function useEditableValue({
  value,
  min,
  max,
  step,
  format,
  formatSeed,
  onChange,
}: UseEditableValueOptions) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const seedFormat = formatSeed ?? format;
  const beginEdit = () => {
    const seed = seedFormat ? seedFormat(value) : String(value);
    setDraft(seed);
    setEditing(true);
  };

  // Focus + select once the input mounts so the user can immediately
  // overtype the current value without an extra click.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = () => {
    // `parseFloat` is intentionally lenient — it grabs any leading numeric
    // portion, so formatted seeds like "0.60" or "37" both round-trip even
    // if the format prop ever decorates the value with non-digit suffixes.
    const parsed = parseFloat(draft);
    if (!Number.isNaN(parsed)) {
      const stepped = clamp(snap(parsed, step), min, max);
      if (stepped !== value) onChange(stepped, false);
    }
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    const dir = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1
              : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1
              : 0;
    if (dir === 0) return;
    e.preventDefault();
    const base = parseFloat(draft);
    const current = Number.isNaN(base) ? value : base;
    const delta = step * (e.shiftKey ? 10 : 1);
    const next = clamp(snap(current + dir * delta, step), min, max);
    setDraft(seedFormat ? seedFormat(next) : String(next));
    if (next !== value) onChange(next, false);
  };

  return {
    editing,
    draft,
    setDraft,
    inputRef,
    beginEdit,
    commitEdit,
    handleInputKeyDown,
  };
}
