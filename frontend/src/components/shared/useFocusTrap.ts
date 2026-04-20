import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );

    if (!root.contains(document.activeElement)) {
      focusables()[0]?.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || !root.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [active]);

  return ref;
}
