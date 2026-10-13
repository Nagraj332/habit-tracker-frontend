const PATHS = {
  today: "M9 12l2 2 4-4M12 21a9 9 0 100-18 9 9 0 000 18z",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  plus: "M12 5v14M5 12h14",
  flame: "M12 3c1 3 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z",
  back: "M15 18l-6-6 6-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  edit: "M4 20h4L19 9l-4-4L4 16v4z",
  sun: "M12 3v2M12 19v2M5 5l1.4 1.4M17.6 17.6L19 19M3 12h2M19 12h2M5 19l1.4-1.4M17.6 6.4L19 5M12 16a4 4 0 100-8 4 4 0 000 8z",
  moon: "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z",
  menu: "M4 6h16M4 12h16M4 18h16",
  x: "M6 6l12 12M18 6L6 18",
  bell: "M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0",
  play: "M7 4l13 8-13 8z",
  stop: "M6 6h12v12H6z",
  music: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z",
  calendar: "M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  next: "M9 6l6 6-6 6",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  walk: "M14 4.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM12 8l-2 5 3 2v5M10 13l-3 1M13 15l3 5M12 8l3 2 3-1",
  pause: "M8 5v14M16 5v14",
  flag: "M5 21V4M5 4h12l-2 4 2 4H5",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
