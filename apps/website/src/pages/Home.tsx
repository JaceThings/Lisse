import { Demo } from "../components/Demo.tsx";
import { Install } from "../components/Install.tsx";
import { Intro } from "../components/Intro.tsx";

// Indices 0–5 are header; body starts at 6.
const INTRO_INDEX = 6;
const DEMO_INDEX = 7;
const INSTALL_FIRST = 8;

export function Home() {
  return (
    <>
      <Intro staggerIndex={INTRO_INDEX} />
      <Demo staggerIndex={DEMO_INDEX} />
      <Install staggerFrom={INSTALL_FIRST} />
    </>
  );
}
