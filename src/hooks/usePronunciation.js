import { useCallback, useEffect, useRef, useState } from "react";

const AMERICAN_ENGLISH = "en-US";

const normalizeLanguage = (language = "") =>
  language.trim().replaceAll("_", "-").toLowerCase();

export const selectAmericanVoice = (voices = []) => {
  const americanVoices = voices.filter(
    (voice) => normalizeLanguage(voice?.lang) === "en-us",
  );

  return (
    americanVoices.find((voice) => voice.localService && voice.default) ??
    americanVoices.find((voice) => voice.localService) ??
    americanVoices.find((voice) => voice.default) ??
    americanVoices[0] ??
    null
  );
};

const browserSupportsPronunciation = () =>
  typeof window !== "undefined" &&
  Boolean(window.speechSynthesis) &&
  typeof SpeechSynthesisUtterance === "function";

export function usePronunciation() {
  const [isSupported] = useState(browserSupportsPronunciation);
  const voicesRef = useRef([]);

  useEffect(() => {
    if (!isSupported) return undefined;

    const synthesis = window.speechSynthesis;
    const refreshVoices = () => {
      try {
        voicesRef.current = synthesis.getVoices();
      } catch {
        voicesRef.current = [];
      }
    };

    refreshVoices();
    synthesis.addEventListener?.("voiceschanged", refreshVoices);

    return () => {
      synthesis.removeEventListener?.("voiceschanged", refreshVoices);
    };
  }, [isSupported]);

  const createUtterance = useCallback(
    (text) => {
      const spokenText = typeof text === "string" ? text.trim() : "";
      if (!isSupported || !spokenText) return null;

      try {
        const currentVoices = window.speechSynthesis.getVoices();
        if (currentVoices.length) {
          voicesRef.current = currentVoices;
        }

        const utterance = new SpeechSynthesisUtterance(spokenText);
        const americanVoice = selectAmericanVoice(voicesRef.current);
        utterance.lang = AMERICAN_ENGLISH;
        utterance.rate = 0.9;
        utterance.pitch = 1;
        if (americanVoice) {
          utterance.voice = americanVoice;
        }
        return utterance;
      } catch {
        return null;
      }
    },
    [isSupported],
  );

  const speak = useCallback(
    (text) => {
      const utterance = createUtterance(text);
      if (!utterance) return false;

      try {
        const synthesis = window.speechSynthesis;
        synthesis.cancel();
        synthesis.speak(utterance);
        return true;
      } catch {
        return false;
      }
    },
    [createUtterance],
  );

  const queueSpeech = useCallback(
    (text) => {
      const utterance = createUtterance(text);
      if (!utterance) return false;

      try {
        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        return false;
      }
    },
    [createUtterance],
  );

  return { isSupported, queueSpeech, speak };
}
