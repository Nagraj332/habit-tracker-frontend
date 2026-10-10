import { useEffect, useRef, useState } from "react";

/** Numbers glide up to their value. Non-numbers are shown as they are. */
export default function CountUp({ value, suffix = "", duration = 700 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (typeof value !== "number") return;
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setShown(a + (value - a) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  if (typeof value !== "number") return value;
  const n = Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10;
  return <>{n}{suffix}</>;
}
