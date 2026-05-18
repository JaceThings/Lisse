/** Coalesces rapid calls into one per animation frame. */
export function createRafCoalescer(cb: () => void): { schedule: () => void; cancel: () => void } {
  let rafId = 0;
  const schedule = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      cb();
    });
  };
  const cancel = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
  return { schedule, cancel };
}
