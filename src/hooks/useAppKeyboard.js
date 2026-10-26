import { useEffect } from "react";

const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, [contenteditable="true"], [role="button"]';

export function useAppKeyboard({
  mode,
  revealed,
  studyResult,
  panelOpen,
  onChooseStudy,
  onAdvanceStudy,
  onPrevious,
  onRemove,
  onResume,
  onPauseToStudy,
  onPauseSpell,
  onClosePanel,
  onLearningKey,
  onShowChrome,
  onContinueRound,
  quiz,
  onAnswerQuiz,
  onNextQuiz,
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

      if (mode === "quiz") {
        if (quiz.finished) return;
        const choice = Number(event.key) - 1;
        if (quiz.selected === null && /^[1-9]$/.test(event.key) && quiz.question.options[choice]) {
          event.preventDefault();
          onAnswerQuiz(quiz.question.options[choice]);
        } else if (quiz.selected !== null && event.code === "KeyN") {
          event.preventDefault();
          onNextQuiz();
        }
        return;
      }

      if (mode === "summary" && event.key === "Enter") {
        event.preventDefault();
        onContinueRound();
        return;
      }

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
      if (!revealed && event.code === "KeyQ") {
        event.preventDefault();
        onLearningKey();
        onChooseStudy(true);
      } else if (!revealed && event.code === "KeyE") {
        event.preventDefault();
        onLearningKey();
        onChooseStudy(false);
      } else if (revealed && event.code === "KeyN") {
        event.preventDefault();
        onLearningKey();
        onAdvanceStudy();
      } else if (revealed && event.code === "KeyM" && studyResult === true) {
        event.preventDefault();
        onLearningKey();
        onAdvanceStudy(false);
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
    onAdvanceStudy,
    onChooseStudy,
    onClosePanel,
    onLearningKey,
    onPauseSpell,
    onPauseToStudy,
    onPrevious,
    onRemove,
    onResume,
    onShowChrome,
    onContinueRound,
    quiz,
    onAnswerQuiz,
    onNextQuiz,
    panelOpen,
    revealed,
    studyResult,
  ]);
}
