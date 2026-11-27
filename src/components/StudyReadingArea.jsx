import { useLayoutEffect, useRef, useState } from "react";

export default function StudyReadingArea({ cardId, step, className, children }) {
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const [moreBelow, setMoreBelow] = useState(false);

  useLayoutEffect(() => {
    scrollRef.current.scrollTop = 0;
  }, [cardId, step]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const measure = () => setMoreBelow(scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop > 1);
    measure();
    const observer = typeof ResizeObserver !== "undefined" && new ResizeObserver(measure);
    if (observer) {
      observer.observe(scroll);
      observer.observe(contentRef.current);
    }
    scroll.addEventListener("scroll", measure, { passive: true });
    return () => {
      if (observer) observer.disconnect();
      scroll.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <main className={`study-window${moreBelow ? " has-more" : ""}`}>
      <div className="study-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="单词内容">
        <div className={className} ref={contentRef}>{children}</div>
      </div>
    </main>
  );
}
