# Elsewhere Travel

A responsive travel discovery site built with React and Vite. It includes destination search, global place suggestions, Google sign-in, and a Firebase-backed admin workspace for trips, bookings, travelers, messages, and site content.

## Local development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Fill the Firebase Web app values into `.env.local` before using Google sign-in. The file is ignored by Git.

## Firebase setup

Follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md) to enable Google Authentication, create Firestore, deploy security rules and Cloud Functions, and grant the first administrator role.

## Checks

```powershell
npm run lint
npm run build
```