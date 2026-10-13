import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";

/**
 * Search field. Typing filters the page live (the text lives in the layout) and suggests the
 * habits you already have. Picking a suggestion narrows the whole app to that one habit.
 */
export default function SearchBox({ habits, text, onText, onPick, onSearchAll, onClear, variant, inputRef, onDone }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  const term = text.trim();

  const matches = useMemo(() => {
    const t = term.toLowerCase();
    if (!t) return [];
    const rank = (h) => {
      const n = h.name.toLowerCase();
      return n.startsWith(t) ? 0 : n.includes(t) ? 1 : (h.description || "").toLowerCase().includes(t) ? 2 : 3;
    };
    return habits
      .map((h) => [h, rank(h)])
      .filter(([, r]) => r < 3)
      .sort((a, b) => a[1] - b[1] || a[0].name.localeCompare(b[0].name))
      .slice(0, 6)
      .map(([h]) => h);
  }, [term, habits]);

  useEffect(() => {
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  const pick = (h) => { setOpen(false); setActive(-1); onPick(h); onDone?.(); };
  const searchAll = () => { setOpen(false); inputRef?.current?.blur(); onSearchAll(); onDone?.(); };
  const clear = () => { onClear(); setOpen(false); setActive(-1); inputRef?.current?.focus(); };

  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && matches[active]) pick(matches[active]);
    else searchAll();
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(matches.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === "Escape") setOpen(false);
  };

  const highlight = (name) => {
    const i = name.toLowerCase().indexOf(term.toLowerCase());
    if (i < 0) return name;
    return <>{name.slice(0, i)}<mark>{name.slice(i, i + term.length)}</mark>{name.slice(i + term.length)}</>;
  };

  return (
    <form ref={box} className={`tsearch ${variant}`} onSubmit={submit} role="search">
      <Icon name="search" size={16} />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => { onText(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Search habits"
        aria-label="Search habits"
        role="combobox"
        aria-expanded={open && term !== ""}
        aria-controls={`suggest-${variant}`}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {text ? (
        <button type="button" className="sclear" onClick={clear} aria-label="Clear search">×</button>
      ) : (
        variant === "desk" && <kbd>/</kbd>
      )}

      {open && term && (
        <ul className="suggest" id={`suggest-${variant}`} role="listbox">
          {matches.length === 0 ? (
            <li className="none">No habit matches "{term}".</li>
          ) : (
            matches.map((h, i) => (
              <li
                key={h.id}
                role="option"
                aria-selected={i === active}
                className={i === active ? "on" : ""}
                style={{ "--c": h.color }}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(h); }}
              >
                <i className="sdot" />
                <span className="sname">{highlight(h.name)}</span>
                <span className="smeta">{h.currentStreak > 0 ? `${h.currentStreak} day streak` : h.completedToday ? "Done today" : ""}</span>
              </li>
            ))
          )}
          <li className="all" onMouseDown={(e) => { e.preventDefault(); searchAll(); }}>Show all matches for "{term}"</li>
        </ul>
      )}
    </form>
  );
}
