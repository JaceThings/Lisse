import { useEffect, type ReactNode } from "react";

interface SectionProps {
  /** Anchor slug — always English so deep links survive locale switches. */
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function Section({ id, title, description, children }: SectionProps) {
  // Late hydration can miss the browser's native scroll-to-fragment.
  useEffect(() => {
    if (window.location.hash === `#${id}`) {
      document.getElementById(id)?.scrollIntoView();
    }
  }, [id]);

  return (
    <section id={id} className="flex w-full scroll-mt-24 flex-col gap-4">
      <div className="flex w-full flex-col gap-3 px-[4px] text-text-primary">
        <h2 className="text-[16px] leading-none font-[550] tracking-[-0.25px]">
          {title}
        </h2>
        <p className="text-[14px] leading-[1.4] font-medium tracking-[-0.25px] text-wrap-pretty">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
