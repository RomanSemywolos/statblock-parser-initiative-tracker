import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  function show() {
    const rect = anchor.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 8, left: Math.max(8, Math.min(rect.left, window.innerWidth - 308)) });
  }
  useEffect(() => {
    if (!position) return;
    const hide = () => setPosition(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("keydown", key);
    };
  }, [position]);
  return (
    <span
      ref={anchor}
      className="tooltip-anchor"
      aria-describedby={position ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={() => setPosition(null)}
      onFocus={show}
      onBlur={() => setPosition(null)}
    >
      {children}
      {position &&
        createPortal(
          <span id={id} role="tooltip" className="app-tooltip" style={position}>
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
