// Greeting and date follow Indian Standard Time (IST), whatever time zone the device is set to.
const IST = "Asia/Kolkata";

export const istHour = (now = new Date()) =>
  Number(new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", hourCycle: "h23" }).format(now));

/**
 * 5:00 AM - 11:59 AM  Good morning
 * 12:00 PM - 4:59 PM  Good afternoon
 * 5:00 PM - 8:59 PM   Good evening
 * 9:00 PM - 4:59 AM   Good night
 */
export function greeting(now = new Date()) {
  const h = istHour(now);
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}

export const istDateLabel = (now = new Date()) =>
  now.toLocaleDateString("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long" });
