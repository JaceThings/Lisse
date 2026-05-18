import { Header } from "./components/Header.tsx";
import { Intro } from "./components/Intro.tsx";
import { Demo } from "./components/Demo.tsx";
import { FocusRingOverlay } from "./components/FocusRingOverlay.tsx";
import { Install } from "./components/Install.tsx";
import { SelectionHighlight } from "./components/SelectionHighlight.tsx";
import { Stagger } from "./components/Stagger.tsx";

// Reveal sequence top to bottom: header heading + 4 definition lines (5),
// three intro paragraphs (3), demo (1), four install rows (4). Header,
// Intro, and Install accept the starting index and wrap each line
// internally; Demo is a single stagger item.
const HEADER_FIRST = 0;
const INTRO_FIRST = 5;
const DEMO_INDEX = 8;
const INSTALL_FIRST = 9;

/** Single 510px column: header, intro, demo, install. Every rounded surface
 *  renders through @lisse/react's SmoothCorners — the page dogfoods the library. */
export function App() {
  return (
    <main className="flex min-h-dvh w-full items-stretch justify-center bg-bg">
      <article className="relative flex w-[510px] max-w-full flex-col items-stretch gap-figma-9 py-figma-20 max-[560px]:w-[calc(100vw-32px)] max-[560px]:py-figma-6">
        <Header staggerFrom={HEADER_FIRST} />
        <Intro staggerFrom={INTRO_FIRST} />
        <Stagger index={DEMO_INDEX}>
          <Demo />
        </Stagger>
        <Install staggerFrom={INSTALL_FIRST} />
      </article>
      <FocusRingOverlay />
      <SelectionHighlight />
    </main>
  );
}
