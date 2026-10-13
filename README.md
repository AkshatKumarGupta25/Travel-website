# Elsewhere Travel

A responsive travel discovery site built with React and Vite. It includes destination search, global place suggestions, Google sign-in, and a Firebase-backed admin workspace for trips, bookings, travelers, messages, and site content.

## 🔗 Live Preview

👉 [View Website](https://travel-website-fawn-psi.vercel.app/)

## Local development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173/`). Do not use VS Code Live Server (port `5500`) to open this app: it does not transform the React/Vite modules, so the page can appear blank.

Fill the Firebase Web app values into `.env.local` before using Google sign-in. The file is ignored by Git.

If Firebase is not configured yet, the app falls back to a browser-local database that persists trips, bookings, traveler requests, and content in `localStorage` so the site still works for local development and demos.

## Firebase setup

Follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md) to enable Google Authentication, create Firestore, deploy security rules and Cloud Functions, and grant the first administrator role.

## Checks

```powershell
npm run lint
npm run build
```
