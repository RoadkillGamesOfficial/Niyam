"use client";

import { useEffect } from "react";

// REF-1: a brain dump is one action away from any screen. The persistent link is
// in every masthead; this adds the keyboard shortcut for when the pointer is far
// away. It ignores typing, so it never eats an "r" in a form.
export function ReframeShortcut() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key.toLowerCase() !== "r") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (window.location.pathname === "/reframe") {
        return;
      }
      window.location.assign("/reframe");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
