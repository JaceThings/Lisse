import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="flex w-full flex-col gap-figma-4">
      <div className="flex w-full flex-col gap-figma-3 px-[4px] text-text-primary">
        <h2 className="text-[16px] leading-none font-[550] tracking-[-0.25px]">
          {title}
        </h2>
        <p className="text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-justify hyphens-auto">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
