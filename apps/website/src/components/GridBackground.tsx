// Tiled `Grid.svg` (dashed micro-grid + tick crosses). The Figma `Pattern`
// mask — a 530×299 rect Gaussian-blurred to stdDeviation 10, exported to
// /grid-mask.svg — is applied by the parent wrapper in Demo.tsx so it
// feathers BOTH this grid AND the squircle layer together. The grid sits
// at `absolute inset:0` and fills the masked region.
export function GridBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "url(/grid.svg)",
        backgroundRepeat: "repeat",
        // SVG tile is 160×320 with a major line every 160px. Shifting
        // the Y position by 80px puts the demo's centre at the middle
        // of a major cell — matching Figma 22:207, where the squircle
        // sits inside a cell rather than on a grid line.
        backgroundPosition: "50% calc(50% + 80px)",
        backgroundSize: "160px 320px",
      }}
    />
  );
}
