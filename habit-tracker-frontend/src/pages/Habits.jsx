import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import Icon from "../components/Icon";
import { fmt12 } from "../time";

export default function Habits() {
  const { habits: all, shown, search, setSearchText, clearSearch, loading, openNew, openEdit, remove } = useOutletContext();
  const [sort, setSort] = useState("new");
  const q = search.text;
  const searching = Boolean(q.trim());

  const list = useMemo(() => {
    const l = [...shown];
    if (sort === "name") l.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "streak") l.sort((a, b) => b.currentStreak - a.currentStreak);
    return l;
  }, [shown, sort]);

  return (
    <>
      <header className="top">
        <div>
          <h1>Habits</h1>
          <p className="sub">{searching ? `Showing ${list.length} of ${all.length} habits` : `${all.length} ${all.length === 1 ? "habit" : "habits"} in total`}</p>
        </div>
        <button className="btn primary" onClick={openNew}><Icon name="plus" size={18} /> New habit</button>
      </header>

      <div className="tools">
        <label className="search">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setSearchText(e.target.value)} placeholder="Search habits" aria-label="Search habits" />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort habits">
          <option value="new">Newest first</option>
          <option value="name">Name A to Z</option>
          <option value="streak">Longest streak</option>
        </select>
      </div>

      {loading ? (
        <div className="grid"><div className="skel" /><div className="skel" /></div>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>{all.length === 0 ? "No habits yet." : `No habits match "${q.trim()}".`}</p>
          {searching && <button className="btn" onClick={clearSearch}>Clear search</button>}
        </div>
      ) : (
        <div className="grid">
          {list.map((h) => (
            <article key={h.id} className="hcard" style={{ "--c": h.color }}>
              <Link to={`/habits/${h.id}`} className="hname">{h.name}</Link>
              <p className="hdesc">{h.description || "No description"}</p>
              {h.reminderTime && <span className="rem"><Icon name="bell" size={13} /> Reminder at {fmt12(h.reminderTime)}</span>}
              {h.scheduledDates?.length > 0 && <span className="rem"><Icon name="calendar" size={13} /> {h.scheduledDates.length} chosen {h.scheduledDates.length === 1 ? "date" : "dates"}</span>}
              <div className="hmeta">
                <span className={`streak ${h.currentStreak > 0 ? "hot" : ""}`}><Icon name="flame" size={18} /><strong>{h.currentStreak}</strong> day streak</span>
                <span className={`pill ${h.completedToday ? "on" : ""}`}>{h.completedToday ? "Done today" : "Not yet"}</span>
              </div>
              <div className="hactions">
                <Link className="btn small" to={`/habits/${h.id}`}>Open</Link>
                <button className="btn small" onClick={() => openEdit(h)}><Icon name="edit" size={15} /> Edit</button>
                <button className="btn small danger" onClick={() => remove(h)} aria-label={`Delete ${h.name}`}><Icon name="trash" size={15} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
