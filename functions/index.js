const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
const { HttpsError, onCall } = require('firebase-functions/v2/https')

initializeApp()

const auth = getAuth()
const db = getFirestore()

function requireAdmin(request) {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Administrator access is required.')
  }
}

function requireTargetUid(uid, callerUid) {
  if (typeof uid !== 'string' || !uid || uid === callerUid) {
    throw new HttpsError('invalid-argument', 'Choose a different, valid traveler account.')
  }
}

async function ensureAnotherAdmin(excludedUid) {
  const admins = await db.collection('travelers').where('admin', '==', true).get()
  if (admins.docs.every((item) => item.id === excludedUid)) {
    throw new HttpsError('failed-precondition', 'At least one other administrator must remain.')
  }
}

exports.setAdminRole = onCall(async (request) => {
  requireAdmin(request)
  const { uid, admin: shouldBeAdmin } = request.data || {}
  requireTargetUid(uid, request.auth.uid)
  if (typeof shouldBeAdmin !== 'boolean') {
    throw new HttpsError('invalid-argument', 'The admin value must be true or false.')
  }

  const target = await auth.getUser(uid)
  if (!shouldBeAdmin && target.customClaims?.admin === true) await ensureAnotherAdmin(uid)

  const claims = { ...target.customClaims }
  if (shouldBeAdmin) {
    claims.admin = true
    claims.role = 'admin'
  } else {
    delete claims.admin
    delete claims.role
  }
  await auth.setCustomUserClaims(uid, claims)
  await db.collection('travelers').doc(uid).set({ admin: shouldBeAdmin }, { merge: true })
  await auth.revokeRefreshTokens(uid)
  return { message: shouldBeAdmin ? 'Administrator role assigned.' : 'Administrator role removed.' }
})

exports.setTravelerDisabled = onCall(async (request) => {
  requireAdmin(request)
  const { uid, disabled } = request.data || {}
  requireTargetUid(uid, request.auth.uid)
  if (typeof disabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'The disabled value must be true or false.')
  }

  const target = await auth.getUser(uid)
  if (target.customClaims?.admin === true) {
    throw new HttpsError('failed-precondition', 'Remove administrator access before disabling this account.')
  }
  await auth.updateUser(uid, { disabled })
  await db.collection('travelers').doc(uid).set({ disabled }, { merge: true })
  return { message: disabled ? 'Traveler account disabled.' : 'Traveler account enabled.' }
})

exports.deleteTraveler = onCall(async (request) => {
  requireAdmin(request)
  const { uid } = request.data || {}
  requireTargetUid(uid, request.auth.uid)

  const target = await auth.getUser(uid)
  if (target.customClaims?.admin === true) {
    throw new HttpsError('failed-precondition', 'Remove administrator access before deleting this account.')
  }
  await auth.deleteUser(uid)
  await db.collection('travelers').doc(uid).delete()
  return { message: 'Traveler account deleted.' }
})