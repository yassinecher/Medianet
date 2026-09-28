'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react'
import { authApi } from '@/lib/api'
import { backofficeBase } from '@/lib/backoffice'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BorderBeam } from '@/components/magicui/border-beam'
import { AuthShell } from '@/components/brand/AuthShell'

/** Landing page of the emailed link: /reset-password?token=… → choose a new password. */
export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ admin: boolean } | null>(null)

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('token')
    if (fromUrl) {
      setToken(fromUrl)
      // Keep the secret out of the address bar / history once read.
      window.history.replaceState({}, '', '/reset-password')
    } else {
      // A second run (React dev double effects) must not wipe the token read first.
      setToken((current) => current ?? '')
    }
  }, [])

  const mismatch = confirm.length > 0 && password !== confirm
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8 || password !== confirm || !token) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await authApi.resetPassword(token, password)
      setDone({ admin: !!data?.admin })
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.response?.data?.error ?? 'Le mot de passe n’a pas pu être modifié.')
    } finally { setLoading(false) }
  }

  return (
    <AuthShell>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-xl sm:p-8">
        <BorderBeam duration={12} />
        {done ? (
          <div className="space-y-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-bold text-foreground">Mot de passe enregistré</h1>
            <p className="text-sm text-muted-foreground">Vous pouvez maintenant vous connecter avec votre email et ce mot de passe.</p>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/login"><Button className="w-full" variant="brand">Se connecter</Button></Link>
              {done.admin && (
                <a href={`${backofficeBase()}/login`} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                  Se connecter à l’administration
                </a>
              )}
            </div>
          </div>
        ) : token === '' ? (
          <div className="space-y-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-bold text-foreground">Lien incomplet</h1>
            <p className="text-sm text-muted-foreground">Ouvrez le lien reçu par email, ou demandez-en un nouveau.</p>
            <Link href="/forgot-password"><Button variant="outline" className="w-full">Demander un nouveau lien</Button></Link>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-foreground">Nouveau mot de passe</h1>
              <p className="mt-1 text-sm text-muted-foreground">Choisissez un mot de passe d’au moins 8 caractères.</p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="password">Mot de passe</label>
                <div className="relative">
                  <Input id="password" type={show ? 'text' : 'password'} value={password} autoComplete="new-password"
                    placeholder="8 caractères minimum" className="pr-10" required minLength={8}
                    onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer' : 'Afficher'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="confirm">Confirmer le mot de passe</label>
                <Input id="confirm" type={show ? 'text' : 'password'} value={confirm} autoComplete="new-password" required
                  onChange={(e) => setConfirm(e.target.value)} />
                {mismatch && <p className="text-xs text-destructive">Les mots de passe ne correspondent pas.</p>}
              </div>
              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}{' '}
                  <Link href="/forgot-password" className="font-semibold underline">Nouveau lien</Link>
                </p>
              )}
              <Button type="submit" disabled={loading || !token || password.length < 8 || password !== confirm}
                className="w-full text-white" style={{ background: 'var(--banner-bg, linear-gradient(90deg,#0084c7,#00a3e0))' }}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer le mot de passe
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  )
}
