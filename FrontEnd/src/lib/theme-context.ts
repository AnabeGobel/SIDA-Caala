import { createContext } from "react";

export type Theme = "light" | "dark";

export const STORAGE_KEY = "sida.theme";
export const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: "light",
  setTheme: () => {},
});
