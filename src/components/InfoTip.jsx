import { useId } from "react";

export default function InfoTip({ children, label = "说明" }) {
  const id = useId();
  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip-button"
        aria-label={label}
        aria-describedby={id}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      </button>
      <span className="info-tip-bubble" id={id} role="tooltip">{children}</span>
    </span>
  );
}
