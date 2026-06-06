import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Zap, Shield, CreditCard, Lock, Terminal } from 'lucide-react'
import { useLanguage } from '@/i18n/LanguageContext'
import { getErrorMessage } from '@/lib/errors'
import { BrandLogo } from '@/components/BrandLogo'
import { supabase } from '@/lib/supabase'
import { Chrome } from 'lucide-react'

type AuthDebugState = {
  sessionExists: boolean
  userId: string | null
  userEmail: string | null
  usersRowExists: boolean
  role: string | null
  authError: string | null
  usersError: string | null
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [debugLoading, setDebugLoading] = useState(false)
  
  // HIDDEN DEBUG TRIGGER
  const [showDebug, setShowDebug] = useState(false)
  const [logoClicks, setLogoClicks] = useState(0)

  const [debug, setDebug] = useState<AuthDebugState>({
    sessionExists: false,
    userId: null,
    userEmail: null,
    usersRowExists: false,
    role: null,
    authError: null,
    usersError: null,
  })
  const { signIn, signUp, resetPasswordForEmail, user, session, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const { t } = useLanguage()

  const isDev = import.meta.env.DEV;

  const refreshDebug = async () => {
    if (!isDev && !showDebug) return;
    setDebugLoading(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const currentSession = sessionData.session
      const currentUser = currentSession?.user ?? null
      let usersRowExists = false
      let role: string | null = null
      let usersError: string | null = null

      if (currentUser?.id) {
        if (isDev) {
          console.log('[Auth Debug] checking users table for:', currentUser.id)
        }

        const { data: usersRow, error } = await supabase
          .from('users')
          .select('id, email, role')
          .eq('id', currentUser.id)
          .maybeSingle()

        usersRowExists = !!usersRow
        role = usersRow?.role ?? null
        usersError = error?.message ?? null
      }

      setDebug({
        sessionExists: !!currentSession,
        userId: currentUser?.id ?? null,
        userEmail: currentUser?.email ?? null,
        usersRowExists,
        role,
        authError: sessionError?.message ?? null,
        usersError,
      })
    } catch (err) {
      setDebug((prev) => ({
        ...prev,
        authError: getErrorMessage(err, 'Unable to inspect auth state.'),
      }))
    } finally {
      setDebugLoading(false)
    }
  }

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (hash.includes('type=recovery')) {
      toast.success(t('resetEmailSent'))
    }
  }, [t])

  useEffect(() => {
    if (isDev || showDebug) {
      void refreshDebug()
    }
  }, [user?.id, session?.access_token, showDebug])

  const handleLogoClick = () => {
    const nextCount = logoClicks + 1;
    setLogoClicks(nextCount);
    if (nextCount === 7) {
      setShowDebug(!showDebug);
      setLogoClicks(0);
      if (!showDebug) toast.success("Developer debug mode activated");
    }
    // Reset click counter after 3 seconds of inactivity
    setTimeout(() => setLogoClicks(0), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error, user } = isLogin ? await signIn(email, password) : await signUp(email, password)

      if (error) {
        toast.error(getErrorMessage(error, t('somethingWentWrong')))
      } else if (isLogin && user) {
        toast.success(`${t('welcomeBack')}!`)
        navigate('/dashboard')
      } else if (isLogin) {
        toast.error('No active session was created after sign in.')
      } else {
        toast.success(t('accountCreated'))
      }
    } catch (err) {
      toast.error(getErrorMessage(err, t('somethingWentWrong')))
    } finally {
      setLoading(false)
      void refreshDebug()
    }
  }

  const handleResetPassword = async () => {
    if (!email.trim()) {
      toast.error(t('enterEmailFirst'))
      return
    }
    setLoading(true)
    try {
      const { error } = await resetPasswordForEmail(email.trim())
      if (error) toast.error(getErrorMessage(error, t('somethingWentWrong')))
      else {
        setResetSent(true)
        toast.success(t('resetEmailSent'))
      }
    } catch (err) {
      toast.error(getErrorMessage(err, t('somethingWentWrong')))
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: Zap, title: t('featureInstant'), desc: t('featureInstantDesc') },
    { icon: Shield, title: t('featureSecure'), desc: t('featureSecureDesc') },
    { icon: CreditCard, title: t('featureRates'), desc: t('featureRatesDesc') },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-background relative overflow-hidden">
      {/* DECORATIVE BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full bg-primary/5 blur-3xl animate-pulse delay-700" />
      </div>

      <div className="relative w-full max-w-md space-y-5 sm:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="flex justify-center cursor-help transition-transform active:scale-95" onClick={handleLogoClick}>
            <BrandLogo size="lg" className="mx-auto drop-shadow-2xl" />
          </div>
          <h1 className="brand-header-title text-3xl sm:text-4xl md:text-5xl italic tracking-tighter">
            CEDAR BOOST
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.4em] font-black opacity-60 italic">{t('brandTagline')}</p>
        </div>

        <div className="glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 p-5 sm:p-8 shadow-2xl space-y-6 sm:space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-black italic tracking-tighter">{isLogin ? t('welcomeBack') : t('createAccount')}</h2>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">{isLogin ? t('signInToAccount') : t('getStarted')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="text-[9px] uppercase font-black tracking-[0.25em] text-white/35 ml-1">
                {t('email')}
              </label>
              <Input
                id="auth-email"
                type="email"
                placeholder={t('authEmailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-13 bg-white/[0.04] border-white/[0.09] rounded-2xl px-5 font-bold text-sm input-premium focus-visible:ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="auth-password" className="text-[9px] uppercase font-black tracking-[0.25em] text-white/35 ml-1">
                {t('password')}
              </label>
              <Input
                id="auth-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-13 bg-white/[0.04] border-white/[0.09] rounded-2xl px-5 font-bold text-sm input-premium focus-visible:ring-primary/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary-premium h-14 w-full text-white font-black rounded-2xl text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 tap-feedback disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? <Loader className="w-5 h-5 animate-spin" /> : isLogin ? t('signIn') : t('signUp')}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center gap-3">
            <div className="flex-1 divider-fade" />
            <span className="text-[8px] uppercase tracking-[0.3em] font-black text-white/25 shrink-0">{t('orContinueWith')}</span>
            <div className="flex-1 divider-fade" />
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            className="h-13 w-full bg-white/[0.04] border border-white/[0.09] text-white/70 hover:text-white hover:bg-white/[0.08] font-black rounded-2xl text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all tap-feedback"
            onClick={async () => {
              const { error } = await signInWithGoogle()
              if (error) {
                toast.error(getErrorMessage(error, t('somethingWentWrong')))
              }
            }}
          >
            <Chrome className="w-4 h-4" />
            {t('signInWithGoogle')}
          </button>

          {isLogin && (
            <div className="text-center">
              <button
                type="button"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 hover:text-primary transition-colors disabled:opacity-50"
                disabled={loading || resetSent}
                onClick={() => void handleResetPassword()}
              >
                {t('forgotPassword')}
              </button>
            </div>
          )}

          <p className="text-center text-xs font-bold text-muted-foreground">
            {isLogin ? t('noAccount') : t('hasAccount')}{' '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              disabled={loading}
              className="text-primary hover:text-primary/80 transition-colors font-black uppercase tracking-widest ml-1"
            >
              {isLogin ? t('signUp') : t('signIn')}
            </button>
          </p>
        </div>

        {/* FEATURES */}
        <div className="grid gap-3 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center text-center gap-3 glass border-white/5 p-5 rounded-[1.5rem] group hover:bg-white/[0.03] transition-all duration-500">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-[10px] uppercase tracking-widest text-white">{title}</p>
                <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest leading-relaxed opacity-50">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* SECURE DEBUG PANEL - DEV ONLY OR HIDDEN TRIGGER */}
        {(isDev || (showDebug && debug.role === 'admin')) && (
          <div className="glass border-primary/20 bg-primary/5 rounded-[2rem] p-6 space-y-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Kernel Debug Hub</h3>
                  <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Production Protection Layer: ACTIVE</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void refreshDebug()} disabled={debugLoading} className="h-8 rounded-full text-[8px] font-black uppercase tracking-widest border-primary/20 bg-primary/10 text-primary">
                {debugLoading ? 'Syncing...' : 'Force Sync'}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 p-4 bg-black/40 rounded-2xl font-mono text-[9px] border border-white/5">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/40">SESSION_STATUS</span>
                <span className={debug.sessionExists ? 'text-emerald-500' : 'text-red-500'}>{debug.sessionExists ? 'ENCRYPTED' : 'NOT_FOUND'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 py-2">
                <span className="text-white/40">USER_AUTH_ID</span>
                <span className="text-primary truncate ml-8">{debug.userId ?? 'NULL'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 py-2">
                <span className="text-white/40">AUTH_EMAIL_HASH</span>
                <span className="text-primary truncate ml-8">{debug.userEmail ?? 'NULL'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 py-2">
                <span className="text-white/40">LEDGER_ROW</span>
                <span className={debug.usersRowExists ? 'text-emerald-500' : 'text-amber-500'}>{debug.usersRowExists ? 'PRESENT' : 'ORPHANED'}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-white/40">PRIVILEGE_ROLE</span>
                <span className="text-primary font-black uppercase">{debug.role ?? 'GUEST'}</span>
              </div>
            </div>
            
            {debug.authError && <p className="text-[8px] text-red-500 font-mono bg-red-500/10 p-2 rounded-lg border border-red-500/20 uppercase tracking-tighter">ERR: {debug.authError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function Loader({ className }: { className?: string }) {
  return (
    <div className={className}>
       <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: `${i*0.2}s` }} />
          ))}
       </div>
    </div>
  )
}
