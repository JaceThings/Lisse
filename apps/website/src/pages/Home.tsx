import { Header } from "../components/Header.tsx";
import { Intro } from "../components/Intro.tsx";
import { Demo } from "../components/Demo.tsx";
import { Install } from "../components/Install.tsx";
import { Layout } from "../components/Layout.tsx";
import { Stagger } from "../components/Stagger.tsx";

// Reveal sequence top to bottom: header heading + 4 definition lines (5),
// three intro paragraphs (3), demo (1), four install rows (4). Header,
// Intro, and Install accept the starting index and wrap each line
// internally; Demo is a single stagger item.
const HEADER_FIRST = 0;
const INTRO_FIRST = 5;
const DEMO_INDEX = 8;
const INSTALL_FIRST = 9;

/** Landing page. Every rounded surface renders through @lisse/react's
 *  SmoothCorners — the page dogfoods the library. */
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
