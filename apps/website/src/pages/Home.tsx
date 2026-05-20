import { Demo } from "../components/Demo.tsx";
import { Install } from "../components/Install.tsx";
import { Intro } from "../components/Intro.tsx";
import { Stagger } from "../components/Stagger.tsx";

// Indices 0–5 are header; body starts at 6.
const INTRO_FIRST = 6;
const DEMO_INDEX = 7;
const INSTALL_FIRST = 8;

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
