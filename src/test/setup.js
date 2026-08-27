import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const clipboardWriteText = vi.fn(() => Promise.resolve());
const createObjectURL = vi.fn(() => "blob:vocab-test");
const revokeObjectURL = vi.fn();

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
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
