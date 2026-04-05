import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

interface ThemeContextType {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ dark: false, toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

function getInitialTheme(): boolean {
  const stored = localStorage.getItem("theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const toggle = () => setDark((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
