import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { fmt, isActiveOn, nextDate, shortDate } from "../api";
import HabitCard from "../components/HabitCard";
import Icon from "../components/Icon";
import { celebrate } from "../fx";
import { greeting, istDateLabel } from "../greeting";

const R = 36;
const C = 2 * Math.PI * R;

export default function Today() {
  const { shown: habits, loading, version, toggle, openNew, search, clearSearch } = useOutletContext();
  const searching = Boolean(search.text.trim());
  const [filter, setFilter] = useState("all");
  const [slow, setSlow] = useState(false); // the server is taking a while (free hosting wakes up slowly)
  useEffect(() => {
    if (!loading) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(t);
  }, [loading]);

  const todayKey = fmt(new Date());
  const started = habits.filter((h) => isActiveOn(h, todayKey));
  const upcoming = habits
    .filter((h) => !isActiveOn(h, todayKey) && nextDate(h, todayKey))
    .sort((a, b) => nextDate(a, todayKey).localeCompare(nextDate(b, todayKey)));
  const total = started.length;
  const done = started.filter((h) => h.completedToday).length;
  const pct = total ? done / total : 0;
  const prevAll = useRef(null);
  useEffect(() => {
    if (loading) return;
    const all = total > 0 && done === total;
    if (prevAll.current === false && all) celebrate(); // confetti the moment the last habit is checked
    prevAll.current = all;
  }, [loading, done, total]);
  const hello = greeting(); // by Indian Standard Time
  const date = istDateLabel();
  const shown = started.filter((h) => filter === "all" || (filter === "done" ? h.completedToday : !h.completedToday));

  const sub = habits.length === 0 ? "Add your first habit to get started." : total === 0 ? "Nothing is scheduled for today. Check what is coming up." : done === total ? "All done for today. Nice work." : `${total - done} left to go today.`;

  return (
    <>
      <header className="hero">
        <div>
          <p className="date">{date}</p>
          <h1>{hello}</h1>
          <p className="sub">{sub}</p>
        </div>
        <div className="ring" role="img" aria-label={`${done} of ${total} habits done`}>
          <svg viewBox="0 0 88 88" width="88" height="88">
            <circle cx="44" cy="44" r={R} fill="none" stroke="var(--empty)" strokeWidth="9" />
            <circle cx="44" cy="44" r={R} fill="none" stroke="var(--brand)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 44 44)" />
          </svg>
          <b>{done}/{total}</b>
        </div>
      </header>

      {searching && (
        <div className="searchbar">
          <span>Showing {habits.length === 1 ? "1 habit" : `${habits.length} habits`} for "{search.text.trim()}"</span>
          <button className="link" onClick={clearSearch}>Clear</button>
        </div>
      )}

      {total > 0 && (
        <div className="chips" role="tablist" aria-label="Filter habits">
          {[["all", "All"], ["todo", "To do"], ["done", "Done"]].map(([k, label]) => (
            <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      )}

      {loading ? (
        <>
          <div className="list">
            <div className="skel" /><div className="skel" /><div className="skel" />
          </div>
          <div className="wakehint" role="status">
            <button className="btn primary" onClick={openNew}><Icon name="plus" size={18} /> Add habit</button>
            {slow && <p className="hint">Connecting to the server. The first open can take up to a minute.</p>}
          </div>
        </>
      ) : habits.length === 0 && searching ? (
        <div className="empty">
          <p>No habit matches "{search.text.trim()}".</p>
          <button className="btn" onClick={clearSearch}>Clear search</button>
        </div>
      ) : habits.length === 0 ? (
        <div className="empty">
          <p>Pick one small thing you want to do every day, like a 10-minute walk.</p>
          <button className="btn primary" onClick={openNew}><Icon name="plus" size={18} /> Add your first habit</button>
        </div>
      ) : total === 0 ? null : shown.length === 0 ? (
        <div className="empty"><p>{filter === "done" ? "Nothing checked off yet. Tap a circle to start." : "Everything is done. Enjoy the rest of your day."}</p></div>
      ) : (
        <div className="list">
          {shown.map((h) => <HabitCard key={h.id} habit={h} version={version} onToggle={toggle} />)}
        </div>
      )}
      {upcoming.length > 0 && (
        <section className="upnext">
          <h2>Coming up</h2>
          <div className="dayrows">
            {upcoming.map((h) => (
              <Link key={h.id} to={`/habits/${h.id}`} className="dayrow" style={{ "--c": h.color }}>
                <b>{h.name}</b>
                <span className="tag">{h.scheduledDates?.length ? "Next" : "Starts"} {shortDate(nextDate(h, todayKey))}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
