import { Divider } from "./Divider.tsx";
import { Stagger } from "./Stagger.tsx";

// Definitions stay as <p> not <dl>: the visible "1, 2, b, 3" numbering is
// part of the prose, so <dt>/<dd> would announce the leading digit twice.
const DEF = "text-[14px] leading-[1.2] font-medium tracking-[-0.25px]";

interface HeaderProps {
  /** Reveal index for the heading row; each definition line rises by 1. */
  staggerFrom: number;
}

export function Header({ staggerFrom }: HeaderProps) {
  return (
    <header className="flex w-full flex-col gap-figma-5">
      <div
        className="flex w-full flex-col gap-2.5"
        role="group"
        aria-labelledby="lisse-heading"
      >
        <Stagger index={staggerFrom}>
          <div className="flex items-end gap-figma-2 whitespace-nowrap text-text-primary">
            <h1
              id="lisse-heading"
              className="text-[16px] leading-none font-[550] tracking-[-0.25px]"
            >
              lisse
            </h1>
            <p className="text-[14px] leading-none font-[450] tracking-[-0.25px]">
              <span aria-hidden>
                /lēs/ <em className="italic">adj.</em> [F.{" "}
                <em className="italic">lisse</em>,{" "}
                <em className="italic">smooth</em>]
              </span>
              <span className="sr-only">
                Pronounced lees, adjective, from French lisse meaning smooth.
              </span>
            </p>
          </div>
        </Stagger>
        <div className="flex flex-col gap-figma-2 pl-figma-2 text-text-secondary">
          <Stagger index={staggerFrom + 1}>
            <p className={DEF}>
              <span className="font-[550] proportional-nums">1</span> having an even, unbroken
              surface; smooth to the touch (
              <em className="italic">un galet lisse</em>).
            </p>
          </Stagger>
          <Stagger index={staggerFrom + 2}>
            <p className={DEF}>
              <span className="font-[550] proportional-nums">2</span> a sleek; without break or
              rough patch (cheveux lisses).
            </p>
          </Stagger>
          <Stagger index={staggerFrom + 3}>
            <p className={`pl-figma-2 ${DEF}`}>
              <span className="font-[550] proportional-nums">b</span> (of a curve, line, or
              transition) continuous; without abrupt change (une courbe lisse).
            </p>
          </Stagger>
          <Stagger index={staggerFrom + 4}>
            <p className={DEF}>
              <span className="font-[550] proportional-nums">3</span> fig. polished,
              frictionless; flowing without interruption.
            </p>
          </Stagger>
        </div>
      </div>
      <Divider />
    </header>
  );
}
