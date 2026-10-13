import { useEffect, useState } from "react";
import Icon from "./Icon";

/** Appears when a new version of the app has been deployed and is ready to switch to. */
export default function UpdateBanner() {
  const [ready, setReady] = useState(Boolean(window.__swWaiting));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const on = () => setReady(true);
    window.addEventListener("sw-update", on);
    return () => window.removeEventListener("sw-update", on);
  }, []);

  if (!ready) return null;

  const update = () => {
    setBusy(true);
    const w = window.__swWaiting;
    if (w) w.postMessage({ type: "SKIP_WAITING" }); // the page reloads by itself once the new version takes over
    else window.location.reload();
    setTimeout(() => window.location.reload(), 4000); // safety net
  };

  return (
    <div className="updatebar" role="status">
      <span className="updateicon"><Icon name="download" size={18} /></span>
      <div>
        <b>New version available</b>
        <span>Update to get the latest features and fixes.</span>
      </div>
      <button className="btn primary small" onClick={update} disabled={busy}>{busy ? "Updating..." : "Update now"}</button>
      <button className="iconbtn plain" onClick={() => setReady(false)} aria-label="Later"><Icon name="x" size={16} /></button>
    </div>
  );
}
