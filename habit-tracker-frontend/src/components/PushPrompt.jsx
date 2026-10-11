import { useEffect, useState } from "react";
import Icon from "./Icon";
import { enablePush, getPushStatus } from "../push";

const KEY = "push-prompt-hidden";
const HIDE_MS = 2 * 24 * 3600 * 1000;

const hiddenRecently = () => {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) || 0) < HIDE_MS;
  } catch {
    return false;
  }
};

/** Home-page banner that asks for permission to ring the alarm even when the app is closed. */
export default function PushPrompt({ enabled, say }) {
  const [status, setStatus] = useState("checking");
  const [hidden, setHidden] = useState(hiddenRecently);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    getPushStatus().then(setStatus).catch(() => setStatus("unsupported"));
  }, [enabled]);

  if (!enabled || hidden || status !== "off") return null;

  const turnOn = async () => {
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    setStatus(await getPushStatus());
    if (r.ok) say("Alarm alerts are on");
    else if (r.reason === "denied") say("Alerts are blocked. Allow notifications in your browser settings.");
    else say(r.message || "Couldn't turn on alarm alerts");
  };
  const later = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
    setHidden(true);
  };

  return (
    <div className="pushprompt" role="region" aria-label="Alarm alerts">
      <span className="updateicon"><Icon name="bell" size={18} /></span>
      <div>
        <b>Ring my alarm even when the app is closed</b>
        <span>Turn on alarm alerts so reminders reach you on time.</span>
      </div>
      <button className="btn primary small" onClick={turnOn} disabled={busy}>{busy ? "Turning on..." : "Turn on"}</button>
      <button className="iconbtn plain" onClick={later} aria-label="Not now"><Icon name="x" size={16} /></button>
    </div>
  );
}
