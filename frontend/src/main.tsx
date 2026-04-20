import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (import.meta.env.DEV) {
  void import("axe-core").then(({ default: axe }) => {
    let timer: number | undefined;
    const runAxe = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void axe.run(document.body).then((results) => {
          if (results.violations.length === 0) return;
          console.groupCollapsed(
            `[axe] ${results.violations.length} violation(s) on ${location.pathname}`,
          );
          results.violations.forEach((v) => {
            console.warn(`${v.id} (${v.impact}): ${v.help}`, {
              helpUrl: v.helpUrl,
              nodes: v.nodes.map((n) => n.target.join(" ")),
            });
          });
          console.groupEnd();
        });
      }, 300);
    };

    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    history.pushState = function (...args) {
      const rv = originalPush.apply(this, args);
      runAxe();
      return rv;
    };
    history.replaceState = function (...args) {
      const rv = originalReplace.apply(this, args);
      runAxe();
      return rv;
    };
    window.addEventListener("popstate", runAxe);

    window.setTimeout(runAxe, 800);
  });
}
