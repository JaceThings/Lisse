import { Stagger } from "./Stagger.tsx";

const P =
  "text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-justify hyphens-auto";

interface IntroProps {
  /** Reveal index for the first paragraph; subsequent rise by 1 each. */
  staggerFrom: number;
}

export function Intro({ staggerFrom }: IntroProps) {
  return (
    <section className="flex w-full flex-col gap-figma-4 pb-figma-6 text-text-primary">
      <Stagger index={staggerFrom}>
        <p className={P}>
          Lisse makes the corners on a web page look like the corners in Figma.
        </p>
      </Stagger>
      <Stagger index={staggerFrom + 1}>
        <p className={P}>
          CSS rounded corners are quarter-circles. The corners you see in Figma
          and on iOS are squircles: a different curve that eases into the edges
          instead of starting abruptly.
        </p>
      </Stagger>
      <Stagger index={staggerFrom + 2}>
        <p className={P}>
          Lisse is a small JavaScript library that draws them. Bindings for
          React, Vue, and Svelte, plus a framework-agnostic core. Per-corner
          control, borders, and shadows are included.
        </p>
      </Stagger>
    </section>
  );
}
