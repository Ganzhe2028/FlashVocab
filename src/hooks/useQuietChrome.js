import { useCallback, useEffect, useRef, useState } from "react";

export function useQuietChrome({ heldOpen = false }) {
  const [quiet, setQuiet] = useState(false);
  const timerRef = useRef(null);

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const showChrome = useCallback(() => {
    cancelTimer();
    setQuiet(false);
    if (!heldOpen) {
      timerRef.current = window.setTimeout(() => setQuiet(true), 2500);
    }
  }, [cancelTimer, heldOpen]);

  const hideForLearning = useCallback(() => {
    cancelTimer();
    if (!heldOpen) setQuiet(true);
  }, [cancelTimer, heldOpen]);

  useEffect(() => {
    if (heldOpen) {
      cancelTimer();
      setQuiet(false);
      return undefined;
    }
    showChrome();
    return cancelTimer;
  }, [cancelTimer, heldOpen, showChrome]);

  useEffect(() => {
    const handlePointer = () => showChrome();
    window.addEventListener("pointermove", handlePointer, { passive: true });
    window.addEventListener("pointerdown", handlePointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("pointerdown", handlePointer);
    };
  }, [showChrome]);

  return { quiet, showChrome, hideForLearning };
}
