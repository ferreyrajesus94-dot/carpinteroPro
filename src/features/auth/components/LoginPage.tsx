import { useState, type FormEvent } from 'react'
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

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Ingresando...' : 'Ingresar'}
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
