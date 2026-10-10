import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Icon from "./Icon";
import SearchBox from "./SearchBox";

const LINKS = [
  ["/", "Today", "today"],
  ["/calendar", "Calendar", "calendar"],
  ["/habits", "Habits", "list"],
  ["/walk", "Walk / Run", "walk"],
  ["/insights", "Insights", "chart"],
  ["/reminders", "Reminders", "bell"],
];

export default function Navbar({ habits, search, onText, onPick, onSearchAll, onClear, onNew, theme, onTheme, onInstall }) {
  const [open, setOpen] = useState(false);
  const searchRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const brand = (
    <Link to="/" className="brand">
      <span className="logo"><Icon name="check" size={18} /></span>
      Habit Tracker
    </Link>
  );

  const sb = { habits, text: search.text, onText, onPick, onSearchAll, onClear };
  const iosTip = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;
  const linkClass = ({ isActive }) => `nav ${isActive ? "active" : ""}`;

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          {brand}
          <nav className="links" aria-label="Main">
            {LINKS.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"} className={linkClass}>{label}</NavLink>
            ))}
          </nav>
          <span className="grow" />
          <SearchBox {...sb} variant="desk" inputRef={searchRef} />
          {onInstall && <button className="iconbtn" onClick={onInstall} aria-label="Install app" title="Install app"><Icon name="download" size={18} /></button>}
          <button className="iconbtn" onClick={onTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Toggle theme">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
          </button>
          <button className="btn primary newbtn" onClick={onNew} aria-label="New habit" title="New habit"><Icon name="plus" size={18} /> <span className="newlbl">New habit</span></button>
          <button className="iconbtn burger" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
            <Icon name="menu" size={20} />
          </button>
        </div>
      </header>

      <div className={`drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="scrim" onClick={() => setOpen(false)} />
        <div className="panelnav" role="dialog" aria-label="Menu">
          <div className="dtop">
            {brand}
            <button className="iconbtn" onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="x" size={18} /></button>
          </div>
          <SearchBox {...sb} variant="full" onDone={() => setOpen(false)} />
          <nav className="dlinks" aria-label="Mobile">
            {LINKS.map(([to, label, icon]) => (
              <NavLink key={to} to={to} end={to === "/"} className={linkClass}><Icon name={icon} size={20} /> {label}</NavLink>
            ))}
          </nav>
          <button className="btn primary" onClick={() => { setOpen(false); onNew(); }}><Icon name="plus" size={18} /> New habit</button>
          {onInstall && <button className="btn" onClick={onInstall}><Icon name="download" size={18} /> Install app</button>}
          {iosTip && <p className="hint" style={{ margin: 0 }}>To install on iPhone: tap Share, then Add to Home Screen.</p>}
          <button className="btn" onClick={onTheme}><Icon name={theme === "dark" ? "sun" : "moon"} size={18} /> {theme === "dark" ? "Light theme" : "Dark theme"}</button>
        </div>
      </div>
    </>
  );
}
