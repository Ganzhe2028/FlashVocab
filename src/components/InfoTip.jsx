import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function InfoTip({ label, children }) {
  const id = useId();
  const buttonRef = useRef(null);
  const bubbleRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);

  const place = useCallback(() => {
    const button = buttonRef.current;
    const bubble = bubbleRef.current;
    if (!button || !bubble) return;
    const rect = button.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 8);
    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return (
    <span
      className={`info-tip${open ? " is-open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="info-tip-button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={id}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" />
          <path d="M8 7.2v4M8 4.9h.01" />
        </svg>
      </button>
      {createPortal(
        <span
          id={id}
          ref={bubbleRef}
          role="tooltip"
          className={`info-tip-bubble${open ? " is-open" : ""}`}
          style={position ?? undefined}
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
