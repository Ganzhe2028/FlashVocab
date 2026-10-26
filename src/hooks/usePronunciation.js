import { useCallback, useEffect, useRef, useState } from "react";

const AMERICAN_ENGLISH = "en-US";

const PREFERRED_AMERICAN_VOICE_NAMES = [
  /^google us english$/i,
  /^microsoft .*\bnatural\b.*english.*united states/i,
  /^(samantha|alex|ava(?: \(.*\))?|allison|susan|zoe|nicky|joelle)$/i,
  /^(eddy|flo|reed|rocko|sandy|shelley) \(english \((?:united states|us)\)\)$/i,
  /^microsoft (?:aria|jenny|guy|zira|david|mark).*english.*united states/i,
];

const NOVELTY_AMERICAN_VOICE_NAME =
  /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox)$/i;

const normalizeLanguage = (language = "") =>
  language.trim().replaceAll("_", "-").toLowerCase();

export const selectAmericanVoice = (voices = []) => {
  const americanVoices = voices.filter(
    (voice) => normalizeLanguage(voice?.lang) === "en-us",
  );

  for (const preferredName of PREFERRED_AMERICAN_VOICE_NAMES) {
    const preferredVoice = americanVoices.find((voice) =>
      preferredName.test(voice?.name?.trim() ?? ""),
    );
    if (preferredVoice) return preferredVoice;
  }

  const naturalVoices = americanVoices.filter(
    (voice) => !NOVELTY_AMERICAN_VOICE_NAME.test(voice?.name?.trim() ?? ""),
  );
  const otherEnglishVoices = voices.filter((voice) =>
    /^en(?:-|$)/.test(normalizeLanguage(voice?.lang)) &&
    !NOVELTY_AMERICAN_VOICE_NAME.test(voice?.name?.trim() ?? ""),
  );

  return (
    naturalVoices.find((voice) => voice.localService && voice.default) ??
    naturalVoices.find((voice) => voice.default) ??
    naturalVoices.find((voice) => voice.localService) ??
    naturalVoices[0] ??
    otherEnglishVoices.find((voice) => voice.default) ??
    otherEnglishVoices.find((voice) => voice.localService) ??
    otherEnglishVoices[0] ??
    null
  );
};

const browserSupportsPronunciation = () =>
  typeof window !== "undefined" &&
  Boolean(window.speechSynthesis) &&
  typeof SpeechSynthesisUtterance === "function";

export function usePronunciation() {
  const [isSupported] = useState(browserSupportsPronunciation);
  const [message, setMessage] = useState(() => browserSupportsPronunciation()
    ? "" : "当前浏览器不支持发音，可换用支持语音的浏览器。");
  const voicesRef = useRef([]);
  const activeUtterancesRef = useRef(new Set());

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
        if (!americanVoice) {
          setMessage("没有找到英语语音。请在系统语音设置中添加英语语音后重试。");
          return null;
        }
        utterance.lang = americanVoice.lang || AMERICAN_ENGLISH;
        utterance.rate = 0.9;
        utterance.pitch = 1;
        if (americanVoice) {
          utterance.voice = americanVoice;
        }

        const releaseUtterance = () => activeUtterancesRef.current.delete(utterance);
        utterance.onstart = () => setMessage("正在播放。");
        utterance.onend = () => { releaseUtterance(); setMessage(""); };
        utterance.onerror = (event) => {
          releaseUtterance();
          if (!["interrupted", "canceled"].includes(event?.error)) {
            setMessage("发音未能播放，请重试或检查系统语音设置。");
          }
        };
        setMessage("");
        return utterance;
      } catch {
        setMessage("无法读取英语语音，请检查系统语音设置后重试。");
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
        if (synthesis.speaking || synthesis.pending) {
          synthesis.cancel();
        }
        activeUtterancesRef.current.add(utterance);
        synthesis.speak(utterance);
        return true;
      } catch {
        activeUtterancesRef.current.delete(utterance);
        setMessage("发音未能播放，请重试或检查系统语音设置。");
        return false;
      }
    },
    [createUtterance],
  );

  return { isSupported, speak, message };
}
