import test from "node:test";
import assert from "node:assert/strict";
import { selectAmericanVoice } from "./usePronunciation.js";

test("American voice selection prefers a local default voice", () => {
  const remoteDefault = {
    default: true,
    lang: "en-US",
    localService: false,
    name: "Remote US",
  };
  const localVoice = {
    default: false,
    lang: "en_US",
    localService: true,
    name: "Local US",
  };
  const localDefault = {
    default: true,
    lang: "en-US",
    localService: true,
    name: "Local Default US",
  };

  assert.equal(
    selectAmericanVoice([remoteDefault, localVoice, localDefault]),
    localDefault,
  );
});

test("American voice selection prefers Chrome's clear US voice over a local default", () => {
  const localDefault = {
    default: true,
    lang: "en-US",
    localService: true,
    name: "Samantha",
  };
  const googleVoice = {
    default: false,
    lang: "en-US",
    localService: false,
    name: "Google US English",
  };

  assert.equal(selectAmericanVoice([localDefault, googleVoice]), googleVoice);
});

test("American voice selection skips macOS novelty voices", () => {
  const noveltyDefault = {
    default: true,
    lang: "en-US",
    localService: true,
    name: "Albert",
  };
  const naturalLocalVoice = {
    default: false,
    lang: "en-US",
    localService: true,
    name: "Clear US Voice",
  };

  assert.equal(
    selectAmericanVoice([noveltyDefault, naturalLocalVoice]),
    naturalLocalVoice,
  );
});

test("American voice selection leaves fallback choice to the browser", () => {
  const britishVoice = {
    default: true,
    lang: "en-GB",
    localService: true,
    name: "British English",
  };

  assert.equal(selectAmericanVoice([britishVoice]), null);
});
