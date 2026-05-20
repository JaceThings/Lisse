import { Demo } from "../components/Demo.tsx";
import { Install } from "../components/Install.tsx";
import { Intro } from "../components/Intro.tsx";
import { Stagger } from "../components/Stagger.tsx";

// Indices 0–5 are header; body starts at 6. On first app load these
// targets are in the future so the cascade plays; on later navigations
// they're in the past and Stagger's skip-gate renders items at their
// final state — the route-level fade in App.tsx carries the transition.
const INTRO_FIRST = 6;
const DEMO_INDEX = 9;
const INSTALL_FIRST = 10;

export function Home() {
  return (
    <>
      <Intro staggerFrom={INTRO_FIRST} />
      <Stagger index={DEMO_INDEX}>
        <Demo />
      </Stagger>
      <Install staggerFrom={INSTALL_FIRST} />
    </>
  );
}
