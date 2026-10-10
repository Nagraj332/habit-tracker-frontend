# Habit Tracker - React frontend (PWA)

    npm install
    npm run dev          # http://localhost:5173 (also reachable from a phone on the same Wi-Fi)

## Try it as an installable app (PWA)
The service worker only runs in the production build:

    npm run build
    npm run preview      # http://localhost:4173

Open it in Chrome or Edge and use the Install icon in the address bar.

## On your phone
1. Start the Spring Boot backend and this app on your PC, and connect the phone to the same Wi-Fi.
2. Find your PC's IP address (Windows: `ipconfig`, look for IPv4, for example 192.168.1.20).
3. Allow Java / Node through the Windows firewall when asked.
4. On the phone open `http://192.168.1.20:5173`. The app finds the backend on the same IP, port 8080.

Phones only offer a real "Install app" (with offline support and notifications) on HTTPS pages.
For that, deploy the frontend and backend to HTTPS hosting, set `VITE_API_URL=https://your-backend/api`
in a `.env` file before `npm run build`, or test with a tunnel such as ngrok.

## Walking (GPS)
Browsers only allow GPS on secure pages: `http://localhost` works, `https://` works, but `http://192.168.x.x`
on a phone does not. To track walks on a phone, host the app over HTTPS (or use a tunnel such as ngrok).
Until then, use "Add a walk manually" on the Walk page. Keep the screen on while walking.
