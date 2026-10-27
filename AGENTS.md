# Repository Guidelines

> MUST DO：Things that must be done: Every time there is a modification or update, the corresponding document content must also be updated. Every time a task begins, one needs to re-read the document.

### Active redesign spec (2026-10-19)

`docs/flashvocab-redesign-2026-10-19.md` defines the next-stage direction (wave lifecycle, judgment-driven exposure, question-type matrix, mastery model). Implementation work follows that spec; when behavior ships, update both that document and this file per the MUST DO rule. Delivered changes are tracked in that document's implementation section; otherwise the 3.0 contract below remains authoritative.

### Import-first usability pass (2026-10-27)

`docs/flashvocab-import-first-2026-10-27.md` records the current first-use contract. It supersedes earlier copy and behavior for the one-minute guide, contextual first-card prompts, import-time DeepSeek preparation, the old header/panel navigation, and scenario learning as the first screen of a new wave. The approved import path is a three-step wizard with one primary action per step: (1) choose file or paste, (2) confirm the recognized words, (3) start learning. It supports direct Word/Excel/CSV/text recognition, a visible preview, and an optional copy-paste AI fill step that produces plain lines rather than learner-facing JSON.

## FlashVocab 3.0 Current Implementation (2026-10-27)

The completed rewrite is defined by `docs/flashvocab-3-rewrite-plan.md`. The design brief and user-flow document preserve historical design context; do not restore removed 2.x behavior such as the `rest` choice screen, familiar-mode switch, return cap, shuffle switch, route system, or persistent learning snapshot.

### Architecture and source ownership

- `src/App.jsx` composes the one-page reducer application and owns storage, clipboard, speech, and download side effects. `src/learningAlgorithm.js` owns stable IDs, independent study/spell scoring, shuffled queues, bounded empty-round advancement, and the single Undo slot.
- The mode set is `prepare | study | spell | pause | summary | quiz | mastered | empty`. Current views are `ImportView`, `StudyView`, `SpellView`, `QuestionView`, `StatusView` (including cycle summaries and graduation), and one right-side `ManagePanel`.
- `useAppKeyboard`, `useQuietChrome`, `usePronunciation`, and `useThemePreference` isolate shortcuts, peripheral hiding, Web Speech, and appearance selection.
- `src/data/baseDeck.js` is the built-in deck source; `src/utils/deckImport.js` owns ZIP/DOCX/XLSX text extraction, tolerant teacher-list parsing (pairs, numbering, POS, phonetics, tables, split lines, Chinese-first rows), definition-versus-example classification, legacy repair of a lone definition stored as an example, and export normalization; `src/utils/importFill.js` builds and merges the learner-facing AI fill prompt, detects matching/fill-in worksheet output, and builds the worksheet rescue prompt; `src/storage/learningStorage.js` owns validated asset persistence.
- `src/questionBuilder.js` builds live definition MCQ, example-based scenarios, focus-cloze word banks, and counterpart contrast questions; `QuestionView` renders choices, feedback, and quiz results. Options are generated when each question is entered, never read from prebuilt imported options. Scenario masking replaces whole target occurrences and does not guess inflections. Word banks blank an exact supplied focus and include all distinct active-wave terms plus up to three available old-wave/counterpart extras; removed words stay excluded. Contrast requires relatedWord plus miniScenario or contrastScenarios, shuffles the pair, and validates supplied answer keys against that pair.
- `src/mastery.js` owns per-word knowledge priority and graduation; `src/storage/masteryStorage.js` validates and persists only streak, mistakes, fuzzy count, and lastSeen under `flashvocab-mastery-v1`.
- `src/waveModel.js` owns wave metadata and recorded creation dates. Stable IDs include non-legacy wave IDs so the same term can belong to separate waves; legacy IDs and removals do not change during migration.
- `src/aiPreparation.js` fills optional current-wave materials through native fetch to DeepSeek. It is offered only inside the deck panel, after words already exist; importing never requires a key or waits for AI. `AIPreparationControls` keeps the API key only in App memory; credentials never enter deck state or persistence. Six-word batches validate coverage, term/index identity, JSON completion, picture length, focus examples, and both contrast answers before any source update. Failed, canceled, timed-out, or stale requests leave assets unchanged. Applying current-wave material resets the current session, remaps identity-derived mastery/removals, and is undoable.
- `src/memorySketch.js` validates fixed icon/short-label picture data and supplies meaning-specific sketches for the 24 built-in terms; the retained `MemoryPicture` renderer is not mounted by recognition after the 2026-10-26 rollback. Picture data remains compatible with preparation and export.
- Tests live beside their modules. `src/App.test.jsx` covers UI behavior, `.test.js` files cover pure logic and hooks, and `src/test/setup.js` configures the UI test environment.
- `dist/` is tracked and regenerated by `npm run build`; `node_modules/` is generated and must not be edited. Document any new top-level tooling or source directory here.

### Current learning behavior

- Spelling defaults off; recognition ends at a summary and continues to recognition. Settings can enable all-word spelling (recognition → spelling → summary → recognition) or only the current recognition round's unknown words. An already started or paused spelling queue is retained. In each mode, two correct results in distinct rounds hide a word for exactly the next complete round (`dueRound = scoredRound + 2`). A successful return rests it again; a failed return releases only that mode. Every due word returns, and all-empty scheduling is bounded.
- After a cycle, a summary separates known/unknown first judgments, any first-attempt spelling results, and weak/unseen/steady/graduated mastery counts from the same learning state. Practice repeats and retries never inflate counts or replace a first failure. Enter continues the already scheduled next round.
- Summary actions have two levels: continue/switch-list first, then a labelled two-by-two practice grid with plain-language descriptions for each question type. Practice-button layout overrides generic button alignment and spacing. The deck panel's collapsed "专项练习" section opens the same four modes without changing learning state.
- Sample loading says the examples were loaded for a first visitor; replacing an existing library explicitly says it was replaced. Panel and toast feedback share that context.
- Missing contrast material explains how to prepare it in the deck panel, without exposing JSON field names in learner-facing feedback; missing-scenario guidance appears only when that practice is opened.
- Word-bank labels use Title Case for a consistent display; answer comparisons, original term fields, IDs and exports keep source values.
- Word banks explicitly explain that only the first nine positions have numeric shortcuts; later choices retain native Tab/Enter and pointer access.
- Recognition presentation follows the pre-redesign `b35ef9a` baseline: full examples return below definitions, origin and counterpart share a collapsed disclosure, and no memory picture or microScene is displayed. Header accessibility, wave management, practice modes and other unrelated behavior remain current.
- Missing part-of-speech metadata does not render a placeholder. The metadata row is omitted when both part of speech and respelling are absent; supplied pronunciation remains visible independently.
- Recognition and spelling feedback display syllable separators as `·`, including hyphenated imported syllables. Completion prompts request `·`; source fields, IDs, exports, and respelling stay unchanged.
- Recognition uses only Q known and E unknown; both reveal definitions and selected examples with origin/counterpart folded. N commits and advances; Q also offers M correction to unknown. W is inactive, and non-boolean recognition judgments are ignored. Historical fuzzy mastery values remain readable without creating new fuzzy results. ← reviews, and Delete/Backspace moves a word out.
- The optional "recognized words advance directly" setting defaults off and resets with session preferences. When on, Q uses the same scoring/queue transition to commit immediately; E stays two-step. Next-card pronunciation remains synchronous in that Q event, and help does not offer M for this fast path.
- Each first unknown recognition result schedules two within-round practice exposures, normally after three other cards. Short or exhausted queues drain the remaining practices before spelling. Practices never score again or create further practices; remove and Undo retain their existing semantics.
- Review retains the round's first-judgment map. Removing the last pending primary/practice or spelling card completes that round without repeating already scored cards. Removing a different word keeps the paused spelling card aligned by ID and retains its first result; Undo restores the exact prior practice/queue scene.
- Graduation does not discard an already started/paused spelling queue or an all-word spelling round the user explicitly enabled. Practice repeats show their own measured 1/2 and 2/2 progress rather than a pending primary-card index.
- Quiz practice opens from cycle summaries or deck management and returns to the retained learning scene. MCQ draws up to three unique distractors from the active deck, prioritizes an in-deck counterpart, and shuffles positions on every entry. Small decks use available choices; absent required content produces a visible notice. Keys 1–9 select the first nine choices, all choices support native Tab/click, N advances, and each question accepts one scored selection.
- Knowledge priority uses first recognition judgments and first quiz selections, excluding spelling and within-round practice repeats. Weak words precede unseen words, then steady words; same-priority ties may shuffle. Three consecutive successful independent round/quiz encounters graduate a word from recognition. Find-back resets its streak and study rest state and is undoable. Non-graduated due cards still return under the existing rest contract.
- Import adds a named wave, keeps previous words and mastery, and cold-stores prior active waves. Recognition and MCQ use active waves only. The deck panel can rename a wave, select one wave, cold-store it, or revive all waves for semester review; revival includes graduates but respects removed words. Wave changes and imports share the existing Undo slot. A library with only cold waves opens preparation with access to its wave list.
- Every new or returning wave starts with recognition. Scenario practice is never a surprise first screen; it is available from the summary and the deck panel's "专项练习" section. Importing while mid-learning preserves the existing scene until the new wave is committed, and Undo from the import page restores that scene rather than the import form.
- Spelling uses a real input. An empty or wrong first submission records unknown and clears the input; the word must then be retyped correctly. Esc pauses the retained spelling queue.
- Automatic pronunciation defaults off. When enabled, recognition entry, Q/E reveal, N/M advance, and spelling submission speak through Web Speech. Manual replay remains available. Pointer actions release focus so global learning keys keep working; deliberate Tab navigation stays native and visibly focused.
- Recognition and spelling show Chinese first in the former large English style, followed by English in the former smaller Chinese style (position, size, weight, color, line height and letter spacing). Both use the same inherited system font. Recognition restores selected full examples and highlighted focus phrases; source data, exports and quiz questions retain their original language fields. `microScene`, `memorySketch`, `distractors`, `usageTags`, `miniScenario` and `contrastScenarios` still round-trip and support preparation, but no picture or usage-tag block is inserted into the recognition answer. AI preparation still requires an exact whole-target example and matching focus.

### Pronunciation contract and diagnosis

- Speech triggered by a learning action must be called synchronously inside that initiating event. Active utterances stay referenced until completion.
- App computes each reducer transition once in its event dispatcher, speaks before committing the next scene, and does not start learning speech from an effect. Asynchronous import/material completion does not initiate speech. Summary continuation, review, remove, Undo, and preference-driven study entry follow the same synchronous path.
- Voice choice prefers `Google US English`, then natural Microsoft/macOS American voices, and excludes novelty voices such as Albert, Whisper, and Zarvox.
- When no natural American voice exists, other English voices may be used. Missing English voices and playback errors produce visible feedback. The replay control uses a speaker SVG. Utterance references are released by completion/error events, never by effect cleanup.
- Do not call browser-global `speechSynthesis.cancel()` while idle or from React cleanup. Strict Mode and Vite HMR run cleanup during normal development, and canceling there can wedge a Chromium process-wide TTS backend. Interrupt only when speech is actively speaking or pending.
- `speechSynthesis.speaking === true` is not proof that audio started. Validate `start` plus `end`/`error` events and perform an audible check. On 2026-09-10 Chrome completed Google-voice events normally; a long-running Arc process stalled both app playback and a direct local-voice probe with no events, requiring a full Arc restart rather than a tab refresh.

### Persistence, management, and presentation

- Source deck, removed IDs, and wave metadata persist as schema version 2 under the existing `flashvocab-3-assets-v1` key; version 1 migrates to an undated W1 wave without changing IDs. Appearance and the four mastery numbers persist separately under `flashvocab-theme-v1` and `flashvocab-mastery-v1`. A fresh page resets mode progress, queues, learning preferences, and Undo, and orders the active waves by saved mastery. If the deck key is absent, source deck and removals are read from legacy `vocab2-learning-v1`; that key is unchanged.
- Replace, remove, find-back (including graduates), and reset share one labelled in-memory Undo slot. Reset keeps source deck and removed IDs, clears mastery, and restores default preferences. Import failure never changes the active deck or learning scene.
- A fresh visitor gets a three-step import wizard: (1) a source picker with "文件" and "粘贴" tabs, a single upload target, a short sample link, and no pre-import naming or AI setup; (2) a confirmation screen with the count, Chinese-meaning count, first five entries, skipped-line details, and one primary "开始背这 N 个词" action; (3) the study screen. A visible "1 放入 · 2 核对 · 3 开始" indicator tracks the path. Words missing Chinese meanings can be filled from a conditional inline panel by copying one plain-line prompt to any AI and pasting the reply back; JSON knowledge is not required. If normalized entries contain page refs, definition-like terms, or word-like meanings, the app treats the file as a matching/fill-in worksheet and replaces the misleading preview with a three-step AI rescue (copy the worksheet prompt first, then upload the original to DeepSeek and paste the piped list back). A file-level parse failure offers the same rescue. There is no slide tour, first-card guide card, or Guidebook-page replacement.
- Adding a list from learning goes through "词表" → "添加新词表", which returns to Import without replacing the deck or learning scene. The import page offers "继续学习" while a prior scene exists. Continue resumes the same mode, card, answer, and spelling input. Reload with a saved deck still starts learning directly.
- The persistent header contains brand, "词表" when words exist, a settings gear, a help button, the GitHub mark, and Undo after its five-second toast period when available. On a first visit with no words, the global action group is hidden so the import wizard shows only the brand. Each action opens one focused panel: deck, settings, or operation reference. There are no panel tabs and no "More" menu. The panel traps Tab focus while scrolling; Esc closes it and releases focus. Quiet peripheral state follows learning keys or 2.5 seconds of pointer inactivity and returns on pointer/Tab; it never hides or disables the header. Reduced motion, narrow layouts, and 200% zoom must remain usable.
- The import wizard keeps one decision per step: file/paste tabs on step 1, a single primary CTA on step 2. File parsing shows "正在识别…" while a file is read. The source picker is not a second competing card. Settings present spelling as three explicit outcome cards rather than a switch plus radio group; voice and appearance remain separate sections; "认识的词直接前进" is folded under "进阶".
- Answered quiz choices are disabled against duplicate scores; the correct option stays teal with a text label, while a selected wrong option stays coral with an explicit selected-mistake label. Both retain full opacity and readable theme contrast; unrelated choices fade.
- Undo clears superseded import/preparation panel feedback along with restoring the saved learning and library state.
- Undo has a single entry: the toast for five seconds, then the header. Empty-state recovery uses that same entry. Keyboard focus on the expiring toast transfers to the header action. Narrow headers wrap instead of hiding Undo, including below 300px.
- `docs/validation-2026-09-07/` preserves historical Chrome evidence; `docs/validation-2026-10-20/` and `docs/validation-2026-10-26/` preserve prior redesign evidence. `docs/validation-2026-10-27/` contains the import-first pass: real DOCX table and XLSX uploads, plain-pair paste preview, 390px/280px layouts, dark mode, CSS 200% zoom, and check output. The 2026-10-27 delivery passed 88 Node tests, 62 UI tests, ESLint, and the production build. `npm run check` plus the current spec's linked acceptance matrix remain the delivery gate.

## Content Format & Naming Conventions

`vocab.md` entries use a multi-line block separated by a blank line. Use a word label in brackets, Title Case; then one meaning line, optional `- Word Origin:` and `- Related Word:` lines, followed by 2-3 numbered sentence/focus pairs with `- Sentence 1:`, `- Focus 1:`, `- Sentence 2:`, `- Focus 2:` and so on. Each `Focus` must match the exact substring that should be emphasized inside its sentence. Keep the Word Origin / Related Word lines identical to the corresponding `baseDeck` fields; the Markdown importer recognizes both lines. Avoid extra indentation or nested lists, and prefer ASCII unless a word requires otherwise.

Example format:

```md
[Word]

- Meaning (EN): short, clear definition
- Word Origin: 中文词源拆解，与 baseDeck 一致
- Related Word: counterpart — 中文区别说明
- Sentence 1: A full sentence that ends with a period.
- Focus 1: Exact phrase from sentence 1 to emphasize.
- Sentence 2: Another sentence that shows the same or a related usage.
- Focus 2: Exact phrase from sentence 2 to emphasize.
```

`src/data/baseDeck.js` entries include `term`, `syllables`, `respell`, `pos`, `meaning`, `meaningZh`, `examples`, `wordOrigin`, and `relatedWord`. The built-in 24 entries fill both etymology fields; on imports they stay optional and default to empty strings. `wordOrigin` is 1-2 concise Chinese sentences explaining reliable roots, affixes, and etymology (Latin, Greek, or Old French sources; mark unverified memory aids explicitly). `relatedWord` uses the `English word — Chinese distinction` format with a B1-B2-level opposite or counterpart concept. Keep `term` in Title Case, use short part-of-speech tags with trailing periods (e.g. `adj.`), and keep `examples` as a 2-3 item array of `{ sentence, focus }` objects where `focus` appears verbatim inside `sentence`. Prefer B1-B2-friendly daily-life contexts and avoid adding several extra hard words to the same sentence.

Example `baseDeck` entry:

```js
{
  term: "Vacant",
  syllables: "Va·cant",
  respell: "[VAY-kunt]",
  pos: "adj.",
  meaning: "empty; not occupied",
  meaningZh: "空的；未被占用",
  wordOrigin: "来自拉丁 vacare，意为「空着、未被占用」。词根 vac- 表示空，同根词有 vacuum（真空）、vacation（假期）。",
  relatedWord: "occupied — 已被占用",
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
- `npm run lint`
- `npm test`
- `npm run test:unit`
- `npm run test:ui`
- `npm run build`
- `npm run preview`
- `npm run check`

## Testing Guidelines

Run `npm run check` before delivery. It runs ESLint, the Node logic tests, the Vitest/jsdom UI characterization suite, and the production build. Coverage includes stable duplicate IDs, independent study/spell scoring, exact one-round rest and return, bounded empty-round advancement, safe asset persistence, import/export, recognition/spelling/pause/remove/undo flows, natural voice selection, active-queue interruption, and Strict Mode cleanup that does not cancel speech.

For deeper behavior checks, build and serve the production app, then drive the UI in a real browser. Pronunciation checks must record `start` and `end`/`error` events and include an audible check; the `speaking` flag alone is insufficient.

## Commit & Pull Request Guidelines

This is a git repository. Use short, imperative commit messages like “Add 5 new words” and keep PRs focused; include a brief summary, the number of entries added or edited, and note any reorderings.

## Document Navigation

When a document has a numbered summary, decision table, checklist, or index whose detailed content appears elsewhere in the same document, every item number must be an internal link to a stable anchor at the corresponding detailed section. Apply this to both opening and closing summaries so readers never need to manually search backward through a long document.

## Interface development

- The user retired `ui-ux-pro-max` on 2026-10-26 because its guidance is outdated. Do not use that skill, its library, or any global/mirrored copy to guide this project's development.
- Follow the user's current requirements, the current application contract and observed browser behavior. Earlier UIUX reviews and skill-installation notes are historical records, not development instructions.
