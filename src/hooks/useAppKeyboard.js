import { useEffect } from "react";

const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, [contenteditable="true"], [role="button"]';

export function useAppKeyboard({
  familiarModeEnabled,
  guideOpen,
  guidePanelRef,
  mode,
  revealed,
  spellResult,
  onEnterStudyMode,
  onEnterSpellMode,
  onToggleReveal,
  onPreviousCard,
  onCompleteStudyAnswer,
  onRemoveCard,
  onAdvanceSpell,
  onSubmitSpell,
  onReplaySpellShake,
  onDeleteSpellCharacter,
  onTypeSpellCharacter,
}) {
  useEffect(() => {
    const handleKeydown = (event) => {
      if (guideOpen) return;
      if (guidePanelRef.current?.contains(document.activeElement)) return;
      if (
        event.target instanceof Element &&
        event.target.closest(INTERACTIVE_SELECTOR)
      ) {
        return;
      }

      if (mode === "rest") {
        if (event.code === "Enter") {
          event.preventDefault();
          onEnterStudyMode();
        } else if (event.code === "Space") {
          event.preventDefault();
          onEnterSpellMode();
        }
        return;
      }

      if (mode === "spell") {
        if (event.code === "Escape") {
          event.preventDefault();
          onEnterStudyMode();
          return;
        }

        if (event.code === "Enter") {
          event.preventDefault();
          if (spellResult === "correct") {
            onAdvanceSpell();
          } else if (spellResult === "wrong") {
            onReplaySpellShake();
          } else {
            onSubmitSpell();
          }
          return;
        }

        if (event.code === "Backspace") {
          event.preventDefault();
          if (spellResult !== "correct") {
            onDeleteSpellCharacter();
          }
          return;
        }

        if (event.key.length === 1 && /[a-zA-Z' -]/.test(event.key)) {
          event.preventDefault();
          if (spellResult !== "correct") {
            onTypeSpellCharacter(event.key, {
              replace: spellResult === "wrong",
            });
          }
        }
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        onToggleReveal();
      } else if (event.code === "Tab" || event.code === "ArrowLeft") {
        event.preventDefault();
        onPreviousCard();
      } else if (event.code === "Enter") {
        event.preventDefault();
        if (revealed) {
          onCompleteStudyAnswer(true);
        } else {
          onToggleReveal();
        }
      } else if (
        event.code === "KeyN" &&
        revealed &&
        familiarModeEnabled
      ) {
        event.preventDefault();
        onCompleteStudyAnswer(false);
      } else if (
        event.code === "Delete" ||
        event.code === "Backspace"
      ) {
        event.preventDefault();
        onRemoveCard();
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [
    familiarModeEnabled,
    guideOpen,
    guidePanelRef,
    mode,
    onAdvanceSpell,
    onCompleteStudyAnswer,
    onDeleteSpellCharacter,
    onEnterSpellMode,
    onEnterStudyMode,
    onPreviousCard,
    onRemoveCard,
    onReplaySpellShake,
    onSubmitSpell,
    onToggleReveal,
    onTypeSpellCharacter,
    revealed,
    spellResult,
  ]);
}
