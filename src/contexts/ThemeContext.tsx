import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeMode = "dark" | "light";
export type ThemeAccent = "gold" | "ocean" | "forest" | "rose" | "purple" | "sunset";

interface ThemeContextType {
  mode: ThemeMode;
  accent: ThemeAccent;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: ThemeAccent) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const ACCENT_VARS: Record<ThemeAccent, Record<string, string>> = {
  gold: {
    "--gold": "39 58% 53%",
    "--primary": "39 58% 53%",
    "--accent": "39 58% 53%",
    "--ring": "39 58% 53%",
  },
  ocean: {
    "--gold": "211 55% 60%",
    "--primary": "211 55% 60%",
    "--accent": "211 55% 60%",
    "--ring": "211 55% 60%",
  },
  forest: {
    "--gold": "152 41% 49%",
    "--primary": "152 41% 49%",
    "--accent": "152 41% 49%",
    "--ring": "152 41% 49%",
  },
  rose: {
    "--gold": "340 65% 65%",
    "--primary": "340 65% 65%",
    "--accent": "340 65% 65%",
    "--ring": "340 65% 65%",
  },
  purple: {
    "--gold": "268 48% 63%",
    "--primary": "268 48% 63%",
    "--accent": "268 48% 63%",
    "--ring": "268 48% 63%",
  },
  sunset: {
    "--gold": "26 78% 57%",
    "--primary": "26 78% 57%",
    "--accent": "26 78% 57%",
    "--ring": "26 78% 57%",
  },
};

const LIGHT_MODE_VARS: Record<string, string> = {
  "--background": "40 33% 96%",
  "--foreground": "24 20% 20%",
  "--card": "40 25% 92%",
  "--card-foreground": "24 20% 20%",
  "--popover": "40 25% 92%",
  "--popover-foreground": "24 20% 20%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "40 20% 88%",
  "--secondary-foreground": "24 20% 20%",
  "--muted": "30 12% 60%",
  "--muted-foreground": "30 12% 50%",
  "--accent-foreground": "0 0% 100%",
  "--destructive": "5 71% 53%",
  "--destructive-foreground": "0 0% 100%",
  "--border": "30 20% 85%",
  "--input": "30 20% 85%",
  "--surface-1": "40 30% 94%",
  "--surface-2": "40 25% 90%",
  "--surface-3": "40 25% 86%",
  "--code-bg": "40 20% 92%",
  "--gold-light": "39 58% 53% / 0.12",
  "--gold-border": "39 58% 53% / 0.3",
};

const DARK_MODE_VARS: Record<string, string> = {
  "--background": "24 33% 4%",
  "--foreground": "30 14% 78%",
  "--card": "30 25% 8%",
  "--card-foreground": "30 14% 78%",
  "--popover": "30 25% 8%",
  "--popover-foreground": "30 14% 78%",
  "--primary-foreground": "24 33% 4%",
  "--secondary": "30 20% 10%",
  "--secondary-foreground": "30 14% 78%",
  "--muted": "30 12% 37%",
  "--muted-foreground": "30 12% 37%",
  "--accent-foreground": "24 33% 4%",
  "--destructive": "5 71% 53%",
  "--destructive-foreground": "30 14% 78%",
  "--border": "30 28% 11%",
  "--input": "30 28% 11%",
  "--surface-1": "30 33% 5%",
  "--surface-2": "30 25% 8%",
  "--surface-3": "30 25% 10%",
  "--code-bg": "24 33% 2%",
  "--gold-light": "39 58% 53% / 0.1",
  "--gold-border": "39 58% 53% / 0.25",
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    (localStorage.getItem("los-theme-mode") as ThemeMode) || "dark"
  );
  const [accent, setAccentState] = useState<ThemeAccent>(() =>
    (localStorage.getItem("los-theme-accent") as ThemeAccent) || "gold"
  );

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem("los-theme-mode", m);
  };
  const setAccent = (a: ThemeAccent) => {
    setAccentState(a);
    localStorage.setItem("los-theme-accent", a);
  };

  // Apply CSS vars
  useEffect(() => {
    const root = document.documentElement;
    const modeVars = mode === "light" ? LIGHT_MODE_VARS : DARK_MODE_VARS;
    const accentVars = ACCENT_VARS[accent];

    // Apply mode vars first
    Object.entries(modeVars).forEach(([k, v]) => root.style.setProperty(k, v));
    // Then accent vars (override primary/gold)
    Object.entries(accentVars).forEach(([k, v]) => root.style.setProperty(k, v));

    // Update gold-light and gold-border based on accent
    const accentHsl = accentVars["--gold"];
    root.style.setProperty("--gold-light", `${accentHsl} / ${mode === "light" ? "0.12" : "0.1"}`);
    root.style.setProperty("--gold-border", `${accentHsl} / ${mode === "light" ? "0.3" : "0.25"}`);
  }, [mode, accent]);

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export const ACCENT_OPTIONS: { key: ThemeAccent; label: string; color: string }[] = [
  { key: "gold", label: "暗金", color: "hsl(39 58% 53%)" },
  { key: "ocean", label: "海洋", color: "hsl(211 55% 60%)" },
  { key: "forest", label: "森林", color: "hsl(152 41% 49%)" },
  { key: "rose", label: "玫瑰", color: "hsl(340 65% 65%)" },
  { key: "purple", label: "紫罗兰", color: "hsl(268 48% 63%)" },
  { key: "sunset", label: "日落", color: "hsl(26 78% 57%)" },
];
