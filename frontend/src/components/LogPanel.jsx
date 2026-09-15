import { forwardRef, useImperativeHandle, useRef } from "react";

const MAX_LINES = 150;
const AUTOSCROLL_SLACK = 40;

// Lines are appended straight to the DOM instead of going through React
// state, the same way Scene.jsx drives the canvas off refs: at trade-firehose
// rates, re-rendering a keyed list on every flush is what made this laggy.
const LogPanel = forwardRef(function LogPanel({ title, accent }, ref) {
  const scrollRef = useRef(null);
  const pinnedRef = useRef(true);

  useImperativeHandle(ref, () => ({
    pushLines(lines) {
      const el = scrollRef.current;
      if (!el || lines.length === 0) return;

      const empty = el.querySelector(".log-empty");
      if (empty) empty.remove();

      const frag = document.createDocumentFragment();
      for (const text of lines) {
        const row = document.createElement("div");
        row.className = "log-line";
        row.textContent = text;
        frag.appendChild(row);
      }
      el.appendChild(frag);

      while (el.children.length > MAX_LINES) el.removeChild(el.firstChild);
      if (pinnedRef.current) el.scrollTop = el.scrollHeight;
    },
  }));

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < AUTOSCROLL_SLACK;
  }

  return (
    <div className="panel log-panel">
      <div className="panel-title" style={{ color: accent }}>
        {title}
      </div>
      <div className="log-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div className="log-line log-empty">waiting for data...</div>
      </div>
    </div>
  );
});

export default LogPanel;
