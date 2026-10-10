// Times are stored as 24-hour "HH:mm" (what the backend expects) but shown as 12-hour with AM/PM.
export const parseTime = (v) => {
  if (!v) return null;
  const [H, M] = v.split(":").map(Number);
  return { h: H % 12 || 12, m: M, pm: H >= 12 };
};

export const to24 = (h, m, pm) => `${String((h % 12) + (pm ? 12 : 0)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

export const fmt12 = (v) => {
  const p = parseTime(v);
  return p ? `${p.h}:${String(p.m).padStart(2, "0")} ${p.pm ? "PM" : "AM"}` : "";
};
