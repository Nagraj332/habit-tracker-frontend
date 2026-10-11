import { useEffect, useState, useSyncExternalStore } from "react";
import Icon from "./Icon";
import { getInstallEvent, inAppBrowser, isIOS, isStandalone, runInstall, subscribeInstall } from "../install";

const KEY = "install-dismissed";
const DAYS = 3 * 24 * 3600 * 1000;

const recentlyDismissed = () => {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) || 0) < DAYS;
  } catch {
    return false;
  }
};

/** Bottom sheet that offers to install the app the first time someone opens the link. */
export default function InstallSheet() {
  const evt = useSyncExternalStore(subscribeInstall, getInstallEvent);
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(() => {
    try { return localStorage.getItem("install-done") === "1"; } catch { return false; }
  });

  const ios = isIOS();
  const inApp = inAppBrowser();
  // can we show something useful here? Android/desktop Chrome: the install button. iPhone: the steps. WhatsApp etc.: "open in browser".
  const canOffer = !done && !isStandalone() && (Boolean(evt) || ios || inApp);

  useEffect(() => {
    if (!canOffer || recentlyDismissed()) return;
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, [canOffer]);

  if (!show || !canOffer) return null;

  const close = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
  };
  const install = async () => {
    const ok = await runInstall();
    if (ok) setDone(true);
    setShow(false);
  };

  return (
    <div className="sheetwrap" role="dialog" aria-label="Install Habit Tracker">
      <div className="sheet">
        <div className="sheethead">
          <img src="/icons/icon-192.png" alt="" width="52" height="52" />
          <div>
            <h2>Install Habit Tracker</h2>
            <p className="hint">One tap from your home screen, and updates that arrive on their own.</p>
          </div>
        </div>

        {inApp ? (
          <p className="sheetsteps">You opened this link inside another app, which can't install it. Tap the <b>⋮</b> or <b>Share</b> button and choose <b>Open in Chrome</b> (or <b>Open in Safari</b> on iPhone). Then install from there.</p>
        ) : evt ? (
          <button className="btn primary big" onClick={install}><Icon name="download" size={18} /> Install app</button>
        ) : (
          <p className="sheetsteps">On iPhone: tap the <b>Share</b> button at the bottom of Safari, scroll down and choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</p>
        )}
        <button className="btn ghost" onClick={close}>Not now</button>
      </div>
    </div>
  );
}
