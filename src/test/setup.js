import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const clipboardWriteText = vi.fn(() => Promise.resolve());
const createObjectURL = vi.fn(() => "blob:vocab-test");
const revokeObjectURL = vi.fn();
const americanVoice = {
  default: true,
  lang: "en-US",
  localService: true,
  name: "Test US Voice",
};
const speechSynthesisCancel = vi.fn();
const speechSynthesisSpeak = vi.fn();
const speechSynthesisGetVoices = vi.fn(() => [americanVoice]);
const speechSynthesisAddEventListener = vi.fn();
const speechSynthesisRemoveEventListener = vi.fn();
const speechSynthesisResume = vi.fn();

class MockSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.lang = "";
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }
}

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText: clipboardWriteText },
});

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: createObjectURL,
});

Object.defineProperty(URL, "revokeObjectURL", {
  configurable: true,
  value: revokeObjectURL,
});

Object.defineProperty(window, "speechSynthesis", {
  configurable: true,
  value: {
    addEventListener: speechSynthesisAddEventListener,
    cancel: speechSynthesisCancel,
    getVoices: speechSynthesisGetVoices,
    removeEventListener: speechSynthesisRemoveEventListener,
    resume: speechSynthesisResume,
    speak: speechSynthesisSpeak,
    speaking: false,
    pending: false,
    paused: false,
  },
});

vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);

vi.stubGlobal(
  "requestAnimationFrame",
  vi.fn((callback) => {
    callback(performance.now());
    return 1;
  }),
);
vi.stubGlobal("cancelAnimationFrame", vi.fn());

beforeEach(() => {
  window.localStorage.clear();
  clipboardWriteText.mockClear();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  speechSynthesisCancel.mockClear();
  speechSynthesisSpeak.mockClear();
  speechSynthesisGetVoices.mockClear();
  speechSynthesisAddEventListener.mockClear();
  speechSynthesisRemoveEventListener.mockClear();
  speechSynthesisResume.mockClear();
  window.speechSynthesis.speaking = false;
  window.speechSynthesis.pending = false;
  window.speechSynthesis.paused = false;
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
