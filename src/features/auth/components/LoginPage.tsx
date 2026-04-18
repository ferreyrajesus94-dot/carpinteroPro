import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useTheme } from '@/shared/hooks/useTheme'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { cn } from '@/shared/lib/utils'

type Mode = 'login' | 'register'

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ─── Requisitos de contraseña segura ────────────────────────────────────────
const PASSWORD_RULES = [
  { id: 'length',    label: 'Mínimo 8 caracteres',              test: (p: string) => p.length >= 8 },
  { id: 'upper',     label: 'Al menos una mayúscula',           test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',     label: 'Al menos una minúscula',           test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',    label: 'Al menos un número',               test: (p: string) => /\d/.test(p) },
  { id: 'special',   label: 'Al menos un carácter especial',    test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

const STRENGTH_LABELS  = ['', 'Muy débil', 'Débil', 'Regular', 'Buena', 'Muy segura']
const STRENGTH_COLORS  = ['', 'bg-destructive', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
const STRENGTH_TEXT    = ['', 'text-destructive', 'text-orange-500', 'text-yellow-500', 'text-blue-500', 'text-green-500']

export function LoginPage() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const { theme, toggle } = useTheme()
  const [mode, setMode]               = useState<Mode>('login')
  const [showPassword, setShowPassword] = useState(false)

  // Campos compartidos
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  // Pre-llenar email si fue guardado previamente
  useEffect(() => {
    const saved = localStorage.getItem('carpinteroPro.rememberedEmail')
    if (saved) {
      setEmail(saved)
      setRememberMe(true)
    }
  }, [])

  // Solo registro
  const [workshopName, setWorkshopName] = useState('')
  const [success, setSuccess]           = useState(false)

  const [error, setError]         = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Cálculo de fuerza de contraseña (solo usado en registro)
  const checks   = PASSWORD_RULES.map(r => ({ ...r, passed: r.test(password) }))
  const strength = checks.filter(c => c.passed).length   // 0–5
  const allPassed = strength === PASSWORD_RULES.length

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (session) return <Navigate to="/dashboard" replace />

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setSuccess(false)
    setPassword('')
  }

  async function handleGoogleAuth() {
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    // Supabase redirige al proveedor — cuando vuelve, AuthProvider carga la sesión.
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : error.message
      )
      setSubmitting(false)
      return
    }

    if (rememberMe) {
      localStorage.setItem('carpinteroPro.rememberedEmail', email)
    } else {
      localStorage.removeItem('carpinteroPro.rememberedEmail')
    }

    navigate('/dashboard', { replace: true })
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    if (!allPassed) return   // guard extra — el botón ya debería estar deshabilitado
    setError(null)
    setSubmitting(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { workshop_name: workshopName || 'Mi Taller' } },
    })

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)
  }

  // ─── Campo contraseña reutilizable ────────────────────────────────────────
  function PasswordInput({ id, autoComplete }: { id: string; autoComplete: string }) {
    return (
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete={autoComplete}
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword(v => !v)}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <i className={`fi ${showPassword ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-sm leading-none`} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      {/* Toggle modo oscuro */}
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <i className={`fi ${theme === 'dark' ? 'fi-rr-sun' : 'fi-rr-moon'} text-base leading-none`} />
      </button>

      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <i className="fi fi-br-hammer text-lg text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">CarpinteroPro</h1>
        </div>

        <Card>
          {/* Tabs */}
          <div className="flex border-b">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors',
                  mode === m
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          {/* ── LOGIN ── */}
          {mode === 'login' ? (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-lg">Bienvenido</CardTitle>
                <CardDescription>Ingresá tu email y contraseña</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="taller@ejemplo.com"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Contraseña</Label>
                    <PasswordInput id="password" autoComplete="current-password" />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                    />
                    Recordarme en este equipo
                  </label>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Ingresando...' : 'Ingresar'}
                  </Button>

                  <div className="relative flex items-center gap-3">
                    <div className="flex-1 border-t" />
                    <span className="text-xs text-muted-foreground">o continuá con</span>
                    <div className="flex-1 border-t" />
                  </div>

                  <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogleAuth}>
                    <GoogleIcon />
                    Google
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (

          /* ── REGISTRO ── */
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-lg">Crear cuenta</CardTitle>
                <CardDescription>Registrá tu taller en CarpinteroPro</CardDescription>
              </CardHeader>
              <CardContent>
                {success ? (
                  <div className="space-y-4 text-center">
                    <div className="flex justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <i className="fi fi-rr-envelope text-2xl text-primary leading-none" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">¡Revisá tu email!</p>
                      <p className="text-sm text-muted-foreground">
                        Te enviamos un link de confirmación a <strong>{email}</strong>.
                        Confirmá tu cuenta para poder ingresar.
                      </p>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => switchMode('login')}>
                      Ir al login
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-workshop">Nombre del taller</Label>
                      <Input
                        id="reg-workshop"
                        type="text"
                        placeholder="Carpintería Pérez"
                        value={workshopName}
                        onChange={e => setWorkshopName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="taller@ejemplo.com"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reg-password">Contraseña</Label>
                      <PasswordInput id="reg-password" autoComplete="new-password" />

                      {/* Barra de fuerza */}
                      {password.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <div className="flex gap-1">
                            {PASSWORD_RULES.map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  'h-1 flex-1 rounded-full transition-all duration-300',
                                  i < strength ? STRENGTH_COLORS[strength] : 'bg-muted'
                                )}
                              />
                            ))}
                          </div>
                          <p className={cn('text-xs font-medium', STRENGTH_TEXT[strength])}>
                            {STRENGTH_LABELS[strength]}
                          </p>

                          {/* Checklist de requisitos */}
                          <ul className="space-y-1">
                            {checks.map(c => (
                              <li key={c.id} className="flex items-center gap-2 text-xs">
                                <i className={cn(
                                  'fi leading-none shrink-0',
                                  c.passed
                                    ? 'fi-rr-check text-green-500'
                                    : 'fi-rr-cross text-muted-foreground'
                                )} />
                                <span className={c.passed ? 'text-foreground' : 'text-muted-foreground'}>
                                  {c.label}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={submitting || !allPassed}
                    >
                      {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
                    </Button>

                    <div className="relative flex items-center gap-3">
                      <div className="flex-1 border-t" />
                      <span className="text-xs text-muted-foreground">o registrate con</span>
                      <div className="flex-1 border-t" />
                    </div>

                    <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogleAuth}>
                      <GoogleIcon />
                      Google
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
