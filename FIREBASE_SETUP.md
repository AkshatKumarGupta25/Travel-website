# Firebase setup

The app uses Firebase Authentication for Google sign-in, Cloud Firestore for managed travel data, and callable Cloud Functions for privileged traveler-account operations. Admin access is granted with a Firebase custom claim; it is never decided by a value stored in the browser.

## 1. Create the Firebase project

1. Create a Firebase project and register a Web app in the Firebase console.
2. In Authentication, enable Google as a sign-in provider and add `localhost` plus your production domain to Authorized domains.
3. Create a Cloud Firestore database.
4. Copy `.env.example` to `.env.local` and fill in the Web app values from Project settings. Restart the Vite dev server after changing environment variables.

## 2. Deploy rules and functions

Install the Firebase CLI if needed, authenticate, and select the project:

```powershell
npm install --global firebase-tools
firebase login
firebase use --add
npm --prefix functions install
firebase deploy --only firestore:rules,functions
```

Deploying Cloud Functions may require a billing-enabled Firebase plan. Do not commit `.env.local`, service-account credentials, or other private credentials.

## 3. Grant the first administrator

The Google account must sign in once at `/admin/login` so Firebase Authentication knows the account. It will not enter the dashboard until its admin role is granted.

Use Google Application Default Credentials with an account that has Firebase Admin privileges, then run the bootstrap script in PowerShell:

```powershell
gcloud auth application-default login
$env:FIREBASE_PROJECT_ID = "your-firebase-project-id"
node functions/scripts/set-admin.cjs admin@example.com
```

The script sets the `admin` and `role` custom claims. Have that user sign out and back in, then visit `/admin`. Administrators can grant or remove admin roles for other registered travelers from the Travelers section. The backend prevents removing the last admin, changing your own role, or disabling/deleting an administrator.

## Managed collections

- `trips`: published destinations shown on the travel site. The Trips section can import the current featured destinations.
- `siteContent`: published field notes shown on the travel site.
- `bookings`: booking records and their status.
- `travelers`: profiles created after Google sign-in; admin-only fields are writable only by trusted server code.
- `messages`: admin-managed inquiries.

Firestore rules allow public reads only for published trips and content. All other administrative reads and writes require the Firebase `admin` custom claim. Booking and message records can be added from the dashboard; connect a public checkout/contact flow before accepting live bookings or inquiries.