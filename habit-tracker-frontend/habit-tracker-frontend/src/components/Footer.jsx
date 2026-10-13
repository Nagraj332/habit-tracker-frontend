import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <span>Habit Tracker, built with React and Spring Boot</span>
        <nav aria-label="Footer">
          <Link to="/">Today</Link>
          <Link to="/habits">Habits</Link>
          <Link to="/insights">Insights</Link>
        </nav>
      </div>
    </footer>
  );
}
