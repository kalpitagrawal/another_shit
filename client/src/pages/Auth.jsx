import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Sun, Moon, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authSlice'
import { getGoogleOAuthURL } from '../api/auth.api'

// ── Validation ─────────────────────────────────────────────
const validateLogin = ({ email, password }) => {
  if (!email) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email'
  if (!password) return 'Password is required'
  return null
}

const validateRegister = ({ email, password, handle, displayName }) => {
  if (!displayName?.trim()) return 'Display name is required'
  if (!email) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email'
  if (!handle) return 'Handle is required'
  if (!/^[a-z0-9_]+$/.test(handle)) return 'Handle can only contain lowercase letters, numbers, and underscores'
  if (!password) return 'Password is required'
  if (password.length < 6) return 'Password must be at least 6 characters'
  return null
}

// ── Google Icon SVG ────────────────────────────────────────
const GoogleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

// ── Main Component ─────────────────────────────────────────
export default function Auth() {
  const [tab, setTab] = useState('login')
  const [dark, setDark] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    email: '', password: '', handle: '', displayName: '',
  })
  const [errors, setErrors] = useState({})

  const { login, register, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Redirect if already authed
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated])

  // Handle Google OAuth callback
  useEffect(() => {
    if (searchParams.get('auth') === 'success') {
      toast.success('Signed in with Google')
      navigate('/', { replace: true })
    }
    if (searchParams.get('error') === 'google_failed') {
      toast.error('Google sign-in failed. Try again.')
    }
  }, [])

  const d = dark // shorthand

  const handleChange = (e) => {
    const { name, value } = e.target
    // auto-lowercase handle
    const val = name === 'handle' ? value.toLowerCase() : value
    setForm((f) => ({ ...f, [name]: val }))
    if (errors[name]) setErrors((e) => ({ ...e, [name]: '' }))
  }

  const setFieldError = (field, msg) => setErrors((e) => ({ ...e, [field]: msg }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})

    const error = tab === 'login' ? validateLogin(form) : validateRegister(form)
    if (error) {
      toast.error(error)
      return
    }

    setIsSubmitting(true)
    try {
      if (tab === 'login') {
        await login({ email: form.email, password: form.password })
        toast.success('Welcome back')
      } else {
        await register({
          email: form.email,
          password: form.password,
          handle: form.handle,
          displayName: form.displayName,
        })
        toast.success('Account created')
      }
      navigate('/')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Something went wrong'
      toast.error(msg)
      // Map known field errors
      if (msg.toLowerCase().includes('email')) setFieldError('email', msg)
      else if (msg.toLowerCase().includes('handle')) setFieldError('handle', msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchTab = (t) => {
    setTab(t)
    setErrors({})
    setForm({ email: '', password: '', handle: '', displayName: '' })
    setShowPassword(false)
  }

  // ── Style helpers ────────────────────────────────────────
  const bg = d ? 'bg-[#080808]' : 'bg-[#f0f0f0]'
  const text = d ? 'text-white' : 'text-black'
  const textMuted = d ? 'text-white/40' : 'text-black/40'
  const textSub = d ? 'text-white/55' : 'text-black/55'
  const glass = d ? 'glass-dark' : 'glass-light'
  const fieldCls = d ? 'field-dark text-white' : 'field-light text-black'
  const btnPrimary = d
    ? 'bg-white text-black hover:bg-white/90'
    : 'bg-black text-white hover:bg-black/85'
  const googleBtnCls = d ? 'google-btn-dark' : 'google-btn-light'
  const dividerLine = d ? 'bg-white/8' : 'bg-black/8'
  const toggleBg = d ? 'bg-white/8 hover:bg-white/12' : 'bg-black/6 hover:bg-black/10'
  const toggleIcon = d ? 'text-white/50' : 'text-black/50'
  const tabActive = d ? 'text-white border-white' : 'text-black border-black'
  const tabInactive = d ? 'text-white/35 border-transparent hover:text-white/55' : 'text-black/35 border-transparent hover:text-black/55'
  const errorText = d ? 'text-red-400' : 'text-red-600'
  const errorBorder = d ? 'border-red-400/50' : 'border-red-500/50'

  const circleBase = d ? 'border-white/[0.05]' : 'border-black/[0.05]'

  return (
    <div className={`min-h-screen w-full flex items-center justify-center relative overflow-hidden transition-colors duration-300 ${bg}`}>

      {/* ── Background circles ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full border ${circleBase}`} />
        <div className={`absolute -bottom-40 -right-24 w-[420px] h-[420px] rounded-full border ${circleBase}`} />
        <div className={`absolute top-1/3 right-12 w-[180px] h-[180px] rounded-full border ${circleBase}`} />
        <div className={`absolute bottom-24 left-1/4 w-[100px] h-[100px] rounded-full border ${circleBase}`} />
      </div>

      {/* ── Subtle radial glow ── */}
      {d && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.025) 0%, transparent 70%)',
          }}
        />
      )}

      {/* ── Dark / Light toggle ── */}
      <button
        onClick={() => setDark(!d)}
        aria-label={d ? 'Switch to light mode' : 'Switch to dark mode'}
        className={`absolute top-5 right-5 p-2 rounded-full transition-colors cursor-pointer ${toggleBg}`}
      >
        {d
          ? <Sun size={16} className={toggleIcon} />
          : <Moon size={16} className={toggleIcon} />
        }
      </button>

      {/* ── Glass card ── */}
      <div className={`relative z-10 w-full max-w-sm mx-4 rounded-3xl p-8 ${glass} transition-all duration-300`}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${d ? 'bg-white' : 'bg-black'}`}>
            <Zap size={14} className={d ? 'text-black' : 'text-white'} strokeWidth={2.5} />
          </div>
          <span className={`text-sm font-semibold tracking-widest uppercase ${text}`}>Flux</span>
        </div>

        {/* Tab switcher */}
        <div className="flex mb-6 gap-0">
          {['login', 'register'].map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 pb-2.5 text-sm font-medium border-b transition-colors duration-200 capitalize cursor-pointer bg-transparent ${tab === t ? tabActive : tabInactive}`}
            >
              {t === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {/* Heading */}
        <h1 className={`text-xl font-semibold tracking-tight mb-1 ${text}`}>
          {tab === 'login' ? 'Welcome back' : 'Join Flux'}
        </h1>
        <p className={`text-sm mb-6 ${textSub}`}>
          {tab === 'login'
            ? 'Sign in to your account to continue'
            : 'Start streaming to the world'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-3">

          {tab === 'register' && (
            <div>
              <input
                name="displayName"
                type="text"
                placeholder="Display name"
                value={form.displayName}
                onChange={handleChange}
                autoComplete="name"
                className={`w-full h-11 rounded-xl px-4 text-sm ${fieldCls} ${errors.displayName ? errorBorder : ''}`}
              />
              {errors.displayName && <p className={`text-xs mt-1 ${errorText}`}>{errors.displayName}</p>}
            </div>
          )}

          <div>
            <input
              name="email"
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              className={`w-full h-11 rounded-xl px-4 text-sm ${fieldCls} ${errors.email ? errorBorder : ''}`}
            />
            {errors.email && <p className={`text-xs mt-1 ${errorText}`}>{errors.email}</p>}
          </div>

          {tab === 'register' && (
            <div>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm select-none ${textMuted}`}>@</span>
                <input
                  name="handle"
                  type="text"
                  placeholder="your_handle"
                  value={form.handle}
                  onChange={handleChange}
                  autoComplete="username"
                  maxLength={30}
                  className={`w-full h-11 rounded-xl pl-8 pr-4 text-sm ${fieldCls} ${errors.handle ? errorBorder : ''}`}
                />
              </div>
              {errors.handle && <p className={`text-xs mt-1 ${errorText}`}>{errors.handle}</p>}
            </div>
          )}

          <div>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className={`w-full h-11 rounded-xl px-4 pr-11 text-sm ${fieldCls} ${errors.password ? errorBorder : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className={`absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-0 ${textMuted} hover:opacity-80 transition-opacity`}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className={`text-xs mt-1 ${errorText}`}>{errors.password}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full h-11 rounded-xl text-sm font-semibold transition-all duration-150 mt-1 cursor-pointer tracking-wide disabled:opacity-50 disabled:cursor-not-allowed ${btnPrimary}`}
          >
            {isSubmitting
              ? (tab === 'login' ? 'Signing in…' : 'Creating account…')
              : (tab === 'login' ? 'Continue' : 'Create account')
            }
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className={`flex-1 h-px ${dividerLine}`} />
          <span className={`text-xs ${textMuted}`}>or</span>
          <div className={`flex-1 h-px ${dividerLine}`} />
        </div>

        {/* Google OAuth */}
        <a
          href={getGoogleOAuthURL()}
          className={`w-full h-11 rounded-xl flex items-center justify-center gap-2.5 text-sm transition-colors duration-150 no-underline ${googleBtnCls} ${textSub}`}
        >
          <GoogleIcon className="w-4 h-4 flex-shrink-0" />
          Continue with Google
        </a>

        {/* Footer link */}
        <p className={`text-center text-xs mt-5 ${textMuted}`}>
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
            className={`underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 text-xs transition-opacity hover:opacity-70 ${textSub}`}
          >
            {tab === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}