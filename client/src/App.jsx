import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AuthProvider from './features/auth/AuthProvider'
import Auth from './pages/Auth'
import useAuthStore from './store/authSlice'

function Home() {
  const { channel, logout } = useAuthStore()
  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 24, fontWeight: 600 }}>⚡ Flux</div>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
        Welcome, <strong style={{ color: 'white' }}>{channel?.displayName}</strong> — @{channel?.handle}
      </p>
      <button
        onClick={logout}
        style={{ marginTop: 8, padding: '8px 20px', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}
      >
        Sign out
      </button>
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 20, height: 20, border: '1.5px solid rgba(255,255,255,0.1)', borderTop: '1.5px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  return isAuthenticated ? children : <Navigate to="/auth" replace />
}

function GuestRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  return !isAuthenticated ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1a1a1a',
              color: '#fff',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              fontSize: '13px',
            },
          }}
        />
        <Routes>
          <Route path="/auth" element={<GuestRoute><Auth /></GuestRoute>} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}