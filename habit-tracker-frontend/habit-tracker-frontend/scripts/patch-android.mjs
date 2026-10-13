// Run by the GitHub workflow after "cap add android": lets the app show notifications on Android 13+,
// vibrate with them, plan its reminders again after the phone restarts, and deliver them exactly on time
// even while the phone sleeps (Doze mode).
//
// USE_EXACT_ALARM is granted automatically on Android 13+ and the user can't switch it off, so reminders
// stay on time without any setting to flip. (Android names it "alarm", but nothing rings: the app only shows
// a notification.) Google Play restricts this permission to alarm/calendar apps. This APK is installed
// directly from GitHub, so that does not apply; if you ever publish on Google Play, remove this line.
import fs from "node:fs";

const file = "android/app/src/main/AndroidManifest.xml";
let xml = fs.readFileSync(file, "utf8");

const permissions = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM", // Android 12 and 12L: allowed by default, user can switch off
  "android.permission.USE_EXACT_ALARM", // Android 13+: granted automatically
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.VIBRATE",
];

for (const p of permissions) {
  if (!xml.includes(`"${p}"`)) {
    xml = xml.replace("<application", `<uses-permission android:name="${p}" />\n    <application`);
  }
}

fs.writeFileSync(file, xml);
console.log("AndroidManifest.xml updated with", permissions.length, "permissions");
