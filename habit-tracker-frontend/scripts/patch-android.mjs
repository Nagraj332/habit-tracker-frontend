// Run by the GitHub workflow after "cap add android": lets the app set exact alarms, show notifications
// on Android 13+, vibrate, and re-plan its alarms after the phone restarts.
import fs from "node:fs";

const file = "android/app/src/main/AndroidManifest.xml";
let xml = fs.readFileSync(file, "utf8");

const permissions = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.USE_EXACT_ALARM",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.VIBRATE",
  "android.permission.WAKE_LOCK",
];

for (const p of permissions) {
  if (!xml.includes(`"${p}"`)) {
    xml = xml.replace("<application", `<uses-permission android:name="${p}" />\n    <application`);
  }
}

fs.writeFileSync(file, xml);
console.log("AndroidManifest.xml updated with", permissions.length, "permissions");
