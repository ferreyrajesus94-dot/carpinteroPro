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

export function LoginPage() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const { theme, toggle } = useTheme()
  const [mode, setMode] = useState<Mode>('login')
  const [showPassword, setShowPassword] = useState(false)

  // Campos compartidos
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Solo registro
  const [workshopName, setWorkshopName] = useState('')
  const [success, setSuccess] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setSuccess(false)
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
    setError(null)
    setSubmitting(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { workshop_name: workshopName || 'Mi Taller' },
      },
    })

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    // Supabase envía un email de confirmación por defecto.
    // Mostramos mensaje de éxito en lugar de redirigir.
    setSuccess(true)
    setSubmitting(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
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
          {/* Tabs login / registro */}
          <div className="flex border-b">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={cn(
                'flex-1 py-3 text-sm font-medium transition-colors',
                mode === 'login'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={cn(
                'flex-1 py-3 text-sm font-medium transition-colors',
                mode === 'register'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Registrarse
            </button>
          </div>

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
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="current-password"
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
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Ingresando...' : 'Ingresar'}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
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
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => switchMode('login')}
                    >
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
                      <div className="relative">
                      <Input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        autoComplete="new-password"
                        required
                        minLength={6}
                        className="pr-10"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
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
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <Button type="submit" className="w-full" disabled={submitting}>
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
