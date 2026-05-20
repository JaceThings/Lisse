import { Demo } from "../components/Demo.tsx";
import { Install } from "../components/Install.tsx";
import { Intro } from "../components/Intro.tsx";
import { Stagger } from "../components/Stagger.tsx";

// Body Staggers share the global APP_MOUNT_MS anchor (no StaggerScope
// here). On first app load their delays are still in the future, so the
// cascade plays. On navigation those delays are far in the past, so
// items animate immediately at full opacity — the route-level fade in
// App.tsx is what carries the visible transition between routes.
// Indices 0–5 are header; body starts at 6.
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
