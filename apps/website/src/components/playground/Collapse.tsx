import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const SAFARI_DURATION_MS = 240;
const SAFARI_TRANSITION =
  `max-height ${SAFARI_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1), ` +
  `opacity ${SAFARI_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1), ` +
  `transform ${SAFARI_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;

export function Collapse({ show, children }: { show: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    setContentHeight(el.offsetHeight);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      setContentHeight(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxHeight = contentHeight === null
    ? (show ? "none" : "0px")
    : `${show ? contentHeight : 0}px`;

  return (
    <div
      style={{
        maxHeight,
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(-4px)",
        overflow: "hidden",
        transition: contentHeight === null ? "none" : SAFARI_TRANSITION,
        width: "100%",
        contain: "paint",
        willChange: "opacity, max-height, transform",
      }}
      inert={!show}
      aria-hidden={!show || undefined}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
