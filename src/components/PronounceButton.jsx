export default function PronounceButton({ disabled, onPronounce, term }) {
  const handleClick = (event) => {
    event.stopPropagation();
    onPronounce();
  };

  return (
    <button
      type="button"
      className="pronounce-button"
      aria-label={`播放 ${term} 的美式发音`}
      title={`播放 ${term} 的美式发音`}
      disabled={disabled}
      onClick={handleClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M11 5 6.8 8.5H3.5v7h3.3L11 19V5Zm4.2 3.2a5 5 0 0 1 0 7.6M18 5.4a9 9 0 0 1 0 13.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
