import assert from "node:assert/strict";
import test from "node:test";

import { findTextRange, getHighlightedSentence } from "./highlightSentence.js";

test("findTextRange matches case-insensitively and trims the query", () => {
  assert.deepEqual(findTextRange("A Vacant room is ready.", "  vacant ROOM  "), {
    start: 2,
    end: 13,
  });
});

test("getHighlightedSentence preserves the sentence's original casing", () => {
  assert.deepEqual(
    getHighlightedSentence(
      "We found a VACANT room nearby.",
      "vacant room",
      "Vacant",
    ),
    {
      before: "We found a ",
      highlight: "VACANT room",
      after: " nearby.",
    },
  );
});

test("getHighlightedSentence falls back to the card term", () => {
  assert.deepEqual(
    getHighlightedSentence("The seat is vacant.", "missing phrase", "Vacant"),
    {
      before: "The seat is ",
      highlight: "vacant",
      after: ".",
    },
  );
});

test("getHighlightedSentence returns null when neither focus nor term matches", () => {
  assert.equal(
    getHighlightedSentence("The room is ready.", "missing", "Vacant"),
    null,
  );
  assert.equal(getHighlightedSentence(null, "missing", "Vacant"), null);
});
