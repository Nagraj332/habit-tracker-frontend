/** Draws the walked route as a line. No map tiles, so it works offline. */
export default function RouteMap({ points }) {
  const W = 320, H = 200, P = 18;
  if (points.length < 2) return <div className="routeempty">Your route will appear here once you start moving.</div>;

  const meanLat = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const xs = points.map((p) => p.lon * k);
  const ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((W - 2 * P) / (maxX - minX || 1e-9), (H - 2 * P) / (maxY - minY || 1e-9));
  const ox = (W - (maxX - minX) * scale) / 2;
  const oy = (H - (maxY - minY) * scale) / 2;
  const pt = (i) => [ox + (xs[i] - minX) * scale, oy + (ys[i] - minY) * scale];
  const d = points.map((_, i) => { const [x, y] = pt(i); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");
  const [sx, sy] = pt(0);
  const [ex, ey] = pt(points.length - 1);

  return (
    <svg className="routemap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Walk route">
      <path className="routeline" d={d} />
      <circle cx={sx} cy={sy} r="5" fill="var(--ink)" />
      <circle className="routepulse" cx={ex} cy={ey} r="7" />
      <circle cx={ex} cy={ey} r="5" fill="var(--brand)" />
    </svg>
  );
}
