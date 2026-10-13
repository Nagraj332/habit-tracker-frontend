// Decorative layers: drifting color blobs, a slow rotating aurora and rising bubbles.
const BUBBLES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37 + 8) % 100,
  size: 6 + ((i * 7) % 5) * 5,
  dur: 16 + ((i * 5) % 9) * 2,
  delay: -((i * 3) % 14) * 2,
  x: ((i % 2 ? 1 : -1) * (20 + ((i * 11) % 50))),
}));

export default function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <span className="aurora" />
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      <span className="blob b4" />
      {BUBBLES.map((b, i) => (
        <span key={i} className="bubble" style={{ "--l": `${b.left}%`, "--s": `${b.size}px`, "--d": `${b.dur}s`, "--dl": `${b.delay}s`, "--x": `${b.x}px` }} />
      ))}
    </div>
  );
}
