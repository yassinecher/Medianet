'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore, frontofficeRolesOf } from '@/store/auth.store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BorderBeam } from '@/components/magicui/border-beam'
import { AuthShell } from '@/components/brand/AuthShell'

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
      // ADMIN-only accounts are pushed to the backoffice; mixed accounts keep
      // their non-admin roles for the frontoffice.
      const fo = frontofficeRolesOf({ ...data, role: data.role, roles: data.roles ?? [] } as any)
      if (fo.length === 0) {
        toast.error("Ce compte n'a pas accès au Frontoffice. Utilisez le Backoffice Admin.")
        setLoading(false)
        return
      }
      setAuth(data, data.token)
      toast.success(`Bienvenue, ${data.firstName} !`)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-xl sm:p-8">
        <BorderBeam duration={12} />

        <div className="mb-7">
          <h1 className="text-2xl font-bold text-foreground">Connexion</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Heureux de vous revoir — accédez à votre espace incubateur.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" placeholder="vous@example.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mot de passe</label>
            <div className="relative">
              <Input type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required
                className="pr-10" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading}
            className="w-full text-white" style={{ background: 'linear-gradient(90deg,#0084c7,#00a3e0)' }}>
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
    </AuthShell>
  )
}
