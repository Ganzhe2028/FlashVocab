# Repository Guidelines

> MUST DO：Things that must be done: Every time there is a modification or update, the corresponding document content must also be updated. Every time a task begins, one needs to re-read the document.

## Project Structure & Module Organization

This repository is a Vite + React flashcard app with a separate vocabulary list.

- Root: `index.html`, `package.json`/`package-lock.json`, `vite.config.js`, `run.sh`, and `vocab.md`.
- `dist/ui-ux-pro-max.skill` stores the packaged Codex skill artifact.
- `src/` holds the app: `main.jsx` mounts React, `App.jsx` contains all flashcard logic and `baseDeck` data, and `index.css` sets global styles, theme variables, and all animations.
- `node_modules/` is generated; do not edit it.
  If you add files (docs or assets), keep them in the root or `src/` and document them here.

## App Architecture & Mode System

`App.jsx` manages a three-mode state machine via the `mode` state (`'study' | 'rest' | 'spell'`):

### `study` mode (default)

Standard flashcard loop. Shows one card at a time; Space/Enter toggle and advance. When revealed, the card shows part of speech, EN/ZH meaning, and a light-weight list of 2-3 B1-B2-friendly example sentences with bolded focus phrases.

Bottom progress bar and count follow the study card position in this mode.

**Keyboard shortcuts:**

- `Space` — toggle reveal/hide meaning
- `Enter` — reveal if hidden; advance to next card if revealed; if on the **last card and already revealed**, enter `rest` mode
- `Tab` / `←` — previous card
- `Delete` / `Backspace` — remove current card from deck
- `ArrowLeft` — previous card

**Loop shuffle:** by default, every time a new pass starts from card 1 (Next wrapping past the last card, returning from `rest` mode, or finishing `spell` mode), the deck order is shuffled once with a Fisher-Yates shuffle; the new first card is never the card that was just on screen. The `Shuffle Loop: On / Off` button in the bottom control bar toggles this off (state is session-only, default on). `Reset Deck` restores the original order without shuffling. The shuffle only reorders the deck for study passes; `spell` mode uses the deck in its current order.

### `rest` mode (贫血模式)

Triggered after completing a full round (last card, revealed, Enter pressed). Clears all word details and shows a minimal screen:

- Title: "随手拼？"
- Subtitle: "enter 继续刷词 / space 开始随手拼"

**Keyboard shortcuts:**

- `Enter` — return to `study` mode at card 1
- `Space` — enter `spell` mode

### `spell` mode (随手拼)

Spelling practice over the current deck in order. Shows only pos + meaning; the word is hidden.

Bottom progress bar and count switch to `spellIndex`, so both the bar and the numeric counter reflect current spelling progress instead of the study-card position.

**State variables used:** `spellIndex` (current word index), `spellInput` (typed string), `spellResult` (`null | 'correct' | 'wrong'`), `shakeKey` (incremented to replay shake animation).

**Keyboard behaviour:**

- Letter keys / `Space` — append to `spellInput` (space supported for multi-word phrases); if `spellResult === 'wrong'`, clears input and starts fresh from that character
- `Backspace` — delete last character (only when not correct)
- `Enter` — submit; correct → green + show syllabified answer; wrong → shake animation + red text + show correct answer
- `Enter` again when wrong (without retyping) → replay shake
- `Esc` — exit to `study` mode at current index
- After spelling all words → automatically return to `study` mode at card 1

**Shake animation:** implemented by incrementing `shakeKey`, which is set as the React `key` prop on the input display element, forcing a re-mount and replaying the CSS `shake` keyframe animation.

## GitHub Button

A fixed, circular GitHub logo button sits in the top-right corner of the viewport (`position: fixed; top: 16px; right: 16px`). It links to `https://github.com/Ganzhe2028/vocab2` and uses a liquid-glass visual style (frosted backdrop filter, semi-transparent background, inner highlight ring).

## Content Format & Naming Conventions

`vocab.md` entries use a multi-line block separated by a blank line. Use a word label in brackets, Title Case; then one meaning line followed by 2-3 numbered sentence/focus pairs with `- Sentence 1:`, `- Focus 1:`, `- Sentence 2:`, `- Focus 2:` and so on. Each `Focus` must match the exact substring that should be emphasized inside its sentence. Avoid extra indentation or nested lists, and prefer ASCII unless a word requires otherwise.

Example format:

```md
[Word]

- Meaning (EN): short, clear definition
- Sentence 1: A full sentence that ends with a period.
- Focus 1: Exact phrase from sentence 1 to emphasize.
- Sentence 2: Another sentence that shows the same or a related usage.
- Focus 2: Exact phrase from sentence 2 to emphasize.
```

`src/App.jsx` `baseDeck` entries include `term`, `syllables`, `respell`, `pos`, `meaning`, `meaningZh`, and `examples`. Keep `term` in Title Case, use short part-of-speech tags with trailing periods (e.g. `adj.`), and keep `examples` as a 2-3 item array of `{ sentence, focus }` objects where `focus` appears verbatim inside `sentence`. Prefer B1-B2-friendly daily-life contexts and avoid adding several extra hard words to the same sentence.

Example `baseDeck` entry:

```js
{
  term: "Vacant",
  syllables: "Va·cant",
  respell: "[VAY-kunt]",
  pos: "adj.",
  meaning: "empty; not occupied",
  meaningZh: "空的；未被占用",
  examples: [
    {
      sentence: "The bus had a vacant seat by the door.",
      focus: "vacant seat",
    },
    {
      sentence: "We found a vacant room at the hotel.",
      focus: "vacant room",
    },
  ],
},
```

Append new words to the end of both `vocab.md` and `baseDeck` unless you are deliberately reordering for a study plan.

## Build, Test, and Development Commands

- `npm install` (or `npm ci`)
- `./run.sh`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Testing Guidelines

There are no automated tests. Manually verify the UI renders and the deck navigation (Enter, Space, Tab, Delete) works after changes, then proofread for spelling and consistency.

## Commit & Pull Request Guidelines

This is a git repository. Use short, imperative commit messages like "Add 5 new words" and keep PRs focused; include a brief summary, the number of entries added or edited, and note any reorderings.

## Skills

- ui-ux-pro-max: Searchable database of UI styles, color palettes, font pairings, chart types, product recommendations, UX guidelines, and stack-specific best practices. (file: .cursor/commands/ui-ux-pro-max.md)
