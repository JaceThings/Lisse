import { useRef } from "react";
import { Divider } from "../components/Divider.tsx";
import { Stagger } from "../components/Stagger.tsx";
import { useJustif } from "../hooks/useJustif.ts";
import { m } from "../paraglide/messages.js";

// Figma node 35:238 — `text-text-primary` (not muted input). `hyphens-auto`
// is inherited from global.css; listed here for visibility.
const BODY =
  "text-[14px] leading-[1.4] max-[560px]:leading-[1.6] font-medium tracking-[-0.25px] text-text-primary text-justify hyphens-auto";

// Indices 0–5 are reserved for the Header; body starts at 6.
export function What() {
  const body = useRef<HTMLElement>(null);
  useJustif(body);

  return (
    <>
      <section ref={body} className="flex w-full flex-col gap-4">
        <Stagger index={6}>
          <p className={BODY}>{m.what_p1_intro()}</p>
        </Stagger>

        <Stagger index={7}>
          <p className={BODY}>{m.what_p2_border_radius()}</p>
        </Stagger>

        <Stagger index={8}>
          <Divider />
        </Stagger>

        <Stagger index={9}>
          <p className={BODY}>{m.what_p3_two_shapes()}</p>
        </Stagger>

        <Stagger index={10}>
          <p className={BODY}>{m.what_p4_apple_shape()}</p>
        </Stagger>

        <Stagger index={11}>
          <p className={BODY}>{m.what_p5_apple_fixed()}</p>
        </Stagger>

        <Stagger index={12}>
          <Divider />
        </Stagger>

        <Stagger index={13}>
          <p className={BODY}>{m.what_p6_figma_redraw()}</p>
        </Stagger>

        <Stagger index={14}>
          <p className={BODY}>{m.what_p7_smoothing_dial()}</p>
        </Stagger>

        <Stagger index={15}>
          <p className={BODY}>{m.what_p8_css_catching_up()}</p>
        </Stagger>

        <Stagger index={16}>
          <p className={BODY}>{m.what_p9_squircle_keyword()}</p>
        </Stagger>

        <Stagger index={17}>
          <p className={BODY}>{m.what_p10_browser_support()}</p>
        </Stagger>

        <Stagger index={18}>
          <Divider />
        </Stagger>

        <Stagger index={19}>
          <p className={BODY}>{m.what_p11_lisse_fits()}</p>
        </Stagger>

        <Stagger index={20}>
          <p className={BODY}>{m.what_p12_observer()}</p>
        </Stagger>

        <Stagger index={21}>
          <p className={`${BODY} text-text-secondary`}>
            {m.what_p13_docs_pointer()}
          </p>
        </Stagger>
      </section>
    </>
  );
}
