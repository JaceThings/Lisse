import { useState, type ReactNode } from "react";
import { CheckIcon, CopyIcon } from "../icons/sf/index.tsx";
import { IconSwap } from "./IconSwap.tsx";
import {
  JsLogo,
  ReactLogo,
  SvelteLogo,
  VueLogo,
} from "../icons/logos/index.tsx";
import { Card } from "./Card.tsx";
import { Divider } from "./Divider.tsx";
import { Stagger } from "./Stagger.tsx";

type RowDef = {
  pkg: string;
  command: string;
  logo: ReactNode;
};

const rows: RowDef[] = [
  { pkg: "@lisse/react", command: "npm install @lisse/react", logo: <ReactLogo /> },
  { pkg: "@lisse/vue", command: "npm install @lisse/vue", logo: <VueLogo /> },
  { pkg: "@lisse/svelte", command: "npm install @lisse/svelte", logo: <SvelteLogo /> },
  { pkg: "@lisse/core", command: "npm install @lisse/core", logo: <JsLogo /> },
];

// Hit-area extender. Visible row is ~29px tall (under the 40×40
// minimum); `p-1.5 -m-1.5` adds 6px each side (~41px hit area) without
// changing the visual. `data-focus-ring` opts the button into the
// page-level <FocusRingOverlay> spring ring.
const ROW_HITAREA = "block w-full cursor-pointer p-1.5 -m-1.5";

const ROW_VISUAL =
  "flex w-full items-center gap-1.5 px-figma-2 py-1.5 bg-surface overflow-hidden";

const ICON_TRANSITION =
  "transition-colors duration-300 ease-out-quint";

type Status = { kind: "idle" } | { kind: "copied"; pkg: string } | { kind: "error"; pkg: string };

interface InstallProps {
  /** Reveal index for the first row; later rows rise by 1 each. */
  staggerFrom: number;
}

export function Install({ staggerFrom }: InstallProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function scheduleReset(kind: "copied" | "error", pkg: string, ms: number) {
    window.setTimeout(() => {
      setStatus((curr) =>
        curr.kind === kind && curr.pkg === pkg ? { kind: "idle" } : curr,
      );
    }, ms);
  }

  async function handleCopy(row: RowDef) {
    try {
      await navigator.clipboard.writeText(row.command);
      setStatus({ kind: "copied", pkg: row.pkg });
      scheduleReset("copied", row.pkg, 1400);
    } catch {
      setStatus({ kind: "error", pkg: row.pkg });
      scheduleReset("error", row.pkg, 2400);
    }
  }

  const announcement =
    status.kind === "copied" ? `Copied ${status.pkg} install command to clipboard`
    : status.kind === "error" ? `Unable to copy ${status.pkg} install command`
    : "";

  return (
    <section className="flex w-full flex-col gap-figma-5" aria-labelledby="install-heading">
      <h2 id="install-heading" className="sr-only">
        Install
      </h2>
      <Divider />
      <div
        className="flex w-full flex-col gap-figma-3"
        // Empirical 0.5 CSS px to land the rows on an integer device-pixel
        // Y (2× Retina) for clean Safari SVG drop-shadow raster. The flow
        // through Header → Intro → Demo accumulates a fractional Y offset
        // by the time it reaches the rows; this zeroes that out.
        style={{ paddingTop: "0.5px" }}
        data-focus-section="install"
      >
        {rows.map((row, i) => {
          const isCopied = status.kind === "copied" && status.pkg === row.pkg;
          return (
            <Stagger key={row.pkg} index={staggerFrom + i}>
              <button
                type="button"
                className={ROW_HITAREA}
                data-focus-ring
                onClick={() => handleCopy(row)}
                aria-label={`Copy ${row.command} to clipboard`}
              >
                <Card>
                  <div className={ROW_VISUAL}>
                    <span className="inline-flex h-[17px] w-[18px] flex-none items-center justify-center text-text-input">
                      {row.logo}
                    </span>
                    <span className="min-w-0 flex-1 text-left font-mono text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-input">
                      {row.command}
                    </span>
                    <IconSwap
                      size={16}
                      className={`${isCopied ? "text-accent-green" : "text-text-input"} ${ICON_TRANSITION}`}
                      layers={[
                        {
                          key: "copy",
                          active: !isCopied,
                          node: <CopyIcon width={15} height={16} />,
                        },
                        {
                          key: "check",
                          active: isCopied,
                          node: <CheckIcon width={15} height={15} />,
                        },
                      ]}
                    />
                  </div>
                </Card>
              </button>
            </Stagger>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}
