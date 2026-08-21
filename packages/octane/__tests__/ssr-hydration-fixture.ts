export const HYDRATION_PROPS = {
  autoEffects: false,
  corners: { radius: 16, smoothing: 0.6 },
  children: "hello",
} as const;

export const SERVER_HTML =
  '<!--[--><!--[--><div style="border-radius:16px;">hello</div><!--]--><!--]-->';
