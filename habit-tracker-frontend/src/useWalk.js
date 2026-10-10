import { useCallback, useEffect, useRef, useState } from "react";

const rad = (d) => (d * Math.PI) / 180;

/** Distance in metres between two { lat, lon } points. */
export const haversine = (a, b) => {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
};

/** GPS walk tracker. Lives in the layout so a walk keeps going while you browse other pages. */
export function useWalk() {
  const [status, setStatus] = useState("idle"); // idle | tracking | paused
  const [distance, setDistance] = useState(0); // metres
  const [elapsed, setElapsed] = useState(0); // seconds
  const [points, setPoints] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState("");

  const watchId = useRef(null);
  const last = useRef(null);
  const dist = useRef(0);
  const acc = useRef(0); // ms tracked before the current stretch
  const seg = useRef(0); // when the current stretch began
  const lock = useRef(null);
  const statusRef = useRef("idle");

  const set = (s) => { statusRef.current = s; setStatus(s); };
  const stopWatch = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  };
  const takeWake = async () => { try { lock.current = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ } };
  const releaseWake = () => { try { lock.current?.release(); } catch { /* ignore */ } lock.current = null; };

  const onPos = useCallback((pos) => {
    const c = pos.coords;
    setAccuracy(c.accuracy);
    if (c.accuracy > 35) return; // ignore very rough fixes
    const p = { lat: c.latitude, lon: c.longitude, t: pos.timestamp };
    const prev = last.current;
    if (prev) {
      const d = haversine(prev, p);
      const dt = (p.t - prev.t) / 1000;
      if (d < 3) return; // GPS jitter while standing still
      if (dt > 0 && d / dt > 12) return; // impossible speed for a walker
      dist.current += d;
      setDistance(dist.current);
    }
    last.current = p;
    setPoints((ps) => [...ps, p]);
  }, []);

  const onErr = useCallback((e) => {
    setError(
      e.code === 1 ? "Location permission was denied. Allow location for this site in your browser settings, then try again."
      : e.code === 2 ? "Your position isn't available. Check that location services are turned on."
      : "Getting your location timed out. Try again outdoors, away from tall buildings."
    );
    if (e.code === 1) pause();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = () => {
    seg.current = Date.now();
    watchId.current = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    takeWake();
    set("tracking");
  };

  const reset = () => {
    stopWatch();
    releaseWake();
    dist.current = 0;
    acc.current = 0;
    last.current = null;
    setDistance(0);
    setElapsed(0);
    setPoints([]);
    setAccuracy(null);
    set("idle");
  };

  const start = () => {
    setError("");
    if (!("geolocation" in navigator)) return setError("This browser doesn't support location tracking.");
    if (!window.isSecureContext) return setError("Phones only allow GPS on secure (HTTPS) pages. Open the app over HTTPS, or use Add a walk manually below.");
    reset();
    begin();
  };

  const pause = () => {
    stopWatch();
    if (statusRef.current === "tracking") acc.current += Date.now() - seg.current;
    releaseWake();
    set("paused");
  };

  const resume = () => {
    setError("");
    last.current = null; // don't count the gap while paused as distance
    begin();
  };

  const finish = () => {
    if (statusRef.current === "tracking") acc.current += Date.now() - seg.current;
    const result = { distanceMeters: dist.current, durationSeconds: Math.max(1, Math.round(acc.current / 1000)) };
    reset();
    return result;
  };

  useEffect(() => {
    if (status !== "tracking") return;
    const iv = setInterval(() => setElapsed(Math.floor((acc.current + Date.now() - seg.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [status]);

  useEffect(() => {
    if (status === "paused") setElapsed(Math.floor(acc.current / 1000));
  }, [status]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible" && statusRef.current === "tracking") takeWake(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); stopWatch(); releaseWake(); };
  }, []);

  return { status, distance, elapsed, points, accuracy, error, setError, start, pause, resume, finish };
}
