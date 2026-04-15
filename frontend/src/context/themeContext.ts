import { createContext } from "react";

export interface ThemeContextType {
  dark: boolean;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({ dark: false, toggle: () => {} });
