import { useEffect } from "react";

const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, [contenteditable="true"], [role="button"]';

export function useAppKeyboard({
  mode,
  revealed,
  panelOpen,
  onReveal,
  onHide,
  onAnswer,
  onPrevious,
  onRemove,
  onResume,
  onPauseToStudy,
  onPauseSpell,
  onClosePanel,
  onLearningKey,
  onShowChrome,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Tab") {
        onShowChrome();
        return;
      }
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

      if (panelOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          onClosePanel();
        }
        return;
      }

      const interactive =
        event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR);
      if (interactive) return;

      if (mode === "pause") {
        if (event.key === "Enter") {
          event.preventDefault();
          onLearningKey();
          onResume();
        } else if (event.code === "Space") {
          event.preventDefault();
          onLearningKey();
          onPauseToStudy();
        }
        return;
      }

      if (mode === "spell") {
        if (event.key === "Escape") {
          event.preventDefault();
          onLearningKey();
          onPauseSpell();
        }
        return;
      }

      if (mode !== "study") return;
      if (event.key === "Enter") {
        event.preventDefault();
        onLearningKey();
        if (revealed) onAnswer(true);
        else onReveal();
      } else if (event.code === "Space") {
        event.preventDefault();
        onLearningKey();
        if (revealed) onHide();
        else onReveal();
      } else if (event.code === "KeyN" && revealed) {
        event.preventDefault();
        onLearningKey();
        onAnswer(false);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onLearningKey();
        onPrevious();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onLearningKey();
        onRemove();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    mode,
    onAnswer,
    onClosePanel,
    onHide,
    onLearningKey,
    onPauseSpell,
    onPauseToStudy,
    onPrevious,
    onRemove,
    onResume,
    onReveal,
    onShowChrome,
    panelOpen,
    revealed,
  ]);
}
