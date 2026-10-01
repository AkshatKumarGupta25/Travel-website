import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { useAuth } from './auth/useAuth.js'

const App = lazy(() => import('./App.jsx'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'))
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'))

function AdminRoute() {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <div className="route-loading">Checking access…</div>
  if (!user) return <Navigate to="/admin/login" replace />
  if (!isAdmin) return <LoginPage admin denied />
  return <AdminDashboard />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<LoginPage admin />} />
      <Route path="/admin/*" element={<AdminRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function Root() {
  return <BrowserRouter><AuthProvider><Suspense fallback={<div className="route-loading">Loading Elsewhere…</div>}><AppRoutes /></Suspense></AuthProvider></BrowserRouter>
}