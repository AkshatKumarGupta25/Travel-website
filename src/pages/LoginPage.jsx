import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, LockKeyhole, Plane } from 'lucide-react'
import { getIdTokenResult } from 'firebase/auth'
import { useAuth } from '../auth/useAuth.js'
import { firebaseConfigured } from '../firebase.js'
import './AuthPages.css'

export default function LoginPage({ admin = false, denied = false }) {
  const { user, signInWithGoogle, signOut, refreshAdminRole } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(denied ? 'This Google account does not have an administrator role.' : '')

  async function handleSignIn() {
    setBusy(true)
    setError('')
    try {
      const credential = await signInWithGoogle()
      if (admin) {
        const token = await getIdTokenResult(credential.user, true)
        const allowed = token.claims.admin === true || token.claims.role === 'admin'
        if (!allowed) {
          setError('This account is signed in but has not been assigned the administrator role.')
          return
        }
        await refreshAdminRole(credential.user)
        navigate('/admin', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (signInError) {
      setError(signInError.message || 'Google sign-in could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-image" role="img" aria-label="A winding mountain road at sunrise" />
      <section className="auth-panel">
        <a className="auth-wordmark" href="/"><span className="brand-mark"><Plane size={16} /></span>elsewhere<span>.</span></a>
        <a className="auth-back" href="/"><ArrowLeft size={15} /> Back to the journey</a>
        <div className="auth-content">
          <p className="eyebrow"><span /> {admin ? 'Elsewhere team' : 'Your next chapter'}</p>
          <h1>{admin ? 'Admin sign in.' : 'Good to have you here.'}</h1>
          <p className="auth-description">{admin ? 'Sign in with your authorized Google account to manage journeys and travelers.' : 'Sign in to keep your saved places and travel plans together.'}</p>
          {denied && <div className="auth-message" role="alert">{error}</div>}
          {!denied && error && <div className="auth-message" role="alert">{error}</div>}
          {!firebaseConfigured && <div className="auth-message" role="status">Google sign-in is not configured yet. Add your Firebase web app values to <code>.env.local</code> and follow the Firebase setup guide.</div>}
          <button className="google-sign-in" type="button" disabled={!firebaseConfigured || busy} onClick={handleSignIn}>
            <span className="google-mark">G</span>{busy ? 'Connecting…' : 'Continue with Google'}<ArrowUpRight size={16} />
          </button>
          {user && !denied && <p className="signed-in-note">Signed in as {user.email}. <button type="button" onClick={signOut}>Use another account</button></p>}
          {admin && <p className="auth-security"><LockKeyhole size={14} /> Admin access is verified by Firebase, not by this browser.</p>}
          <a className="other-login" href={admin ? '/login' : '/admin/login'}>{admin ? 'Traveler sign in' : 'Admin sign in'} <ArrowUpRight size={13} /></a>
        </div>
        <p className="auth-footnote">Thoughtful journeys, wherever you’re going.</p>
      </section>
    </main>
  )
}