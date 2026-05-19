import { Header } from "../components/Header.tsx";
import { Intro } from "../components/Intro.tsx";
import { Demo } from "../components/Demo.tsx";
import { Install } from "../components/Install.tsx";
import { Layout } from "../components/Layout.tsx";
import { Stagger } from "../components/Stagger.tsx";

// Reveal sequence: header (5 lines) → intro (3) → demo (1) → install (4).
// Header/Intro/Install accept the starting index and wrap each line.
const HEADER_FIRST = 0;
const INTRO_FIRST = 5;
const DEMO_INDEX = 8;
const INSTALL_FIRST = 9;

export function Home() {
  return (
    <Layout>
      <Header staggerFrom={HEADER_FIRST} />
      <Intro staggerFrom={INTRO_FIRST} />
      <Stagger index={DEMO_INDEX}>
        <Demo />
      </Stagger>
      <Install staggerFrom={INSTALL_FIRST} />
    </Layout>
  );
}
