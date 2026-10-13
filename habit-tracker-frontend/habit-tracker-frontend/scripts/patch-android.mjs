// Run by the GitHub workflow after "cap add android": lets the app show notifications on Android 13+,
// deliver them exactly on time (without it Android may delay them by minutes), vibrate with them,
// and plan its reminders again after the phone restarts.
import fs from "node:fs";

const file = "android/app/src/main/AndroidManifest.xml";
let xml = fs.readFileSync(file, "utf8");

const permissions = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM",
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
