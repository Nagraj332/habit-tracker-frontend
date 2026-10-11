import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Gives the service worker a new version id on every build. The browser sees sw.js changed,
// so installed copies of the app notice each deploy and offer "Update now".
const stampServiceWorker = () => ({
  name: "stamp-service-worker",
  apply: "build",
  closeBundle() {
    const file = path.resolve("dist/sw.js");
    if (!fs.existsSync(file)) return;
    const id = `${Date.now().toString(36)}`;
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replaceAll("__BUILD_ID__", id));
  },
});

// host: true lets a phone on the same Wi-Fi open http://<your-pc-ip>:5173
export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
