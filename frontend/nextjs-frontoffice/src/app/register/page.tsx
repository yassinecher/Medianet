'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BorderBeam } from '@/components/magicui/border-beam'
import { Particles } from '@/components/magicui/particles'
import { AnimatedGradientText } from '@/components/magicui/animated-gradient-text'

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  // Self-registration is intentionally PORTEUR-only.
  // JURY and MENTOR accounts are created only via admin invitation.
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.register(form)
      // AuthResponse is flat: { token, userId, email, firstName, lastName, role, roles, permissions }
      setAuth(data, data.token)
      toast.success('Compte créé avec succès !')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Erreur lors de l'inscription")
    } finally {
      setLoading(false)
    }
  }

  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
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
          <BorderBeam colorFrom="#a78bfa" colorTo="#6272f6" duration={8} />

          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/30">
                <span className="text-xl font-bold text-white">M</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Créer un compte</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Rejoignez{' '}
              <AnimatedGradientText>Medianet Incubateur</AnimatedGradientText>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Prénom</label>
                <Input
                  placeholder="Prénom"
                  value={form.firstName}
                  onChange={(e) => u('firstName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nom</label>
                <Input
                  placeholder="Nom"
                  value={form.lastName}
                  onChange={(e) => u('lastName', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="vous@example.com"
                value={form.email}
                onChange={(e) => u('email', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Téléphone (optionnel)</label>
              <Input
                type="tel"
                placeholder="+213 ..."
                value={form.phone}
                onChange={(e) => u('phone', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mot de passe</label>
              <Input
                type="password"
                placeholder="Min. 8 caractères"
                value={form.password}
                onChange={(e) => u('password', e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-3 text-xs text-muted-foreground">
              <strong className="text-brand-700 dark:text-brand-300">Porteur de projet</strong> — votre compte vous permet de soumettre des candidatures aux programmes ouverts.
              <p className="mt-1 opacity-80">Les comptes <em>Mentor</em> et <em>Juré</em> sont créés uniquement sur invitation de l'administrateur.</p>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-brand-600 to-purple-600 text-white"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Création...' : 'Créer mon compte'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Déjà un compte ?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Se connecter
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
