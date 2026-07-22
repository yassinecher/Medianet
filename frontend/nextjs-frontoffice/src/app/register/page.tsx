'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BorderBeam } from '@/components/magicui/border-beam'
import { AuthShell } from '@/components/brand/AuthShell'

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  // Self-registration is intentionally PORTEUR-only (other roles by invitation).
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Live password rules — shown as a checklist under the field.
  const rules = [
    { ok: form.password.length >= 8, label: '8 caractères minimum' },
    { ok: /[A-Z]/.test(form.password), label: 'Au moins une majuscule' },
    { ok: /[0-9]/.test(form.password), label: 'Au moins un chiffre' },
  ]
  const pwdOk = rules.every((r) => r.ok)
  const matchOk = form.confirm.length > 0 && form.confirm === form.password

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.phone.trim()) { toast.error('Le numéro de téléphone est requis.'); return }
    if (!pwdOk) { toast.error('Le mot de passe ne respecte pas les critères.'); return }
    if (!matchOk) { toast.error('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    try {
      const { firstName, lastName, email, phone, password } = form
      const { data } = await authApi.register({ firstName, lastName, email, phone, password })
      setAuth(data, data.token)
      toast.success('Compte créé avec succès !')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Erreur lors de l'inscription")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-xl sm:p-8">
        <BorderBeam duration={12} />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Créer un compte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rejoignez l&apos;incubateur en tant que <strong className="text-brand-600 dark:text-brand-400">porteur de projet</strong> —
            candidatez aux programmes et suivez votre parcours.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Prénom</label>
              <Input placeholder="Prénom" value={form.firstName} onChange={(e) => u('firstName', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nom</label>
              <Input placeholder="Nom" value={form.lastName} onChange={(e) => u('lastName', e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" placeholder="vous@example.com" value={form.email}
              onChange={(e) => u('email', e.target.value)} required autoComplete="email" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Téléphone</label>
            <Input type="tel" placeholder="+216 12 345 678" value={form.phone}
              onChange={(e) => u('phone', e.target.value)} required autoComplete="tel" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mot de passe</label>
            <div className="relative">
              <Input type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={form.password}
                onChange={(e) => u('password', e.target.value)} required className="pr-10" autoComplete="new-password" />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Live rules checklist */}
            <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-3">
              {rules.map((r) => (
                <li key={r.label} className={`flex items-center gap-1 text-[11px] ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  {r.ok ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-50" />}
                  {r.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Confirmer le mot de passe</label>
            <div className="relative">
              <Input type={showConfirm ? 'text' : 'password'} placeholder="••••••••" value={form.confirm}
                onChange={(e) => u('confirm', e.target.value)} required className="pr-10" autoComplete="new-password" />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.confirm.length > 0 && (
              <p className={`flex items-center gap-1 text-[11px] ${matchOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {matchOk ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {matchOk ? 'Les mots de passe correspondent' : 'Les mots de passe ne correspondent pas'}
              </p>
            )}
          </div>

          <Button type="submit" disabled={loading}
            className="w-full text-white" style={{ background: 'linear-gradient(90deg,#0084c7,#00a3e0)' }}>
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
    </AuthShell>
  )
}
