import { useEffect, useState } from "react";

// SSR-safe Safari detection. False on the server AND on the client's first
// render (so hydrated markup matches the server), then flips to the real value
// after mount.
// Use anywhere the value branches RENDERED output (Collapse, Preview).
export function useIsSafari(): boolean {
  const [isSafari, setIsSafari] = useState(false);
  useEffect(() => {
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);
  return isSafari;
}
