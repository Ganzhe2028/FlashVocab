import { useCallback, useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "flashvocab-theme-v1";
export const THEME_PREFERENCES = ["system", "light", "dark"];

const readThemePreference = () => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_PREFERENCES.includes(stored) ? stored : "system";
  } catch {
    return "system";
  }
};

const systemTheme = () => {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export function useThemePreference() {
  const [preference, setPreference] = useState(readThemePreference);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = preference === "system" ? systemTheme() : preference;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themePreference = preference;
    };

    applyTheme();
    if (preference !== "system" || !media) return undefined;
    media.addEventListener?.("change", applyTheme);
    return () => media.removeEventListener?.("change", applyTheme);
  }, [preference]);

  const updatePreference = useCallback((value) => {
    if (!THEME_PREFERENCES.includes(value)) return;
    setPreference(value);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // The current page can still use the selected theme when storage is unavailable.
    }
  }, []);

  return { themePreference: preference, setThemePreference: updatePreference };
}
