import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// host: true lets a phone on the same Wi-Fi open http://<your-pc-ip>:5173
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
