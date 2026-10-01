const { applicationDefault, initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

async function main() {
  const email = process.argv[2]
  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!email || !projectId) {
    throw new Error('Usage: set FIREBASE_PROJECT_ID, then run node functions/scripts/set-admin.cjs admin@example.com')
  }

  initializeApp({ credential: applicationDefault(), projectId })
  const auth = getAuth()
  const user = await auth.getUserByEmail(email)
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true, role: 'admin' })
  await getFirestore().collection('travelers').doc(user.uid).set({ admin: true }, { merge: true })
  console.log(`Administrator role assigned to ${email}. Sign out and back in to refresh the role.`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})