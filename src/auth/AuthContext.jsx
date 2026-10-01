import { useEffect, useMemo, useState } from 'react'
import { getIdTokenResult, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, firebaseConfigured, googleProvider } from '../firebase.js'
import { AuthContext } from './AuthContextValue.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(firebaseConfigured)

  useEffect(() => {
    if (!firebaseConfigured) return undefined

    return onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true)
      setUser(currentUser)
      if (!currentUser) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      let admin = false
      try {
        const token = await getIdTokenResult(currentUser)
        admin = token.claims.admin === true || token.claims.role === 'admin'
      } catch {
        admin = false
      }
      setIsAdmin(admin)
      setLoading(false)

      void setDoc(doc(db, 'travelers', currentUser.uid), {
        uid: currentUser.uid,
        displayName: currentUser.displayName || '',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL || '',
        lastSeenAt: serverTimestamp(),
      }, { merge: true }).catch(() => {})
    })
  }, [])

  const value = useMemo(() => ({
    user,
    isAdmin,
    loading,
    signInWithGoogle: async () => {
      if (!auth) throw new Error('Firebase is not configured yet. Follow the Firebase setup guide first.')
      return signInWithPopup(auth, googleProvider)
    },
    signOut: () => auth ? signOut(auth) : Promise.resolve(),
    refreshAdminRole: async (currentUser = user) => {
      if (!currentUser) return false
      const token = await getIdTokenResult(currentUser, true)
      const admin = token.claims.admin === true || token.claims.role === 'admin'
      setIsAdmin(admin)
      return admin
    },
  }), [user, isAdmin, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}