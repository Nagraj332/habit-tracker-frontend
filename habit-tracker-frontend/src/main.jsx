import "./install"; // first: it has to hear the browser's "can install" signal as early as possible
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// PWA: the service worker only runs in the production build (npm run build, then npm run preview)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");

      // a new version was deployed: tell the app, which shows "Update now"
      const announce = (worker) => {
        window.__swWaiting = worker;
        window.dispatchEvent(new Event("sw-update"));
      };
      if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) announce(worker);
        });
      });

      // look for a new version when the app comes back to the screen, and every 15 minutes
      const check = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
      setInterval(check, 15 * 60 * 1000);

      // after "Update now" the new worker takes over: reload once to run the new code
      let hadController = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController) { hadController = true; return; } // first install, nothing to reload
        window.location.reload();
      });
    } catch { /* ignore */ }
  });
}
