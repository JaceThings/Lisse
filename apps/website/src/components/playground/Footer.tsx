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
            the visible footer layout — text stays on its baseline. */}
        <a href="/what" className="py-2 -my-2 hover:text-text-primary" data-focus-ring>
          What?
        </a>
        <a href="/playground" className="py-2 -my-2 hover:text-text-primary" data-focus-ring>
          Playground
        </a>
        <a href="/" className="py-2 -my-2 hover:text-text-primary" data-focus-ring>
          Docs
        </a>
      </nav>
    </footer>
  );
}
