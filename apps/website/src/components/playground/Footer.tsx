import { Link } from "react-router-dom";
import { Divider } from "../Divider.tsx";

export function Footer() {
  return (
    <footer className="flex w-full flex-col gap-figma-5">
      <Divider />
      <nav
        aria-label="Site"
        className="flex w-full items-start gap-figma-4 text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-secondary whitespace-nowrap"
      >
        {/* `py-2 -my-2` extends tap target to ~33px tall without changing
            the visible footer layout — text stays on its baseline. `Link`
            keeps internal navigation client-side so the lazy Playground
            chunk isn't re-fetched + re-evaluated on every return. */}
        <Link to="/what" className="py-2 -my-2 hover:text-text-primary" data-focus-ring>
          What?
        </Link>
        <Link to="/playground" className="py-2 -my-2 hover:text-text-primary" data-focus-ring>
          Playground
        </Link>
        <Link to="/" className="py-2 -my-2 hover:text-text-primary" data-focus-ring>
          Docs
        </Link>
      </nav>
    </footer>
  );
}
