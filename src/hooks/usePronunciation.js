import { useCallback, useEffect, useRef, useState } from "react";

const AMERICAN_ENGLISH = "en-US";
const START_WATCHDOG_MS = 4000;
const PLAYBACK_FAILURE_MESSAGE = "发音未能播放，请重试或检查系统语音设置。";

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef([]);
  const activeUtterancesRef = useRef(new Set());
  const latestUtteranceRef = useRef(null);
  const startWatchdogsRef = useRef(new Map());

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

  // Only watchdogs are cleared on unmount; the shared browser TTS engine is
  // never canceled from a cleanup.
  useEffect(
    () => () => {
      for (const watchdog of startWatchdogsRef.current.values()) {
        clearTimeout(watchdog);
      }
      startWatchdogsRef.current.clear();
    },
    [],
  );

  const clearStartWatchdog = useCallback((utterance) => {
    const watchdog = startWatchdogsRef.current.get(utterance);
    if (watchdog === undefined) return;
    clearTimeout(watchdog);
    startWatchdogsRef.current.delete(utterance);
  }, []);

  const releaseUtterance = useCallback(
    (utterance) => {
      activeUtterancesRef.current.delete(utterance);
      clearStartWatchdog(utterance);
      if (latestUtteranceRef.current === utterance) {
        latestUtteranceRef.current = null;
        setIsSpeaking(false);
      }
    },
    [clearStartWatchdog],
  );

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

        utterance.onstart = () => {
          clearStartWatchdog(utterance);
        };
        utterance.onend = () => {
          const isLatest = latestUtteranceRef.current === utterance;
          releaseUtterance(utterance);
          if (isLatest) setMessage("");
        };
        utterance.onerror = (event) => {
          const isLatest = latestUtteranceRef.current === utterance;
          releaseUtterance(utterance);
          if (isLatest && !["interrupted", "canceled"].includes(event?.error)) {
            setMessage(PLAYBACK_FAILURE_MESSAGE);
          }
        };
        setMessage("");
        return utterance;
      } catch {
        setMessage("无法读取英语语音，请检查系统语音设置后重试。");
        return null;
      }
    },
    [isSupported, clearStartWatchdog, releaseUtterance],
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
        latestUtteranceRef.current = utterance;
        setIsSpeaking(true);
        // `speaking` is not proof that audio started. If no start event
        // arrives, drop the playing state instead of animating forever.
        startWatchdogsRef.current.set(
          utterance,
          setTimeout(() => {
            startWatchdogsRef.current.delete(utterance);
            if (latestUtteranceRef.current !== utterance) return;
            latestUtteranceRef.current = null;
            activeUtterancesRef.current.delete(utterance);
            setIsSpeaking(false);
            setMessage(PLAYBACK_FAILURE_MESSAGE);
          }, START_WATCHDOG_MS),
        );
        synthesis.speak(utterance);
        return true;
      } catch {
        releaseUtterance(utterance);
        setMessage(PLAYBACK_FAILURE_MESSAGE);
        return false;
      }
    },
    [createUtterance, releaseUtterance],
  );

  return { isSupported, isSpeaking, speak, message };
}
