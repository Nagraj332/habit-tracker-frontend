// Small confetti bursts made of DOM bits (CSS does the animation, see .confetti in index.css).
const COLORS = ["#0f9d8a", "#f08c00", "#e91e63", "#2196f3", "#9c27b0", "#4caf50"];

export function confetti(x, y, count = 28) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const power = 60 + Math.random() * 140;
    s.className = "confetti";
    s.style.cssText = `left:${x}px;top:${y}px;background:${COLORS[i % COLORS.length]};--dx:${Math.cos(angle) * power}px;--dy:${Math.sin(angle) * power - 80}px;--r:${Math.random() * 720 - 360}deg`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
}

export function confettiFrom(el) {
  const r = el.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2);
}

export function celebrate() {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => confetti(window.innerWidth * (0.15 + Math.random() * 0.7), window.innerHeight * 0.3, 24), i * 180);
  }
}
