import { SmoothCorners } from "@lisse/react";

interface RadioPillOption<T extends string> {
  value: T;
  label: string;
}

interface RadioPillGroupProps<T extends string> {
  options: ReadonlyArray<RadioPillOption<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  /** Tailwind class for min-width per pill — wider rows use `min-w-[110px]`. */
  pillMinWidth?: string;
}

// Hit-area extender mirrors TogglePill's PILL_HITAREA: `p-1.5 -m-1.5`
// adds 6px each side without changing layout, so the visible pill stays
// the same size while the pointer target reaches ~40×40.
const PILL_HITAREA = "cursor-pointer p-1.5 -m-1.5 select-none";

const PILL_VISUAL =
  "flex flex-1 items-center justify-center px-2.5 py-1.5 text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-input transition-colors duration-200 ease-out-quint";

export function RadioPillGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  pillMinWidth,
}: RadioPillGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex w-full flex-wrap content-center items-center justify-center gap-figma-3 p-figma-3"
      data-focus-section={`playground-${ariaLabel.replace(/\s+/g, "-").toLowerCase()}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-focus-ring
            onClick={() => onChange(option.value)}
            className={`${PILL_HITAREA} flex flex-1 ${pillMinWidth ?? ""}`}
          >
            <SmoothCorners
              asChild
              autoEffects={false}
              corners={{ radius: 8, smoothing: 0.6 }}
            >
              <span
                className={`${PILL_VISUAL} ${
                  selected ? "bg-[rgba(126,117,108,0.12)]" : "bg-transparent"
                }`}
              >
                {option.label}
              </span>
            </SmoothCorners>
          </button>
        );
      })}
    </div>
  );
}
