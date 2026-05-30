'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore, frontofficeRolesOf } from '@/store/auth.store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AnimatedGradientText } from '@/components/magicui/animated-gradient-text'
import { BorderBeam } from '@/components/magicui/border-beam'
import { Particles } from '@/components/magicui/particles'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login(form.email, form.password)
      // AuthResponse: { token, userId, email, firstName, lastName, role, roles, permissions }
      // Determine which of the user's roles can use the frontoffice.
      // ADMIN-only accounts are pushed to the backoffice; mixed accounts
      // (e.g. ADMIN + MENTOR) keep their non-admin roles for the frontoffice.
      const fo = frontofficeRolesOf({ ...data, role: data.role, roles: data.roles ?? [] } as any)
      if (fo.length === 0) {
        toast.error("Ce compte n'a pas accès au Frontoffice. Utilisez le Backoffice Admin.")
        setLoading(false)
        return
      }
      setAuth(data, data.token)
      toast.success(`Bienvenue, ${data.firstName} !`)
      // If the user has multiple frontoffice roles, ask which one to use.
      if (fo.length > 1) {
        router.push('/select-role')
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0"><Particles quantity={50} color="#6272f6" /></div>
      <div className="mesh-gradient absolute inset-0" />

      {/* Animate only y (no opacity:0) so SSR renders the card visible */}
      <motion.div
        initial={{ y: 16 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <BorderBeam duration={6} />

          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/30">
                <span className="text-xl font-bold text-white">M</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Connexion</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Accédez à votre espace{' '}
              <AnimatedGradientText>Medianet Incubateur</AnimatedGradientText>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="vous@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mot de passe</label>
              <div className="relative">
                <Input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPwd(!showPwd)}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-brand-600 to-purple-600 text-white"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{' '}
            <Link href="/register" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Créer un compte
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
