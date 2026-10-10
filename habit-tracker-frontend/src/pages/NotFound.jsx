import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="empty">
      <h1>Page not found</h1>
      <p>The page you are looking for doesn't exist or has moved.</p>
      <Link className="btn primary" to="/">Back to Today</Link>
    </div>
  );
}
