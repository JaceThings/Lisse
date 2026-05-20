import { Stagger } from "./Stagger.tsx";

interface IntroProps {
  /** Reveal index for the intro paragraph. */
  staggerIndex: number;
}

export function Intro({ staggerIndex }: IntroProps) {
  return (
    <section className="w-full pb-6 text-text-primary">
      <Stagger index={staggerIndex}>
        <p className="text-[14px] leading-[1.4] font-medium tracking-[-0.25px] text-justify hyphens-auto">
          Lisse is a small JavaScript library that draws squircle corners, the
          same continuous curve Figma and iOS use. Bindings for React, Vue, and
          Svelte, plus a framework-agnostic core. Per-corner control, borders,
          and shadows are included.
        </p>
      </Stagger>
    </section>
  );
}
