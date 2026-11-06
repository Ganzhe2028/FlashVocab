import { useCallback, useEffect, useState } from "react";

export const WORD_FONT_STORAGE_KEY = "flashvocab-word-font-v1";
export const WORD_FONT_PREFERENCES = ["crimson", "system"];

const readWordFontPreference = () => {
  try {
    const stored = window.localStorage.getItem(WORD_FONT_STORAGE_KEY);
    return WORD_FONT_PREFERENCES.includes(stored) ? stored : "crimson";
  } catch {
    return "crimson";
  }
};

export function useWordFontPreference() {
  const [preference, setPreference] = useState(readWordFontPreference);

  useEffect(() => {
    document.documentElement.dataset.wordFont = preference;
  }, [preference]);

  const updatePreference = useCallback((value) => {
    if (!WORD_FONT_PREFERENCES.includes(value)) return;
    setPreference(value);
    try {
      window.localStorage.setItem(WORD_FONT_STORAGE_KEY, value);
    } catch {
      // The current page can still use the selected font when storage is unavailable.
    }
  }, []);

  return { wordFontPreference: preference, setWordFontPreference: updatePreference };
}
