import { useRef } from "react";
import { Stagger } from "./Stagger.tsx";
import { useJustif } from "../hooks/useJustif.ts";
import { m } from "../paraglide/messages.js";

interface IntroProps {
  /** Reveal index for the intro paragraph. */
  staggerIndex: number;
}

export function Intro({ staggerIndex }: IntroProps) {
  const body = useRef<HTMLElement>(null);
  useJustif(body);

  return (
    <section ref={body} className="w-full pb-6 text-text-primary">
      <Stagger index={staggerIndex}>
        <p className="text-[14px] leading-[1.4] font-medium tracking-[-0.25px] text-justify hyphens-auto">
          {m.intro_lead()}
        </p>
      </Stagger>
    </section>
  );
}
