import { Divider } from "./Divider.tsx";
import { Stagger } from "./Stagger.tsx";
import { m } from "../paraglide/messages.js";

// Definitions stay as <p> not <dl>: the visible "1, 2, b, 3" numbering is
// part of the prose, so <dt>/<dd> would announce the leading digit twice.
const DEF = "text-[14px] leading-[1.2] font-medium tracking-[-0.25px]";

interface HeaderProps {
  /** Reveal index for the heading row; each definition line rises by 1. */
  staggerFrom: number;
}

export function Header({ staggerFrom }: HeaderProps) {
  return (
    <header className="flex w-full flex-col gap-5">
      <div
        className="flex w-full flex-col gap-2.5"
        role="group"
        aria-labelledby="lisse-heading"
      >
        <Stagger index={staggerFrom}>
          <div className="flex items-end gap-2 whitespace-nowrap text-text-primary">
            <h1
              id="lisse-heading"
              className="relative text-[16px] leading-none font-[550] tracking-[-0.25px]"
            >
              lisse
            </h1>
            <p className="text-[14px] leading-none font-[450] tracking-[-0.25px]">
              <span aria-hidden>
                /lēs/ <em className="italic">{m.header_pos_adjective()}</em>{" "}
                [{m.header_etymology_french_abbr()}{" "}
                <em className="italic">lisse</em>,{" "}
                <em className="italic">{m.header_etymology_smooth()}</em>]
              </span>
              <span className="sr-only" data-highlight-exclude>
                {m.header_pronunciation_sr()}
              </span>
            </p>
          </div>
        </Stagger>
        <div className="flex flex-col gap-2 pl-2 text-text-secondary">
          <Stagger index={staggerFrom + 1}>
            <p className={DEF}>
              <span className="font-[550] proportional-nums">1</span>{" "}
              {m.header_def_1()} (
              <em className="italic">{m.header_def_1_example()}</em>).
            </p>
          </Stagger>
          <Stagger index={staggerFrom + 2}>
            <p className={DEF}>
              <span className="font-[550] proportional-nums">2</span>{" "}
              {m.header_def_2()}
            </p>
          </Stagger>
          <Stagger index={staggerFrom + 3}>
            <p className={`pl-2 ${DEF}`}>
              <span className="font-[550] proportional-nums">b</span>{" "}
              {m.header_def_b()}
            </p>
          </Stagger>
          <Stagger index={staggerFrom + 4}>
            <p className={DEF}>
              <span className="font-[550] proportional-nums">3</span>{" "}
              {m.header_def_3()}
            </p>
          </Stagger>
        </div>
      </div>
      <Stagger index={staggerFrom + 5}>
        <Divider />
      </Stagger>
    </header>
  );
}
